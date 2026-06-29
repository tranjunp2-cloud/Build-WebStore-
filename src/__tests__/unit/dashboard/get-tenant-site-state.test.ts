/**
 * Unit Tests — GH-1392 Tenant Site State Helper
 *
 * Coverage Map (Issue Test Scenarios):
 *   [TC-1392-SITE-01] → isUsableSite with generationStatus variants
 *   [TC-1392-SITE-02] → getTenantSiteState with null tenantId
 *   [TC-1392-SITE-03] → getTenantSiteState with completed site
 *   [TC-1392-SITE-04] → getTenantSiteState with failed sites only
 *   [TC-1392-SITE-05] → getTenantSiteState with mixed sites
 *   [TC-1392-SITE-06] → getTenantSiteState with empty docs
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { isUsableSite, getTenantSiteState } from '@/lib/dashboard/get-tenant-site-state'

// ─────────────────────────────────────────────────────────────────────────────
// [TC-1392-SITE-01] — isUsableSite predicate (generationStatus variants)
// ─────────────────────────────────────────────────────────────────────────────
describe('isUsableSite', () => {
    it('[TC-1392-SITE-01] returns true when generationStatus is undefined', () => {
        const site = { id: '1', name: 'My Site' }
        expect(isUsableSite(site)).toBe(true)
    })

    it('returns true when generationStatus is null', () => {
        const site = { id: '1', generationStatus: null }
        expect(isUsableSite(site)).toBe(true)
    })

    it('returns true when generationStatus is "none"', () => {
        const site = { id: '1', generationStatus: 'none' }
        expect(isUsableSite(site)).toBe(true)
    })

    it('returns true when generationStatus is "completed"', () => {
        const site = { id: '1', generationStatus: 'completed' }
        expect(isUsableSite(site)).toBe(true)
    })

    it('returns false when generationStatus is "failed"', () => {
        const site = { id: '1', generationStatus: 'failed' }
        expect(isUsableSite(site)).toBe(false)
    })

    it('returns false when generationStatus is "pending"', () => {
        const site = { id: '1', generationStatus: 'pending' }
        expect(isUsableSite(site)).toBe(false)
    })

    it('returns false when generationStatus is "generating"', () => {
        const site = { id: '1', generationStatus: 'generating' }
        expect(isUsableSite(site)).toBe(false)
    })

    it('returns true for empty object (no generationStatus key)', () => {
        expect(isUsableSite({})).toBe(true)
    })

    it('returns true for null-ish input (graceful fallback)', () => {
        expect(isUsableSite(null)).toBe(true)
    })

    it('returns true for undefined-like input', () => {
        expect(isUsableSite(undefined)).toBe(true)
    })
})

// ─────────────────────────────────────────────────────────────────────────────
// [TC-1392-SITE-02] — getTenantSiteState with null/undefined tenantId
// ─────────────────────────────────────────────────────────────────────────────
describe('getTenantSiteState', () => {
    const mockPayload = { find: vi.fn() }

    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('[TC-1392-SITE-02] returns hasUsableSite=false when tenantId is null', async () => {
        const result = await getTenantSiteState(mockPayload as any, null)

        expect(result).toEqual({ hasUsableSite: false })
        expect(mockPayload.find).not.toHaveBeenCalled()
    })

    it('returns hasUsableSite=false when tenantId is undefined', async () => {
        const result = await getTenantSiteState(mockPayload as any, undefined)

        expect(result).toEqual({ hasUsableSite: false })
        expect(mockPayload.find).not.toHaveBeenCalled()
    })

    // ─────────────────────────────────────────────────────────────────────────────
    // [TC-1392-SITE-03] — getTenantSiteState with usable sites
    // ─────────────────────────────────────────────────────────────────────────────

    it('[TC-1392-SITE-03] returns hasUsableSite=true when tenant has a completed site', async () => {
        mockPayload.find.mockResolvedValue({
            docs: [{ id: 'site-1', name: 'My Site', generationStatus: 'completed' }],
        })

        const result = await getTenantSiteState(mockPayload as any, 'tenant-1')

        expect(result).toEqual({ hasUsableSite: true })
        expect(mockPayload.find).toHaveBeenCalledWith({
            collection: 'sites',
            where: { tenant: { equals: 'tenant-1' } },
            limit: 5,
        })
    })

    it('returns hasUsableSite=true when tenant has a site with no generationStatus', async () => {
        mockPayload.find.mockResolvedValue({
            docs: [{ id: 'site-1', name: 'My Site' }],
        })

        const result = await getTenantSiteState(mockPayload as any, 'tenant-1')

        expect(result).toEqual({ hasUsableSite: true })
    })

    it('returns hasUsableSite=true when tenant has a site with generationStatus="none"', async () => {
        mockPayload.find.mockResolvedValue({
            docs: [{ id: 'site-1', generationStatus: 'none' }],
        })

        const result = await getTenantSiteState(mockPayload as any, 'tenant-1')

        expect(result).toEqual({ hasUsableSite: true })
    })

    // ─────────────────────────────────────────────────────────────────────────────
    // [TC-1392-SITE-04] — getTenantSiteState with only failed sites
    // ─────────────────────────────────────────────────────────────────────────────

    it('[TC-1392-SITE-04] returns hasUsableSite=false when all sites are failed', async () => {
        mockPayload.find.mockResolvedValue({
            docs: [
                { id: 'site-1', generationStatus: 'failed' },
                { id: 'site-2', generationStatus: 'failed' },
            ],
        })

        const result = await getTenantSiteState(mockPayload as any, 'tenant-1')

        expect(result).toEqual({ hasUsableSite: false })
    })

    it('returns hasUsableSite=false when all sites are pending', async () => {
        mockPayload.find.mockResolvedValue({
            docs: [
                { id: 'site-1', generationStatus: 'pending' },
                { id: 'site-2', generationStatus: 'generating' },
            ],
        })

        const result = await getTenantSiteState(mockPayload as any, 'tenant-1')

        expect(result).toEqual({ hasUsableSite: false })
    })

    // ─────────────────────────────────────────────────────────────────────────────
    // [TC-1392-SITE-05] — getTenantSiteState with mixed sites
    // ─────────────────────────────────────────────────────────────────────────────

    it('[TC-1392-SITE-05] returns hasUsableSite=true when at least one site is usable', async () => {
        mockPayload.find.mockResolvedValue({
            docs: [
                { id: 'site-1', generationStatus: 'failed' },
                { id: 'site-2', generationStatus: 'completed' },
                { id: 'site-3', generationStatus: 'pending' },
            ],
        })

        const result = await getTenantSiteState(mockPayload as any, 'tenant-1')

        expect(result).toEqual({ hasUsableSite: true })
    })

    it('returns hasUsableSite=true when first site has no status and others failed', async () => {
        mockPayload.find.mockResolvedValue({
            docs: [
                { id: 'site-1', name: 'My Site' }, // no generationStatus = usable
                { id: 'site-2', generationStatus: 'failed' },
            ],
        })

        const result = await getTenantSiteState(mockPayload as any, 'tenant-1')

        expect(result).toEqual({ hasUsableSite: true })
    })

    // ─────────────────────────────────────────────────────────────────────────────
    // [TC-1392-SITE-06] — getTenantSiteState with empty or no docs
    // ─────────────────────────────────────────────────────────────────────────────

    it('[TC-1392-SITE-06] returns hasUsableSite=false when docs array is empty', async () => {
        mockPayload.find.mockResolvedValue({
            docs: [],
        })

        const result = await getTenantSiteState(mockPayload as any, 'tenant-1')

        expect(result).toEqual({ hasUsableSite: false })
    })


    it('calls payload.find with correct query shape', async () => {
        mockPayload.find.mockResolvedValue({ docs: [] })

        await getTenantSiteState(mockPayload as any, 'tenant-abc')

        expect(mockPayload.find).toHaveBeenCalledWith(
            expect.objectContaining({
                collection: 'sites',
                where: expect.objectContaining({
                    tenant: expect.objectContaining({
                        equals: 'tenant-abc',
                    }),
                }),
                limit: 5,
            }),
        )
    })

    it('uses limit=5 for query (safety margin for extra sites)', async () => {
        mockPayload.find.mockResolvedValue({ docs: [] })

        await getTenantSiteState(mockPayload as any, 'tenant-1')

        expect(mockPayload.find).toHaveBeenCalledWith(
            expect.objectContaining({ limit: 5 }),
        )
    })
})
