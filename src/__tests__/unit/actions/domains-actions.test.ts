import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ─── Mocks (top of file per convention) ───────────────────────────────

vi.mock('@/lib/auth', () => ({
    getCurrentTenantId: vi.fn(),
}))

const mockFindByID = vi.fn()
const mockFind = vi.fn()
const mockUpdate = vi.fn()
vi.mock('@payloadcms/next/utilities', () => ({
    getPayloadHMR: vi.fn(() => Promise.resolve({
        findByID: mockFindByID,
        find: mockFind,
        update: mockUpdate,
    })),
}))
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

vi.mock('@/lib/vercel/domains', () => ({
    addProjectDomain: vi.fn(),
    verifyProjectDomain: vi.fn(),
    getProjectDomain: vi.fn(),
    removeProjectDomain: vi.fn(),
    isMockMode: vi.fn().mockReturnValue(false),
}))

vi.mock('@/lib/vercel/dns-check', () => ({
    checkDnsRouting: vi.fn().mockResolvedValue({ ok: true }),
    checkHttpsConnectivity: vi.fn().mockResolvedValue({ ok: true }),
}))

vi.mock('@/lib/subscriptions/plan-subscription', () => ({
    getActivePlanSubscription: vi.fn().mockResolvedValue({
        id: 'mock-sub-1',
        plan: 'PROFESSIONAL_TM_USER',
        status: 'active',
        startDate: '2026-01-01T00:00:00.000Z',
    }),
    isSubscriptionActive: vi.fn().mockReturnValue(true),
    canUse: vi.fn().mockResolvedValue(true),
    canUseWithinLimit: vi.fn().mockResolvedValue(true),
    recordUsage: vi.fn().mockResolvedValue(undefined),
    reduceUsage: vi.fn().mockResolvedValue(undefined),
    getConsumed: vi.fn().mockResolvedValue(0),
}))

vi.mock('@/lib/subscriptions/feature-guard', () => ({
    withFeatureGuard: vi.fn(() => (h: any) => h),
}))

import { getCurrentTenantId } from '@/lib/auth'
import {
    addCustomDomain,
    removeCustomDomain,
    verifyCustomDomain,
    setPrimaryDomain,
    clearPrimaryDomain,
} from '@/app/(dashboard)/settings/domains/actions'
import {
    addProjectDomain,
    verifyProjectDomain,
    getProjectDomain,
    removeProjectDomain,
    isMockMode,
} from '@/lib/vercel/domains'
import { checkDnsRouting, checkHttpsConnectivity } from '@/lib/vercel/dns-check'
import { VercelDomainsError } from '@/lib/vercel/domains.types'
import type { VercelDomain } from '@/lib/vercel/domains.types'

// ─── Fixtures ─────────────────────────────────────────────────────────

function makeVercelDomain(overrides: Partial<VercelDomain> = {}): VercelDomain {
    return {
        name: 'example.com',
        apexName: 'example.com',
        projectId: 'prj_test',
        verified: true,
        createdAt: 0,
        updatedAt: 0,
        ...overrides,
    }
}

const TXT_CHALLENGE = [{ type: 'TXT', domain: '_vercel.example.com', value: 'vc-abc123' }]

// ─── addCustomDomain ──────────────────────────────────────────────────

describe('addCustomDomain — validation [TC-F19.02, TC-F19.03]', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.stubEnv('VERCEL_TOKEN', 'test-token')
        vi.mocked(getCurrentTenantId).mockResolvedValue('tenant-1')
        mockFindByID.mockResolvedValue({ id: 'tenant-1', customDomains: [] })
        mockFind.mockResolvedValue({ docs: [] })
        mockUpdate.mockResolvedValue({})
    })

    afterEach(() => vi.unstubAllEnvs())

    it('returns Unauthorized when not authenticated', async () => {
        vi.mocked(getCurrentTenantId).mockResolvedValue(null)
        const res = await addCustomDomain('test.com')
        expect(res).toMatchObject({ success: false, error: 'Unauthorized' })
    })

    it('rejects invalid domain format (spaces) [TC-F19.02]', async () => {
        const res = await addCustomDomain('my store.com')
        expect(res).toMatchObject({ success: false })
        if (!res.success) expect(res.error).toContain('Invalid domain')
        expect(addProjectDomain).not.toHaveBeenCalled()
    })

    it('rejects invalid domain format (special chars) [TC-F19.02]', async () => {
        const res = await addCustomDomain('not a domain!!!')
        expect(res).toMatchObject({ success: false })
        if (!res.success) expect(res.error).toContain('Invalid domain')
    })

    it('strips https:// prefix before validation [TC-F19.02]', async () => {
        vi.mocked(addProjectDomain).mockResolvedValueOnce(
            makeVercelDomain({ name: 'valid.com', apexName: 'valid.com' }),
        )
        const res = await addCustomDomain('https://valid.com')
        expect(res.success).toBe(true)
        expect(addProjectDomain).toHaveBeenCalledWith('valid.com')
    })

    it('rejects domain already registered by another tenant [TC-F19.03]', async () => {
        mockFind.mockResolvedValueOnce({ docs: [{ id: 'other-tenant' }] })
        const res = await addCustomDomain('taken.com')
        expect(res).toMatchObject({ success: false })
        if (!res.success) expect(res.error).toContain('another store')
        expect(addProjectDomain).not.toHaveBeenCalled()
    })

    it('rejects domain already added to same tenant', async () => {
        mockFindByID.mockResolvedValue({
            id: 'tenant-1',
            customDomains: [{ domain: 'existing.com', status: 'active' }],
        })
        const res = await addCustomDomain('existing.com')
        expect(res).toMatchObject({ success: false })
        if (!res.success) expect(res.error).toContain('already added')
    })
})

describe('addCustomDomain — success path [TC-F19.02]', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.stubEnv('VERCEL_TOKEN', 'test-token')
        vi.mocked(getCurrentTenantId).mockResolvedValue('tenant-1')
        mockFindByID.mockResolvedValue({ id: 'tenant-1', customDomains: [] })
        mockFind.mockResolvedValue({ docs: [] })
        mockUpdate.mockResolvedValue({})
    })

    afterEach(() => vi.unstubAllEnvs())

    it('saves domain as pending even when Vercel returns verified=true', async () => {
        vi.mocked(addProjectDomain).mockResolvedValueOnce(
            makeVercelDomain({ name: 'shop.example.com', verified: true }),
        )
        const res = await addCustomDomain('shop.example.com')
        expect(res.success).toBe(true)
        const finalCall = mockUpdate.mock.calls.at(-1)?.[0]
        expect(finalCall.data.customDomains[0]).toMatchObject({
            domain: 'shop.example.com',
            status: 'pending',
        })
    })

    it('returns verification[] when Vercel requires TXT challenge', async () => {
        vi.mocked(addProjectDomain).mockResolvedValueOnce(
            makeVercelDomain({ verified: false, verification: TXT_CHALLENGE }),
        )
        const res = await addCustomDomain('newdomain.com')
        expect(res.success).toBe(true)
        if (res.success) expect(res.verification).toEqual(TXT_CHALLENGE)
    })

    it('saves vercelVerification when TXT challenge returned', async () => {
        vi.mocked(addProjectDomain).mockResolvedValueOnce(
            makeVercelDomain({ verified: false, verification: TXT_CHALLENGE }),
        )
        await addCustomDomain('newdomain.com')
        const finalCall = mockUpdate.mock.calls.at(-1)?.[0]
        expect(finalCall.data.customDomains[0].vercelVerification).toEqual(TXT_CHALLENGE)
    })
})

describe('addCustomDomain — error handling & rollback', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.stubEnv('VERCEL_TOKEN', 'test-token')
        vi.mocked(getCurrentTenantId).mockResolvedValue('tenant-1')
        mockFindByID.mockResolvedValue({ id: 'tenant-1', customDomains: [] })
        mockFind.mockResolvedValue({ docs: [] })
        mockUpdate.mockResolvedValue({})
    })

    afterEach(() => vi.unstubAllEnvs())

    it('rolls back Payload when Vercel fails after optimistic write', async () => {
        vi.mocked(addProjectDomain).mockRejectedValueOnce(new Error('network'))
        const res = await addCustomDomain('domain.com')
        expect(res.success).toBe(false)
        // optimistic write + rollback = 2 calls
        expect(mockUpdate).toHaveBeenCalledTimes(2)
        const rollbackCall = mockUpdate.mock.calls.at(-1)?.[0]
        expect(rollbackCall.data.customDomains).toEqual([])
    })

    it('maps Vercel 409 domain_already_in_use to user-safe message', async () => {
        const err = new VercelDomainsError({ code: 'domain_already_in_use', status: 409, message: 'taken' })
        vi.mocked(addProjectDomain).mockRejectedValueOnce(err)
        const res = await addCustomDomain('taken.com')
        expect(res).toMatchObject({ success: false })
        if (!res.success) expect(res.error).toContain('another store')
    })

    it('maps Vercel 429 rate limit to user-safe message', async () => {
        const err = new VercelDomainsError({ code: 'rate_limited', status: 429, message: 'slow down', retryAfter: 30 })
        vi.mocked(addProjectDomain).mockRejectedValueOnce(err)
        const res = await addCustomDomain('slow.com')
        expect(res).toMatchObject({ success: false })
        if (!res.success) expect(res.error).toContain('Too many requests')
    })

    it('maps Vercel 5xx to generic message', async () => {
        const err = new VercelDomainsError({ code: 'server_error', status: 503, message: 'unavailable' })
        vi.mocked(addProjectDomain).mockRejectedValueOnce(err)
        const res = await addCustomDomain('fail.com')
        expect(res).toMatchObject({ success: false })
        if (!res.success) expect(res.error).toContain('temporarily unavailable')
    })

    it('removes from Vercel when Payload final write fails', async () => {
        vi.mocked(addProjectDomain).mockResolvedValueOnce(makeVercelDomain())
        // optimistic write ok, final write fails
        mockUpdate
            .mockResolvedValueOnce({})
            .mockRejectedValueOnce(new Error('db fail'))
        vi.mocked(removeProjectDomain).mockResolvedValueOnce(undefined)

        const res = await addCustomDomain('domain.com')
        expect(res.success).toBe(false)
        expect(removeProjectDomain).toHaveBeenCalledWith('domain.com')
    })
})

// ─── verifyCustomDomain ───────────────────────────────────────────────

describe('verifyCustomDomain — guard checks', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.mocked(isMockMode).mockReturnValue(false)
        vi.mocked(checkDnsRouting).mockResolvedValue({ ok: true })
        vi.mocked(checkHttpsConnectivity).mockResolvedValue({ ok: true })
    })

    it('returns Unauthorized when not authenticated', async () => {
        vi.mocked(getCurrentTenantId).mockResolvedValue(null)
        const res = await verifyCustomDomain('example.com')
        expect(res).toMatchObject({ success: false, error: 'Unauthorized' })
    })

    it('returns error when domain not in tenant [TC-F19.11]', async () => {
        vi.mocked(getCurrentTenantId).mockResolvedValue('tenant-1')
        mockFindByID.mockResolvedValue({ id: 'tenant-1', customDomains: [] })
        const res = await verifyCustomDomain('notmine.com')
        expect(res).toMatchObject({ success: false })
        if (!res.success) expect(res.error).toContain('not found')
    })

    it('returns success immediately when domain already active (idempotent)', async () => {
        vi.mocked(getCurrentTenantId).mockResolvedValue('tenant-1')
        mockFindByID.mockResolvedValue({
            id: 'tenant-1',
            customDomains: [{ domain: 'already.com', status: 'active' }],
        })
        const res = await verifyCustomDomain('already.com')
        expect(res.success).toBe(true)
        expect(verifyProjectDomain).not.toHaveBeenCalled()
    })
})

describe('verifyCustomDomain — Vercel ownership check fails', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.mocked(getCurrentTenantId).mockResolvedValue('tenant-1')
        vi.mocked(isMockMode).mockReturnValue(false)
        mockFindByID.mockResolvedValue({
            id: 'tenant-1',
            customDomains: [{ domain: 'example.com', status: 'pending', vercelVerification: TXT_CHALLENGE }],
        })
        mockUpdate.mockResolvedValue({})
    })

    it('returns TXT challenges when verified=false [TC-F19.11]', async () => {
        vi.mocked(verifyProjectDomain).mockResolvedValueOnce(
            makeVercelDomain({ verified: false, verification: TXT_CHALLENGE }),
        )
        const res = await verifyCustomDomain('example.com')
        expect(res).toMatchObject({ success: false })
        if (!res.success) {
            expect(res.verification).toEqual(TXT_CHALLENGE)
            expect(res.error).toContain('TXT record')
        }
    })

    it('fetches fresh challenges on Vercel 400 [TC-F19.11]', async () => {
        vi.mocked(verifyProjectDomain).mockRejectedValueOnce(
            new VercelDomainsError({ code: 'invalid_domain', status: 400, message: 'bad request' }),
        )
        vi.mocked(getProjectDomain).mockResolvedValueOnce(
            makeVercelDomain({ verified: false, verification: TXT_CHALLENGE }),
        )
        const res = await verifyCustomDomain('example.com')
        expect(res).toMatchObject({ success: false })
        expect(getProjectDomain).toHaveBeenCalledWith('example.com')
        if (!res.success) expect(res.verification).toEqual(TXT_CHALLENGE)
    })
})

describe('verifyCustomDomain — ownership OK, DNS/HTTPS gates [TC-F19.12, TC-F19.16]', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.mocked(getCurrentTenantId).mockResolvedValue('tenant-1')
        vi.mocked(isMockMode).mockReturnValue(false)
        mockFindByID.mockResolvedValue({
            id: 'tenant-1',
            customDomains: [{ domain: 'example.com', status: 'pending' }],
        })
        mockUpdate.mockResolvedValue({})
        vi.mocked(verifyProjectDomain).mockResolvedValue(
            makeVercelDomain({ verified: true, verification: [] }),
        )
    })

    it('clears TXT card immediately when Vercel confirms ownership', async () => {
        vi.mocked(checkDnsRouting).mockResolvedValueOnce({ ok: false, message: 'DNS not set' })
        await verifyCustomDomain('example.com')
        const firstWrite = mockUpdate.mock.calls[0]?.[0]
        expect(firstWrite.data.customDomains[0].vercelVerification).toBeNull()
    })

    it('returns error with ownershipConfirmed when DNS not routing [TC-F19.16]', async () => {
        vi.mocked(checkDnsRouting).mockResolvedValueOnce({
            ok: false,
            message: 'A record not pointing to Vercel. Expected: 76.76.21.21 — currently: 1.2.3.4',
        })
        const res = await verifyCustomDomain('example.com')
        expect(res).toMatchObject({ success: false, ownershipConfirmed: true })
        if (!res.success) expect(res.error).toContain('76.76.21.21')
    })

    it('returns error with ownershipConfirmed when DNS not set [TC-F19.11]', async () => {
        vi.mocked(checkDnsRouting).mockResolvedValueOnce({
            ok: false,
            message: 'A record not pointing to Vercel. Expected: 76.76.21.21 — currently: none',
        })
        const res = await verifyCustomDomain('example.com')
        expect(res).toMatchObject({ success: false, ownershipConfirmed: true })
        if (!res.success) expect(res.error).toContain('none')
    })

    it('returns SSL error with ownershipConfirmed when HTTPS probe fails [TC-F19.13]', async () => {
        vi.mocked(checkDnsRouting).mockResolvedValueOnce({ ok: true })
        vi.mocked(checkHttpsConnectivity).mockResolvedValueOnce({
            ok: false,
            message: 'SSL certificate is being provisioned. Please try again in 1–2 minutes.',
        })
        const res = await verifyCustomDomain('example.com')
        expect(res).toMatchObject({ success: false, ownershipConfirmed: true })
        if (!res.success) expect(res.error).toContain('SSL')
    })

    it('returns not-accessible error when domain unreachable [TC-F19.12]', async () => {
        vi.mocked(checkDnsRouting).mockResolvedValueOnce({ ok: true })
        vi.mocked(checkHttpsConnectivity).mockResolvedValueOnce({
            ok: false,
            message: 'Domain is not yet accessible. Please try again in a few minutes.',
        })
        const res = await verifyCustomDomain('example.com')
        expect(res).toMatchObject({ success: false, ownershipConfirmed: true })
        if (!res.success) expect(res.error).toContain('accessible')
    })

    it('marks domain active when all 3 gates pass [TC-F19.12]', async () => {
        vi.mocked(checkDnsRouting).mockResolvedValueOnce({ ok: true })
        vi.mocked(checkHttpsConnectivity).mockResolvedValueOnce({ ok: true })
        const res = await verifyCustomDomain('example.com')
        expect(res.success).toBe(true)
        // second write = mark active
        const activeWrite = mockUpdate.mock.calls.at(-1)?.[0]
        expect(activeWrite.data.customDomains[0]).toMatchObject({
            domain: 'example.com',
            status: 'active',
        })
    })

    it('skips DNS and HTTPS checks in mock mode [TC-F19.17]', async () => {
        vi.mocked(isMockMode).mockReturnValue(true)
        const res = await verifyCustomDomain('example.com')
        expect(res.success).toBe(true)
        expect(checkDnsRouting).not.toHaveBeenCalled()
        expect(checkHttpsConnectivity).not.toHaveBeenCalled()
    })

    it('returns error with ownershipConfirmed when Write-1 (clear TXT) fails', async () => {
        // Write-1 fails — must not continue silently to DNS/HTTPS checks
        mockUpdate.mockRejectedValueOnce(new Error('db timeout'))
        const res = await verifyCustomDomain('example.com')
        expect(res).toMatchObject({ success: false, ownershipConfirmed: true })
        if (!res.success) expect(res.error).toContain('Please try again')
        // DNS and HTTPS should NOT have been called
        expect(checkDnsRouting).not.toHaveBeenCalled()
        expect(checkHttpsConnectivity).not.toHaveBeenCalled()
    })

    it('returns error when domain removed concurrently between Write-1 and Write-2 (zombie guard)', async () => {
        vi.mocked(checkDnsRouting).mockResolvedValueOnce({ ok: true })
        vi.mocked(checkHttpsConnectivity).mockResolvedValueOnce({ ok: true })
        // Write-1 succeeds; then fresh re-fetch returns empty list (domain was removed)
        mockUpdate.mockResolvedValueOnce({})
        mockFindByID
            .mockResolvedValueOnce({ id: 'tenant-1', customDomains: [{ domain: 'example.com', status: 'pending' }] })
            .mockResolvedValueOnce({ id: 'tenant-1', customDomains: [] }) // concurrent remove
        const res = await verifyCustomDomain('example.com')
        expect(res).toMatchObject({ success: false })
        if (!res.success) expect(res.error).toContain('removed')
        // Write-2 must NOT have been called (domain gone)
        expect(mockUpdate).toHaveBeenCalledTimes(1)
    })
})

describe('verifyCustomDomain — retry after DNS fix [TC-F19.17]', () => {
    it('first verify fails (DNS wrong), second verify succeeds after fix', async () => {
        vi.mocked(getCurrentTenantId).mockResolvedValue('tenant-1')
        vi.mocked(isMockMode).mockReturnValue(false)
        mockFindByID.mockResolvedValue({
            id: 'tenant-1',
            customDomains: [{ domain: 'example.com', status: 'pending' }],
        })
        mockUpdate.mockResolvedValue({})
        vi.mocked(verifyProjectDomain).mockResolvedValue(
            makeVercelDomain({ verified: true, verification: [] }),
        )

        vi.mocked(checkDnsRouting)
            .mockResolvedValueOnce({ ok: false, message: 'A record wrong' })
            .mockResolvedValueOnce({ ok: true })
        vi.mocked(checkHttpsConnectivity).mockResolvedValue({ ok: true })

        const first = await verifyCustomDomain('example.com')
        expect(first.success).toBe(false)

        // simulate user fixed DNS — findByID still returns pending
        const second = await verifyCustomDomain('example.com')
        expect(second.success).toBe(true)
    })
})

// ─── removeCustomDomain ───────────────────────────────────────────────

describe('removeCustomDomain [TC-F19.14, TC-F19.62]', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.mocked(getCurrentTenantId).mockResolvedValue('tenant-1')
        mockUpdate.mockResolvedValue({})
    })

    it('returns Unauthorized when not authenticated', async () => {
        vi.mocked(getCurrentTenantId).mockResolvedValue(null)
        const res = await removeCustomDomain('test.com')
        expect(res).toMatchObject({ success: false, error: 'Unauthorized' })
    })

    it('returns error when domain not found in tenant', async () => {
        mockFindByID.mockResolvedValue({ id: 'tenant-1', customDomains: [] })
        const res = await removeCustomDomain('notmine.com')
        expect(res).toMatchObject({ success: false })
        if (!res.success) expect(res.error).toContain('not found')
    })

    it('blocks removal of primary domain [TC-F19.14]', async () => {
        mockFindByID.mockResolvedValue({
            id: 'tenant-1',
            customDomains: [{ domain: 'primary.com', status: 'active', isPrimary: true }],
        })
        const res = await removeCustomDomain('primary.com')
        expect(res).toMatchObject({ success: false })
        if (!res.success) expect(res.error).toContain('primary')
        expect(mockUpdate).not.toHaveBeenCalled()
    })

    it('removes domain from Payload and calls Vercel cleanup [TC-F19.62]', async () => {
        mockFindByID.mockResolvedValue({
            id: 'tenant-1',
            customDomains: [
                { domain: 'keep.com', status: 'active' },
                { domain: 'remove.com', status: 'active' },
            ],
        })
        vi.mocked(removeProjectDomain).mockResolvedValueOnce(undefined)

        const res = await removeCustomDomain('remove.com')
        expect(res.success).toBe(true)
        const updatedList = mockUpdate.mock.calls[0]?.[0].data.customDomains
        expect(updatedList).toEqual([{ domain: 'keep.com', status: 'active' }])
        expect(removeProjectDomain).toHaveBeenCalledWith('remove.com')
    })

    it('succeeds even when Vercel returns 404 (idempotent)', async () => {
        mockFindByID.mockResolvedValue({
            id: 'tenant-1',
            customDomains: [{ domain: 'gone.com', status: 'active' }],
        })
        vi.mocked(removeProjectDomain).mockRejectedValueOnce(
            new VercelDomainsError({ code: 'not_found', status: 404, message: 'not found' }),
        )
        const res = await removeCustomDomain('gone.com')
        expect(res.success).toBe(true)
    })

    it('succeeds even when Vercel returns 5xx (Payload already cleared)', async () => {
        mockFindByID.mockResolvedValue({
            id: 'tenant-1',
            customDomains: [{ domain: 'flaky.com', status: 'active' }],
        })
        vi.mocked(removeProjectDomain).mockRejectedValueOnce(
            new VercelDomainsError({ code: 'server_error', status: 503, message: 'unavailable' }),
        )
        const res = await removeCustomDomain('flaky.com')
        expect(res.success).toBe(true)
    })
})

// ─── setPrimaryDomain ─────────────────────────────────────────────────

describe('setPrimaryDomain [TC-F19.58]', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.mocked(getCurrentTenantId).mockResolvedValue('tenant-1')
        mockUpdate.mockResolvedValue({})
    })

    it('returns Unauthorized when not authenticated', async () => {
        vi.mocked(getCurrentTenantId).mockResolvedValue(null)
        const res = await setPrimaryDomain('a.com')
        expect(res).toMatchObject({ success: false, error: 'Unauthorized' })
    })

    it('rejects setting pending domain as primary', async () => {
        mockFindByID.mockResolvedValue({
            id: 'tenant-1',
            customDomains: [{ domain: 'pending.com', status: 'pending' }],
        })
        const res = await setPrimaryDomain('pending.com')
        expect(res).toMatchObject({ success: false })
        if (!res.success) expect(res.error).toContain('verified')
    })

    it('rejects domain not found', async () => {
        mockFindByID.mockResolvedValue({ id: 'tenant-1', customDomains: [] })
        const res = await setPrimaryDomain('notfound.com')
        expect(res).toMatchObject({ success: false })
    })

    it('sets active domain as primary, clears others', async () => {
        mockFindByID.mockResolvedValue({
            id: 'tenant-1',
            customDomains: [
                { domain: 'a.com', status: 'active', isPrimary: true },
                { domain: 'b.com', status: 'active', isPrimary: false },
            ],
        })
        const res = await setPrimaryDomain('b.com')
        expect(res.success).toBe(true)
        const updated = mockUpdate.mock.calls[0]?.[0].data.customDomains
        expect(updated).toEqual([
            { domain: 'a.com', status: 'active', isPrimary: false },
            { domain: 'b.com', status: 'active', isPrimary: true },
        ])
    })
})

// ─── clearPrimaryDomain ───────────────────────────────────────────────

describe('clearPrimaryDomain', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.mocked(getCurrentTenantId).mockResolvedValue('tenant-1')
        mockUpdate.mockResolvedValue({})
    })

    it('returns Unauthorized when not authenticated', async () => {
        vi.mocked(getCurrentTenantId).mockResolvedValue(null)
        const res = await clearPrimaryDomain()
        expect(res).toMatchObject({ success: false, error: 'Unauthorized' })
    })

    it('clears isPrimary on all domains → platform subdomain becomes default', async () => {
        mockFindByID.mockResolvedValue({
            id: 'tenant-1',
            customDomains: [
                { domain: 'a.com', status: 'active', isPrimary: true },
                { domain: 'b.com', status: 'active', isPrimary: false },
            ],
        })
        const res = await clearPrimaryDomain()
        expect(res.success).toBe(true)
        const updated = mockUpdate.mock.calls[0]?.[0].data.customDomains
        expect(updated.every((d: { isPrimary: boolean }) => d.isPrimary === false)).toBe(true)
    })
})
