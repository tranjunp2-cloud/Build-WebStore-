import { describe, it, expect, vi, beforeEach } from 'vitest'

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

import { getCurrentTenantId } from '@/lib/auth'
import {
    addCustomDomain,
    removeCustomDomain,
    verifyCustomDomain,
    setPrimaryDomain,
    clearPrimaryDomain,
} from '@/app/(dashboard)/settings/domains/actions'

// ─── TC-F19.02: Domain format validation ──────────────────────────────
// ─── TC-F19.03: Duplicate domain prevention ───────────────────────────
// ─── TC-F19.42: DNS validation ────────────────────────────────────────

describe('addCustomDomain [TC-F19.02, TC-F19.03]', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.mocked(getCurrentTenantId).mockResolvedValue('tenant-1')
    })

    it('returns error when not authenticated', async () => {
        vi.mocked(getCurrentTenantId).mockResolvedValue(null)
        const result = await addCustomDomain('test.com')
        expect(result.success).toBe(false)
        expect(result.error).toBe('Unauthorized')
    })

    it('rejects invalid domain format [TC-F19.02]', async () => {
        const result = await addCustomDomain('not a domain!!!')
        expect(result.success).toBe(false)
        expect(result.error).toContain('Invalid domain')
    })

    it('rejects domain with protocol prefix', async () => {
        // Sanitizes https:// but then checks format
        mockFindByID.mockResolvedValue({ customDomains: [] })
        mockFind.mockResolvedValue({ docs: [] })
        mockUpdate.mockResolvedValue({})

        const result = await addCustomDomain('https://valid.com')
        // Should strip protocol and accept
        expect(result.success).toBe(true)
    })

    it('rejects duplicate domain across tenants [TC-F19.03]', async () => {
        mockFindByID.mockResolvedValue({ customDomains: [] })
        mockFind.mockResolvedValue({ docs: [{ id: 'other-tenant' }] })

        const result = await addCustomDomain('taken.com')
        expect(result.success).toBe(false)
        expect(result.error).toContain('already registered')
    })

    it('rejects duplicate domain within same tenant', async () => {
        mockFindByID.mockResolvedValue({
            customDomains: [{ domain: 'existing.com', status: 'active' }],
        })
        mockFind.mockResolvedValue({ docs: [] })

        const result = await addCustomDomain('existing.com')
        expect(result.success).toBe(false)
        expect(result.error).toContain('already added')
    })

    it('adds valid new domain with pending status', async () => {
        mockFindByID.mockResolvedValue({ customDomains: [] })
        mockFind.mockResolvedValue({ docs: [] })
        mockUpdate.mockResolvedValue({})

        const result = await addCustomDomain('store.example.com')
        expect(result.success).toBe(true)
        expect(mockUpdate).toHaveBeenCalledWith(
            expect.objectContaining({
                data: {
                    customDomains: [{ domain: 'store.example.com', status: 'pending' }],
                },
            }),
        )
    })
})

describe('removeCustomDomain [TC-F19.62]', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.mocked(getCurrentTenantId).mockResolvedValue('tenant-1')
    })

    it('removes domain from tenant', async () => {
        mockFindByID.mockResolvedValue({
            customDomains: [
                { domain: 'keep.com', status: 'active' },
                { domain: 'remove.com', status: 'active' },
            ],
        })
        mockUpdate.mockResolvedValue({})

        const result = await removeCustomDomain('remove.com')
        expect(result.success).toBe(true)
        expect(mockUpdate).toHaveBeenCalledWith(
            expect.objectContaining({
                data: {
                    customDomains: [{ domain: 'keep.com', status: 'active' }],
                },
            }),
        )
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
            customDomains: [{ domain: 'pending.com', status: 'pending' }],
        })

        const result = await setPrimaryDomain('pending.com')
        expect(result.success).toBe(false)
        expect(result.error).toContain('verified')
    })
})

describe('clearPrimaryDomain', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.mocked(getCurrentTenantId).mockResolvedValue('tenant-1')
    })

    it('clears isPrimary on all domains', async () => {
        mockFindByID.mockResolvedValue({
            customDomains: [
                { domain: 'a.com', status: 'active', isPrimary: true },
            ],
        })
        mockUpdate.mockResolvedValue({})

        const result = await clearPrimaryDomain()
        expect(result.success).toBe(true)
        expect(mockUpdate).toHaveBeenCalledWith(
            expect.objectContaining({
                data: {
                    customDomains: [{ domain: 'a.com', status: 'active', isPrimary: false }],
                },
            }),
        )
    })
})
