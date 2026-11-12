/**
 * TC-F15.42 (banner data), TC-F15.44 (path guard), TC-F15.45 (support page redirect, recent list).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SignJWT } from 'jose'

const { getCurrentUser, redirect } = vi.hoisted(() => ({
    getCurrentUser: vi.fn(),
    redirect: vi.fn((to: string) => {
        throw new Error(`REDIRECT:${to}`)
    }),
}))
vi.mock('@/lib/auth', () => ({ getCurrentUser, authUnavailableResponse: vi.fn(), isAuthUnavailableError: () => false }))
vi.mock('next/navigation', () => ({ redirect, useRouter: () => ({ refresh: vi.fn() }) }))

import { getMerchantAccessBanner } from '@/lib/support/merchant-access-banner'
import { listRecentMerchantAccessEvents, recentAccessStatus } from '@/lib/support/merchant-access-recent'
import { signMerchantSessionToken } from '@/lib/support/merchant-access-token'
import { isSuperAdminOnlyStudioPath } from '@/lib/admin/studio-roles'
import MerchantAccessSupportPage from '@/app/support/merchant-access/page'

const SECRET = 'test-secret'

async function sign(claims: Record<string, unknown>, secret = SECRET) {
    return new SignJWT({ id: 5, email: 'owner@shop.test', collection: 'users', ...claims })
        .setProtectedHeader({ alg: 'HS256' })
        .setExpirationTime('4h')
        .sign(new TextEncoder().encode(secret))
}

beforeEach(() => {
    vi.clearAllMocks()
    process.env.PAYLOAD_SECRET = SECRET
})

describe('[TC-F15.42] getMerchantAccessBanner', () => {
    it('TC-F15.42: returns merchant, actor and expiry for a signed impersonation session', async () => {
        const token = await sign({ impersonated_by: 1, impersonated_by_email: 'ben@primecommerce.asia' })
        const banner = await getMerchantAccessBanner(token)
        expect(banner).toMatchObject({ merchantEmail: 'owner@shop.test', actorEmail: 'ben@primecommerce.asia' })
        expect(new Date(banner!.expiresAt).getTime()).toBeGreaterThan(Date.now())
    })

    it('TC-F15.42: works on a token minted by the real session signer (no email claim yet is tolerated)', async () => {
        const token = await signMerchantSessionToken({ id: 5, email: 'owner@shop.test' }, 1)
        const banner = await getMerchantAccessBanner(token)
        expect(banner?.merchantEmail).toBe('owner@shop.test')
        expect(banner?.actorEmail).toBeTruthy()
    })

    it('TC-F15.42: falls back to "Prime Support" when the email claim is missing', async () => {
        const banner = await getMerchantAccessBanner(await sign({ impersonated_by: 1 }))
        expect(banner?.actorEmail).toBe('Prime Support')
    })

    it('TC-F15.42: a normal merchant session has no banner', async () => {
        expect(await getMerchantAccessBanner(await sign({ mfa_verified: true }))).toBeNull()
    })

    it('TC-F15.42: bad signature, garbage, empty and missing secret all return null without throwing', async () => {
        expect(await getMerchantAccessBanner(await sign({ impersonated_by: 1 }, 'other-secret'))).toBeNull()
        expect(await getMerchantAccessBanner('not.a.jwt')).toBeNull()
        expect(await getMerchantAccessBanner(undefined)).toBeNull()
        expect(await getMerchantAccessBanner('')).toBeNull()
        const token = await sign({ impersonated_by: 1 })
        delete process.env.PAYLOAD_SECRET
        expect(await getMerchantAccessBanner(token)).toBeNull()
    })
})

describe('[TC-F15.44] viewer cannot open the Studio merchant access page', () => {
    it('TC-F15.44: /studio/merchant-access is a super-admin-only path', () => {
        expect(isSuperAdminOnlyStudioPath('/studio/merchant-access')).toBe(true)
        expect(isSuperAdminOnlyStudioPath('/studio/merchant-accessx')).toBe(false)
    })
})

describe('[TC-F15.45] support page + recent access list', () => {
    it('TC-F15.45: a super-admin opening /support/merchant-access is sent to the Studio page', async () => {
        getCurrentUser.mockResolvedValue({ id: 1, email: 'ben@primecommerce.asia', roles: ['super-admin'] })
        await expect(MerchantAccessSupportPage()).rejects.toThrow('REDIRECT:/studio/merchant-access')
    })

    it('TC-F15.45: the support role keeps the standalone page', async () => {
        getCurrentUser.mockResolvedValue({ id: 2, email: 'help@primecommerce.asia', roles: ['support'] })
        await expect(MerchantAccessSupportPage()).resolves.toBeTruthy()
        expect(redirect).not.toHaveBeenCalled()
    })

    it('TC-F15.45: statuses map to opened / expired / unused, opened wins over expired', () => {
        const now = new Date('2026-11-10T12:00:00Z')
        expect(recentAccessStatus({ usedAt: '2026-11-10T11:00:00Z', expiresAt: '2026-11-10T11:10:00Z' }, now)).toBe('opened')
        expect(recentAccessStatus({ usedAt: null, expiresAt: '2026-11-10T11:10:00Z' }, now)).toBe('expired')
        expect(recentAccessStatus({ usedAt: null, expiresAt: '2026-11-10T12:05:00Z' }, now)).toBe('unused')
    })

    it('TC-F15.45: lists newest events with the limit bound and ISO dates', async () => {
        const execute = vi.fn().mockResolvedValue({
            rows: [{ id: '7', created_at: new Date('2026-11-10T10:00:00Z'), actor_email: 'a@p.test', target_email: 'm@s.test', expires_at: '2026-11-10T10:10:00Z', used_at: null }],
        })
        const events = await listRecentMerchantAccessEvents({ db: { drizzle: { execute } } } as never, 20)
        expect(execute).toHaveBeenCalledTimes(1)
        expect(events).toEqual([{ id: 7, createdAt: '2026-11-10T10:00:00.000Z', actorEmail: 'a@p.test', targetEmail: 'm@s.test', expiresAt: '2026-11-10T10:10:00.000Z', usedAt: null }])
    })

    it('TC-F15.45: throws when the database handle is unavailable', async () => {
        await expect(listRecentMerchantAccessEvents({ db: {} } as never)).rejects.toThrow('database handle unavailable')
    })
})
