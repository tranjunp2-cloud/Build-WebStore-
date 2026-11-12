/**
 * External PR #1996 review items, second security round:
 * TC-PERF-155 — Tenant platform fields (plan, status, billing / SSO ids, Stripe / Xendit account state, domains,
 *   quotas) are writable by super-admins only; a tenant owner's REST PATCH leaves them unchanged.
 * TC-PERF-156 — A custom domain serves the store only once verified (`status: active`), checked on that entry.
 * TC-PERF-157 — `images.dangerouslyAllowLocalIP` is on only outside production builds.
 * TC-PERF-158 — The QC rate-limit bypass needs the server `APP_ENV`, never `NEXT_PUBLIC_APP_ENV`.
 * TC-PERF-159 — Outbound-email limits are fail-closed; the OTP send limits (per IP, per address) keep their limits but
 *   fall back to the in-memory counter with a log when Upstash fails (TC-PERF-182).
 * TC-PERF-160 — Users `customerIdNumber`, `createdBy`, `updatedBy` cannot be written by a request.
 * Real: collections/Tenants.ts, collections/Users.ts, lib/cache/tenant.ts (activeDomainTenant), next.config.ts,
 * lib/rateLimit.ts, lib/email/outbound-email-limits.ts. Faked: checkRateLimit where the options are asserted.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { Tenants } from '@/collections/Tenants'
import { Users } from '@/collections/Users'
import { activeDomainTenant } from '@/lib/cache/tenant'

type AnyField = { name?: string; type?: string; fields?: AnyField[]; access?: Record<string, (args: unknown) => unknown> }
/** Breadth-first: a top-level field wins over a same-named sub-field (customDomains[].status vs status). */
function findField(fields: AnyField[], name: string): AnyField | undefined {
    let level = fields
    while (level.length) {
        const hit = level.find((f) => f.name === name)
        if (hit) return hit
        level = level.flatMap((f) => f.fields ?? [])
    }
    return undefined
}
const owner = { user: { id: 1, roles: ['tenant-owner'], tenants: [{ tenant: 5, role: 'owner', status: 'active' }] } }
const superAdmin = { user: { id: 9, roles: ['super-admin'], tenants: [] } }

afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
    vi.resetModules()
})

describe('tenant platform fields [TC-PERF-155]', () => {
    const PLATFORM_FIELDS = [
        'plan', 'status', 'customerId', 'serviceId', 'packCode', 'orderId', 'address', 'migrationStatus',
        'stripeCustomerId', 'stripeSubscriptionId', 'stripeAccountId', 'stripeOnboardingComplete',
        'xenditAccountId', 'xenditAccountStatus', 'xenditOnboardingComplete',
        'customDomains', 'previousSlugs', 'allowedWebsites', 'storageUsed', 'storageLimitBytes', 'aiGenerationsCount',
    ]

    it.each(PLATFORM_FIELDS)('%s: a tenant owner\'s REST create / update is refused, a super-admin\'s allowed', (name) => {
        // Arrange
        const field = findField(Tenants.fields as AnyField[], name)

        // Act / Assert — Payload drops a field whose write access is false, so the stored value stays
        for (const op of ['create', 'update']) {
            expect(field?.access?.[op]?.({ req: owner }), `${name}.${op} owner`).toBe(false)
            expect(field?.access?.[op]?.({ req: { user: null } }), `${name}.${op} anonymous`).toBe(false)
            expect(field?.access?.[op]?.({ req: superAdmin }), `${name}.${op} super-admin`).toBe(true)
        }
    })

    it('leaves the shop\'s own settings fields to the shop (name stays writable)', () => {
        expect(findField(Tenants.fields as AnyField[], 'name')?.access?.update).toBeUndefined()
    })
})

describe('custom domain must be verified [TC-PERF-156]', () => {
    const tenant = (entries: Array<{ domain: string; status: string }>) => ({ id: 5, customDomains: entries })

    it('serves an active domain', () => {
        expect(activeDomainTenant(tenant([{ domain: 'shop.my', status: 'active' }]), 'shop.my')).toMatchObject({ id: 5 })
    })

    it('does not serve a pending domain, even when another domain of the shop is active', () => {
        expect(activeDomainTenant(tenant([{ domain: 'shop.my', status: 'pending' }]), 'shop.my')).toBeNull()
        expect(activeDomainTenant(tenant([
            { domain: 'shop.my', status: 'pending' },
            { domain: 'other.my', status: 'active' },
        ]), 'shop.my')).toBeNull()
        expect(activeDomainTenant(null, 'shop.my')).toBeNull()
    })
})

describe('local-IP image optimisation [TC-PERF-157]', () => {
    it.each([
        ['production', false],
        ['development', true],
        ['test', true],
    ])('NODE_ENV=%s → dangerouslyAllowLocalIP %s', async (env, expected) => {
        // Arrange
        vi.stubEnv('NODE_ENV', env)
        vi.resetModules()

        // Act
        const config = (await import('../../../../next.config')).default as { images?: { dangerouslyAllowLocalIP?: boolean } }

        // Assert
        expect(config.images?.dangerouslyAllowLocalIP).toBe(expected)
    })
})

describe('QC rate-limit bypass stamp [TC-PERF-158]', () => {
    beforeEach(() => {
        for (const k of ['UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN', 'KV_REST_API_URL', 'KV_REST_API_TOKEN']) vi.stubEnv(k, '')
        vi.stubEnv('QC_RATELIMIT_BYPASS_ENABLED', 'true')
    })

    it('does not bypass on NEXT_PUBLIC_APP_ENV=qc-test alone', async () => {
        vi.stubEnv('APP_ENV', '')
        vi.stubEnv('NEXT_PUBLIC_APP_ENV', 'qc-test')
        const { checkRateLimit } = await import('@/lib/rateLimit')

        await checkRateLimit('tc158-a', 1, 60_000)
        expect((await checkRateLimit('tc158-a', 1, 60_000)).allowed).toBe(false)
    })

    it('bypasses on the server APP_ENV=qc-test', async () => {
        vi.stubEnv('APP_ENV', 'qc-test')
        const { checkRateLimit } = await import('@/lib/rateLimit')

        await checkRateLimit('tc158-b', 1, 60_000)
        expect((await checkRateLimit('tc158-b', 1, 60_000)).allowed).toBe(true)
    })
})

describe('outbound email limits: OTP send limits fall back to memory [TC-PERF-159, TC-PERF-182]', () => {
    it('OTP IP and address limits keep their limits and fall back to memory with a loud log (TC-PERF-182)', async () => {
        // Arrange
        const checkRateLimit = vi.fn(async () => ({ allowed: true, remaining: 1, resetAt: 0 }))
        vi.doMock('@/lib/rateLimit', () => ({ checkRateLimit }))
        const { checkOtpSendEmail, checkOtpSendIp } = await import('@/lib/email/outbound-email-limits')

        // Act
        const byIp = await checkOtpSendIp('203.0.113.9')
        const byEmail = await checkOtpSendEmail(' Owner@Shop.my ')

        // Assert
        expect(byIp).toEqual({ allowed: true })
        expect(byEmail).toEqual({ allowed: true })
        const fallback = { onMemoryFallback: expect.any(Function) }
        expect(checkRateLimit).toHaveBeenCalledWith('email:otp-ip:203.0.113.9', 30, 600_000, fallback)
        expect(checkRateLimit).toHaveBeenCalledWith('email:otp:owner@shop.my', 5, 900_000, fallback)
        for (const call of checkRateLimit.mock.calls as unknown as Array<[string, number, number, { failClosed?: boolean }]>) {
            expect(call[3].failClosed).toBeUndefined()
        }

        checkRateLimit.mockResolvedValueOnce({ allowed: false, remaining: 0, resetAt: Date.now() + 60_000 })
        expect(await checkOtpSendIp('203.0.113.9')).toEqual({ allowed: false, retryAfter: 60 })
        vi.doUnmock('@/lib/rateLimit')
    })
})

describe('user identity / audit fields [TC-PERF-160]', () => {
    it.each(['customerIdNumber', 'updatedBy', 'createdBy'])('%s cannot be written by a request (super-admin aside)', (name) => {
        const field = findField(Users.fields as AnyField[], name)

        for (const op of ['create', 'update']) {
            expect(field?.access?.[op]?.({ req: owner })).toBe(false)
            expect(field?.access?.[op]?.({ req: { user: null } })).toBe(false)
        }
        expect(field?.access?.create?.({ req: superAdmin })).toBe(true)
    })
})
