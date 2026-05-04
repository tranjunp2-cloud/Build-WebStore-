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

// Post-DO migration: mock the Vercel domains client. We keep the real
// VercelDomainsError class (imported below) so `instanceof` checks work.
vi.mock('@/lib/vercel/domains', () => ({
    addProjectDomain: vi.fn(),
    verifyProjectDomain: vi.fn(),
    getProjectDomain: vi.fn(),
    removeProjectDomain: vi.fn(),
}))

// Action's soft DNS pre-flight — must never hard-fail tests.
vi.mock('dns', () => {
    const promises = {
        resolve4: vi.fn().mockResolvedValue(['76.76.21.21']),
        resolveCname: vi.fn().mockResolvedValue(['cname.vercel-dns.com']),
    }
    return { default: { promises }, promises }
})

import { getCurrentTenantId } from '@/lib/auth'
import {
    addCustomDomain,
    removeCustomDomain,
    setPrimaryDomain,
    clearPrimaryDomain,
} from '@/app/(dashboard)/settings/domains/actions'
import {
    addProjectDomain,
    removeProjectDomain,
} from '@/lib/vercel/domains'
import type { VercelDomain } from '@/lib/vercel/domains.types'

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

describe('addCustomDomain [TC-F19.02, TC-F19.03]', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.stubEnv('VERCEL_TOKEN', 'test-token')
        vi.stubEnv('VERCEL_TEAM_ID', 'team_test')
        vi.stubEnv('VERCEL_PROJECT_ID', 'prj_test')
        vi.mocked(getCurrentTenantId).mockResolvedValue('tenant-1')
        mockFindByID.mockResolvedValue({ id: 'tenant-1', customDomains: [] })
        mockFind.mockResolvedValue({ docs: [] })
        mockUpdate.mockResolvedValue({})
    })

    afterEach(() => {
        vi.unstubAllEnvs()
    })

    it('returns error when not authenticated', async () => {
        vi.mocked(getCurrentTenantId).mockResolvedValue(null)
        const result = await addCustomDomain('test.com')
        expect(result.success).toBe(false)
        if (result.success === false) {
            expect(result.error).toBe('Unauthorized')
        }
    })

    it('rejects invalid domain format [TC-F19.02]', async () => {
        const result = await addCustomDomain('not a domain!!!')
        expect(result.success).toBe(false)
        if (result.success === false) {
            expect(result.error).toContain('Invalid domain')
        }
        expect(vi.mocked(addProjectDomain)).not.toHaveBeenCalled()
    })

    it('accepts https:// prefix after sanitization', async () => {
        vi.mocked(addProjectDomain).mockResolvedValueOnce(
            makeVercelDomain({ name: 'valid.com', apexName: 'valid.com', verified: true }),
        )

        const result = await addCustomDomain('https://valid.com')
        expect(result.success).toBe(true)
        expect(vi.mocked(addProjectDomain)).toHaveBeenCalledWith('valid.com')
    })

    it('rejects duplicate domain across tenants [TC-F19.03]', async () => {
        mockFind.mockResolvedValueOnce({ docs: [{ id: 'other-tenant' }] })

        const result = await addCustomDomain('taken.com')
        expect(result.success).toBe(false)
        if (result.success === false) {
            expect(result.error).toContain('already registered')
        }
        expect(vi.mocked(addProjectDomain)).not.toHaveBeenCalled()
    })

    it('rejects duplicate domain within same tenant', async () => {
        mockFindByID.mockResolvedValue({
            id: 'tenant-1',
            customDomains: [{ domain: 'existing.com', status: 'active' }],
        })

        const result = await addCustomDomain('existing.com')
        expect(result.success).toBe(false)
        if (result.success === false) {
            expect(result.error).toContain('already added')
        }
    })

    it('adds valid new domain and persists Vercel result', async () => {
        vi.mocked(addProjectDomain).mockResolvedValueOnce(
            makeVercelDomain({
                name: 'store.example.com',
                apexName: 'example.com',
                verified: true,
            }),
        )

        const result = await addCustomDomain('store.example.com')
        expect(result.success).toBe(true)
        // Last update is the final write with vercelDomainId + status='active'.
        const finalUpdate = mockUpdate.mock.calls.at(-1)?.[0]
        expect(finalUpdate.data.customDomains[0]).toMatchObject({
            domain: 'store.example.com',
            status: 'active',
            vercelDomainId: 'store.example.com',
        })
    })
})

describe('removeCustomDomain [TC-F19.62]', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.stubEnv('VERCEL_TOKEN', 'test-token')
        vi.stubEnv('VERCEL_TEAM_ID', 'team_test')
        vi.stubEnv('VERCEL_PROJECT_ID', 'prj_test')
        vi.mocked(getCurrentTenantId).mockResolvedValue('tenant-1')
    })

    afterEach(() => {
        vi.unstubAllEnvs()
    })

    it('removes domain from tenant and calls Vercel', async () => {
        mockFindByID.mockResolvedValue({
            id: 'tenant-1',
            customDomains: [
                { domain: 'keep.com', status: 'active' },
                { domain: 'remove.com', status: 'active' },
            ],
        })
        mockUpdate.mockResolvedValue({})
        vi.mocked(removeProjectDomain).mockResolvedValueOnce(undefined)

        const result = await removeCustomDomain('remove.com')
        expect(result.success).toBe(true)
        expect(mockUpdate).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    customDomains: [{ domain: 'keep.com', status: 'active' }],
                }),
            }),
        )
        expect(vi.mocked(removeProjectDomain)).toHaveBeenCalledWith('remove.com')
    })

    it('returns error when not authenticated', async () => {
        vi.mocked(getCurrentTenantId).mockResolvedValue(null)
        const result = await removeCustomDomain('test.com')
        expect(result.success).toBe(false)
    })
})

describe('setPrimaryDomain [TC-F19.58]', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.mocked(getCurrentTenantId).mockResolvedValue('tenant-1')
    })

    it('sets active domain as primary', async () => {
        mockFindByID.mockResolvedValue({
            id: 'tenant-1',
            customDomains: [
                { domain: 'a.com', status: 'active', isPrimary: true },
                { domain: 'b.com', status: 'active', isPrimary: false },
            ],
        })
        mockUpdate.mockResolvedValue({})

        const result = await setPrimaryDomain('b.com')
        expect(result.success).toBe(true)
    })

    it('rejects setting pending domain as primary', async () => {
        mockFindByID.mockResolvedValue({
            id: 'tenant-1',
            customDomains: [{ domain: 'pending.com', status: 'pending' }],
        })

        const result = await setPrimaryDomain('pending.com')
        expect(result.success).toBe(false)
        if (result.success === false) {
            expect(result.error).toContain('verified')
        }
    })
})

describe('clearPrimaryDomain', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.mocked(getCurrentTenantId).mockResolvedValue('tenant-1')
    })

    it('clears isPrimary on all domains', async () => {
        mockFindByID.mockResolvedValue({
            id: 'tenant-1',
            customDomains: [
                { domain: 'a.com', status: 'active', isPrimary: true },
            ],
        })
        mockUpdate.mockResolvedValue({})

        const result = await clearPrimaryDomain()
        expect(result.success).toBe(true)
        expect(mockUpdate).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    customDomains: [{ domain: 'a.com', status: 'active', isPrimary: false }],
                }),
            }),
        )
    })
})
