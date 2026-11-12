import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'

// ── Mocks at top (Rule: vi.mock() top-level, never inside describe/it) ──
vi.mock('@payload-config', () => ({ default: {} }))

vi.mock('payload', () => ({
    getPayload: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({
    getCurrentUser: vi.fn(),
    tenantIdForQuery: vi.fn(),
}))

import {
    getAiCategoriesAction,
    getCategoriesAction,
    getCategoriesByIdsAction,
} from '@/app/(dashboard)/products/categories/actions'
import { getPayload } from 'payload'
import { getCurrentUser, tenantIdForQuery } from '@/lib/auth'

const mockCurrentUser = { id: 'user-123', tenants: [{ tenant: 'tenant-456' }] }

type MockPayload = { find: Mock; db: { drizzle: { execute: Mock } } }

describe('getCategoriesAction — tenant-scoped access (TC-F08-05-13)', () => {
    let mockPayload: MockPayload
    let mockFind: Mock
    let mockExecute: Mock

    beforeEach(() => {
        vi.clearAllMocks()
        mockFind = vi.fn().mockResolvedValue({ docs: [] })
        mockExecute = vi.fn().mockResolvedValue({ rows: [] })

        mockPayload = {
            find: mockFind,
            db: { drizzle: { execute: mockExecute } },
        }

        vi.mocked(getPayload).mockResolvedValue(mockPayload as any)
        vi.mocked(getCurrentUser).mockResolvedValue(mockCurrentUser as any)
        vi.mocked(tenantIdForQuery).mockReturnValue('tenant-456')
    })

    it('[TC-PERF-077] reads the categories as one statement with names-only tenant / site relations, next to the counts', async () => {
        // Act
        await getCategoriesAction()

        // Assert
        expect(mockFind).toHaveBeenCalledTimes(1)
        expect(mockFind.mock.calls[0][0]).toMatchObject({
            collection: 'categories',
            pagination: false,
            depth: 1,
            populate: { tenants: { name: true, slug: true }, sites: { name: true } },
        })
        expect(mockExecute).toHaveBeenCalledTimes(1)
    })

    it('TC-F08-05-13: passes overrideAccess:false so the tenant-scoped read access-control actually applies', async () => {
        // Regression guard: Payload's Local API defaults `overrideAccess` to `true` when omitted,
        // which silently bypasses Categories.ts's tenant-scoped `read` access control (`{tenant:
        // {in:tenantIds}}`). Without this flag, every logged-in user sees every tenant's categories
        // and aggregated cross-tenant product counts — confirmed via a real Payload Local API call
        // against local Postgres with a real multi-tenant seed (25 categories / 312 products
        // leaked across tenants for a user whose own tenant had only 4 categories / 6 products).
        await getCategoriesAction()

        expect(mockFind).toHaveBeenCalledWith(
            expect.objectContaining({
                collection: 'categories',
                overrideAccess: false,
                where: { deletedAt: { exists: false } },
            })
        )
    })

    it('TC-F08-04-104: explicitly scopes AI category options to the primary active tenant', async () => {
        mockFind.mockResolvedValueOnce({
            docs: [{
                id: 42,
                name: 'Primary leaf',
                breadcrumbs: 'Primary > Leaf',
                parent: 7,
                productCount: 99,
            }],
        })

        await expect(getAiCategoriesAction()).resolves.toEqual({
            status: 'ready',
            categories: [{
                id: 42,
                name: 'Primary leaf',
                breadcrumbs: 'Primary > Leaf',
                parent: 7,
            }],
        })

        expect(mockFind).toHaveBeenCalledWith({
            collection: 'categories',
            user: mockCurrentUser,
            overrideAccess: false,
            where: {
                and: [
                    { tenant: { equals: 'tenant-456' } },
                    { deletedAt: { exists: false } },
                ],
            },
            depth: 0,
            limit: 1001,
            sort: ['breadcrumbs', 'id'],
            select: {
                name: true,
                parent: true,
                breadcrumbs: true,
            },
        })
        expect(mockExecute).not.toHaveBeenCalled()
    })

    it('TC-F08-04-140: returns the complete AI review taxonomy at the supported 1,000-category ceiling', async () => {
        const categories = Array.from({ length: 1000 }, (_, index) => ({
            id: index + 1,
            name: `Category ${index + 1}`,
            breadcrumbs: `Category ${index + 1}`,
            parent: null,
        }))
        mockFind.mockResolvedValueOnce({
            docs: categories,
            totalDocs: 1000,
            hasNextPage: false,
        })

        await expect(getAiCategoriesAction()).resolves.toEqual({
            status: 'ready',
            categories,
        })
    })

    it('TC-F08-04-141: rejects an oversized AI review taxonomy without exposing partial options', async () => {
        mockFind.mockResolvedValueOnce({
            docs: Array.from({ length: 1001 }, (_, index) => ({
                id: index + 1,
                name: `Category ${index + 1}`,
                breadcrumbs: `Category ${index + 1}`,
                parent: null,
            })),
            totalDocs: 1001,
            hasNextPage: false,
        })

        await expect(getAiCategoriesAction()).resolves.toEqual({
            status: 'overflow',
            maxCategories: 1000,
        })
    })

    it.each([
        { hasNextPage: true, totalDocs: 1000 },
        { hasNextPage: false, totalDocs: 1001 },
    ])('TC-F08-04-141: rejects a capped result when pagination metadata proves overflow (%j)', async metadata => {
        mockFind.mockResolvedValueOnce({
            docs: Array.from({ length: 1000 }, (_, index) => ({
                id: index + 1,
                name: `Category ${index + 1}`,
                breadcrumbs: `Category ${index + 1}`,
                parent: null,
            })),
            ...metadata,
        })

        await expect(getAiCategoriesAction()).resolves.toEqual({
            status: 'overflow',
            maxCategories: 1000,
        })
    })

    it('TC-F08-04-104: rejects AI category loading without a primary tenant', async () => {
        vi.mocked(tenantIdForQuery).mockReturnValueOnce(null)

        await expect(getAiCategoriesAction()).rejects.toThrow('Unauthorized')
        expect(getPayload).not.toHaveBeenCalled()
        expect(mockExecute).not.toHaveBeenCalled()
    })

    it('TC-F08-04-108: rejects more than 200 raw IDs before parsing or querying Payload', async () => {
        await expect(getCategoriesByIdsAction(Array(201).fill(' 42 '))).rejects.toThrow()

        expect(getPayload).not.toHaveBeenCalled()
        expect(mockFind).not.toHaveBeenCalled()
    })

    it('TC-F08-04-108: rejects more than 200 unique IDs before querying Payload', async () => {
        await expect(getCategoriesByIdsAction(
            Array.from({ length: 201 }, (_, index) => index + 1),
        )).rejects.toThrow()

        expect(getPayload).not.toHaveBeenCalled()
        expect(mockFind).not.toHaveBeenCalled()
    })

    it('TC-F08-04-100: canonicalizes and deduplicates equivalent IDs before querying Payload', async () => {
        mockFind.mockResolvedValueOnce({
            docs: [{ id: 42, name: 'Fashion', breadcrumbs: 'Fashion', parent: null }],
        })

        await expect(getCategoriesByIdsAction([' 42 ', 42, '42'])).resolves.toEqual([{ id: 42 }])

        expect(mockFind).toHaveBeenCalledWith(expect.objectContaining({
            where: {
                and: [
                    { id: { in: [42] } },
                    { tenant: { equals: 'tenant-456' } },
                    { deletedAt: { exists: false } },
                ],
            },
        }))
    })

    it.each([
        '',
        '   ',
        'not-an-id',
        '1.5',
        1.5,
        0,
        -1,
        2_147_483_648,
        '999999999999999999999999',
        null,
        true,
        { id: 42 },
    ])('TC-F08-04-100: rejects malformed category ID %j before querying Payload', async invalidId => {
        await expect(getCategoriesByIdsAction([invalidId])).rejects.toThrow()

        expect(getPayload).not.toHaveBeenCalled()
        expect(mockFind).not.toHaveBeenCalled()
    })

    it('TC-F08-04-100: rejects category-ID revalidation without a tenant before querying Payload', async () => {
        vi.mocked(tenantIdForQuery).mockReturnValueOnce(null)

        await expect(getCategoriesByIdsAction(['42'])).rejects.toThrow('Unauthorized')
        expect(mockFind).not.toHaveBeenCalled()
    })

    it('TC-F08-05-13: throws Unauthorized when no user, never calls payload.find', async () => {
        vi.mocked(getCurrentUser).mockResolvedValueOnce(null)

        await expect(getCategoriesAction()).rejects.toThrow('Unauthorized')
        expect(mockFind).not.toHaveBeenCalled()
    })
})
