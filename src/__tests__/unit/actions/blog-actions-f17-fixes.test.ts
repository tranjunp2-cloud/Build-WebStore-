import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockUser = { id: 1, tenants: [{ tenant: { id: 'tenant-1' }, role: 'owner' }] }
vi.mock('@/lib/auth', () => ({
    getCurrentUser: vi.fn(() => Promise.resolve(mockUser)),
}))

const mockFind = vi.fn()
const mockCreate = vi.fn()
const mockUpdate = vi.fn()
const mockFindByID = vi.fn()
const mockDelete = vi.fn()
vi.mock('payload', () => ({
    getPayload: vi.fn(() => Promise.resolve({
        find: mockFind,
        create: mockCreate,
        update: mockUpdate,
        findByID: mockFindByID,
        delete: mockDelete,
    })),
}))
vi.mock('@payload-config', () => ({ default: {} }))

vi.mock('@/lib/subscriptions/plan-subscription', () => ({
    getActivePlanSubscription: vi.fn().mockResolvedValue({
        id: 'mock-sub-1', plan: 'PROFESSIONAL_TM_USER', status: 'active',
    }),
    canUse: vi.fn().mockResolvedValue(true),
    canUseWithinLimit: vi.fn().mockResolvedValue(true),
}))

import {
    createBlogCategoryAction, getBlogCategoriesAction, getCategoryPublishedPostCountAction,
    saveBlogAction, listBlogsAction, deleteBlogAction, updateBlogStatusAction,
    updateBlogCategoryAction, deleteBlogCategoryAction, getBlogByIdAction,
    bulkDeleteBlogsAction,
} from '@/app/(dashboard)/blog/actions'
import { getCurrentUser } from '@/lib/auth'

// ─── TC-F17: Category Duplicate Name Check ───────────────────────────

describe('createBlogCategoryAction — duplicate name [TC-F17.05]', () => {
    beforeEach(() => vi.clearAllMocks())

    it('[TC-07] rejects duplicate category name within same tenant', async () => {
        // First find: site lookup
        mockFind.mockResolvedValueOnce({ docs: [{ id: 'site-1' }] })
        // Second find: duplicate check — returns existing
        mockFind.mockResolvedValueOnce({ docs: [{ id: 'cat-existing', name: 'Tech' }] })

        const result = await createBlogCategoryAction({ name: 'Tech' })
        expect(result).toEqual({ error: 'A category with this name already exists', code: 'DUPLICATE_SLUG' })
        expect(mockCreate).not.toHaveBeenCalled()
    })

    it('[TC-08] creates category with unique name', async () => {
        // Site lookup
        mockFind.mockResolvedValueOnce({ docs: [{ id: 'site-1' }] })
        // Duplicate check — empty
        mockFind.mockResolvedValueOnce({ docs: [] })
        // Create result
        mockCreate.mockResolvedValue({ id: 'cat-new', name: 'Design', slug: 'design' })

        const result = await createBlogCategoryAction({ name: 'Design' })
        expect(result).toHaveProperty('id', 'cat-new')
        expect(mockCreate).toHaveBeenCalled()
    })
})

// ─── TC-F17: Search Trim ─────────────────────────────────────────────

describe('listBlogsAction — search trim [TC-F17.01]', () => {
    beforeEach(() => vi.clearAllMocks())

    it('[TC-09] trims whitespace from search query', async () => {
        mockFind.mockResolvedValue({ docs: [], totalDocs: 0, totalPages: 0, page: 1, hasPrevPage: false, hasNextPage: false })
        await listBlogsAction({ search: '  hello  ' })
        const call = mockFind.mock.calls[0][0]
        // where is now { and: [...] } — find the or condition inside and
        const orCondition = call.where.and.find((c: Record<string, unknown>) => 'or' in c)
        expect(orCondition.or[0].title.contains).toBe('hello')
    })

    it('[TC-10] whitespace-only search treated as no filter', async () => {
        mockFind.mockResolvedValue({ docs: [], totalDocs: 0, totalPages: 0, page: 1, hasPrevPage: false, hasNextPage: false })
        await listBlogsAction({ search: '   ' })
        const call = mockFind.mock.calls[0][0]
        // Only tenant condition, no or/search condition
        const orCondition = call.where.and?.find((c: Record<string, unknown>) => 'or' in c)
        expect(orCondition).toBeUndefined()
    })
})


// GH-1587 follow-up: read helpers had the same fail-open shape as the write paths —
// they only added tenant filters when tenantId was truthy, so a still-authenticated actor
// with tenants:[] could read unscoped categories/blogs/counts. These regressions must fail
// without the fix and pass after it.
describe('Read helpers — tenantless actor fail-closed (TC-F17-SEC-10..12)', () => {
    beforeEach(() => vi.clearAllMocks())

    it('TC-F17-SEC-10: getBlogCategoriesAction returns [] and does not query when actor has no resolvable tenant', async () => {
        vi.mocked(getCurrentUser).mockResolvedValueOnce({ id: 1, tenants: [] } as any)

        const result = await getBlogCategoriesAction()

        expect(result).toEqual([])
        expect(mockFind).not.toHaveBeenCalled()
    })

    it('TC-F17-SEC-10b: getBlogCategoriesAction still works for super-admin with no tenant memberships', async () => {
        vi.mocked(getCurrentUser).mockResolvedValueOnce({ id: 1, tenants: [], roles: ['super-admin'] } as any)
        mockFind.mockResolvedValueOnce({ docs: [{ id: 'cat-1', name: 'News' }] })

        const result = await getBlogCategoriesAction()

        expect(result).toEqual([{ id: 'cat-1', name: 'News' }])
        expect(mockFind).toHaveBeenCalledWith(expect.objectContaining({
            collection: 'blog_categories',
            where: { and: [{ status: { not_equals: 'deleted' } }] },
        }))
    })

    it('TC-F17-SEC-11: getCategoryPublishedPostCountAction returns 0 and does not query when actor has no resolvable tenant', async () => {
        vi.mocked(getCurrentUser).mockResolvedValueOnce({ id: 1, tenants: [] } as any)

        const result = await getCategoryPublishedPostCountAction('cat-1')

        expect(result).toBe(0)
        expect(mockFind).not.toHaveBeenCalled()
    })

    it('TC-F17-SEC-11b: getCategoryPublishedPostCountAction still works for super-admin with no tenant memberships', async () => {
        vi.mocked(getCurrentUser).mockResolvedValueOnce({ id: 1, tenants: [], roles: ['super-admin'] } as any)
        mockFind.mockResolvedValueOnce({ docs: [], totalDocs: 7 })

        const result = await getCategoryPublishedPostCountAction('cat-1')

        expect(result).toBe(7)
        expect(mockFind).toHaveBeenCalledWith(expect.objectContaining({
            collection: 'blogs',
            where: { and: [
                { category: { equals: 'cat-1' } },
                { status: { equals: 'published' } },
            ] },
        }))
    })

    it('TC-F17-SEC-12: listBlogsAction returns empty payload and does not query when actor has no resolvable tenant', async () => {
        vi.mocked(getCurrentUser).mockResolvedValueOnce({ id: 1, tenants: [] } as any)

        const result = await listBlogsAction({ search: 'hello' })

        expect(result).toEqual({ data: [], meta: null })
        expect(mockFind).not.toHaveBeenCalled()
    })

    it('TC-F17-SEC-12b: listBlogsAction still allows super-admin with no tenant memberships', async () => {
        vi.mocked(getCurrentUser).mockResolvedValueOnce({ id: 1, tenants: [], roles: ['super-admin'] } as any)
        mockFind.mockResolvedValueOnce({
            docs: [{ id: 'blog-1', title: 'Global' }],
            totalDocs: 1,
            totalPages: 1,
            page: 1,
            limit: 10,
            hasNextPage: false,
            hasPrevPage: false,
        })

        const result = await listBlogsAction({ search: '  global  ' })

        expect(result.data).toEqual([{ id: 'blog-1', title: 'Global' }])
        expect(mockFind).toHaveBeenCalledWith(expect.objectContaining({
            collection: 'blogs',
            where: { and: [{ or: [
                { title: { contains: 'global' } },
                { slug: { contains: 'global' } },
            ] }] },
        }))
    })
})

// ─── TC-F17: publishedAt in saveBlogAction ───────────────────────────

describe('saveBlogAction — publishedAt [TC-F17.02]', () => {
    beforeEach(() => vi.clearAllMocks())

    it('[TC-11] includes publishedAt in saved data', async () => {
        // Site lookup
        mockFind.mockResolvedValueOnce({ docs: [{ id: 'site-1' }] })
        mockCreate.mockResolvedValue({ id: 'blog-1', title: 'Test', publishedAt: '2026-04-13T00:00:00Z' })

        await saveBlogAction({
            title: 'Test', slug: 'test', content: '<p>test</p>', status: 'draft',
            publishedAt: '2026-04-13T00:00:00Z',
        })

        expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({ publishedAt: '2026-04-13T00:00:00Z' }),
        }))
    })
})

// GH-1587 Phase 1d: saveBlogAction cross-tenant update IDOR fix (TC-F17-SEC-03)
describe('saveBlogAction — cross-tenant update IDOR (TC-F17-SEC-03)', () => {
    beforeEach(() => vi.clearAllMocks())

    it('TC-F17-SEC-03: Non-admin user updating a blog belonging to a DIFFERENT tenant returns error', async () => {
        // Simulate: user from tenant-1 tries to update a blog owned by tenant-2
        // findByID mocked to return a blog from a different tenant
        mockFindByID.mockResolvedValueOnce({
            id: 'blog-owned-by-tenant-2',
            tenant: 'tenant-2', // Different from user's tenant-1
            title: 'Original'
        })

        const result = await saveBlogAction({
            id: 'blog-owned-by-tenant-2',
            title: 'Hacked', slug: 'hacked', content: '<p>compromised</p>', status: 'draft'
        })

        expect(mockFindByID).toHaveBeenCalledWith({
            collection: 'blogs',
            id: 'blog-owned-by-tenant-2'
        })

        expect(result).toEqual({ error: 'Unauthorized update access' })
        expect(mockUpdate).not.toHaveBeenCalled()
    })

    it('TC-F17-SEC-03: Non-admin user updating their own tenant\'s blog succeeds', async () => {
        // Set up: user's blog in their own tenant
        mockFindByID.mockResolvedValueOnce({
            id: 'blog-1',
            tenant: 'tenant-1', // Matches user's tenant
            title: 'Original', slug: 'original', content: '<p>original</p>', status: 'draft'
        })

        mockUpdate.mockResolvedValueOnce({
            id: 'blog-1',
            tenant: 'tenant-1',
            title: 'Updated', slug: 'updated', content: '<p>updated</p>', status: 'published'
        })

        const result = await saveBlogAction({
            id: 'blog-1',
            title: 'Updated', slug: 'updated', content: '<p>updated</p>', status: 'published'
        })

        expect(result.id).toBe('blog-1')
        expect(mockUpdate).toHaveBeenCalledWith(
            expect.objectContaining({
                collection: 'blogs',
                id: 'blog-1'
            })
        )
    })

    it('TC-F17-SEC-03: Blog document with tenant as object is correctly compared', async () => {
        // Edge case: tenant returned as { id: 'tenant-2' } (object) instead of string
        mockFindByID.mockResolvedValueOnce({
            id: 'blog-1',
            tenant: { id: 'tenant-2' }, // Different tenant, as object
            title: 'Original'
        })

        const result = await saveBlogAction({
            id: 'blog-1',
            title: 'Hacked', slug: 'hacked', content: '<p>compromised</p>', status: 'draft'
        })

        // Should still reject because tenant-2 !== tenant-1 (user's tenant)
        expect(result).toEqual({ error: 'Unauthorized update access' })
        expect(mockUpdate).not.toHaveBeenCalled()
    })

    it('TC-F17-SEC-03: Blog tenant ID comparison handles both string and object formats', async () => {
        // The fix must correctly extract tenant ID from both formats
        mockFindByID.mockResolvedValueOnce({
            id: 'blog-1',
            tenant: { id: 'tenant-1' }, // Object format
            title: 'Original'
        })

        mockUpdate.mockResolvedValueOnce({
            id: 'blog-1',
            tenant: { id: 'tenant-1' },
            title: 'Updated'
        })

        // User's tenant is 'tenant-1' (object format in mock user)
        // Blog's tenant is { id: 'tenant-1' }
        // Should succeed because both resolve to 'tenant-1'
        const result = await saveBlogAction({
            id: 'blog-1',
            title: 'Updated', slug: 'updated', content: '<p>updated</p>', status: 'draft'
        })

        expect(result.id).toBe('blog-1')
        expect(mockUpdate).toHaveBeenCalled()
    })

    it('TC-F17-SEC-03b: Non-admin user with NO resolvable tenant (e.g. just removed from their only tenant) is REJECTED, not fail-open', async () => {
        // Regression test for a fail-open bug found by adversarial review: the naive guard
        // `if (tenantId && blogTenantId && mismatch)` SKIPS the check entirely when tenantId is
        // falsy, letting the update through unchecked. A user with an empty `tenants` array
        // (still a valid session — e.g. just removed from their only tenant) must be denied,
        // not silently let through.
        vi.mocked(getCurrentUser).mockResolvedValueOnce({ id: 1, tenants: [] } as any)
        mockFindByID.mockResolvedValueOnce({
            id: 'blog-owned-by-tenant-2',
            tenant: 'tenant-2',
            title: 'Original'
        })

        const result = await saveBlogAction({
            id: 'blog-owned-by-tenant-2',
            title: 'Hacked', slug: 'hacked', content: '<p>compromised</p>', status: 'draft'
        })

        expect(result).toEqual({ error: 'Unauthorized update access' })
        expect(mockUpdate).not.toHaveBeenCalled()
    })

    it('TC-F17-SEC-03c: Super-admin (no tenant memberships) can still update any tenant\'s blog', async () => {
        vi.mocked(getCurrentUser).mockResolvedValueOnce({ id: 1, tenants: [], roles: ['super-admin'] } as any)
        mockFindByID.mockResolvedValueOnce({
            id: 'blog-owned-by-tenant-2',
            tenant: 'tenant-2',
            title: 'Original'
        })
        mockUpdate.mockResolvedValueOnce({
            id: 'blog-owned-by-tenant-2',
            tenant: 'tenant-2',
            title: 'Updated by admin'
        })

        const result = await saveBlogAction({
            id: 'blog-owned-by-tenant-2',
            title: 'Updated by admin', slug: 'updated', content: '<p>ok</p>', status: 'published'
        })

        expect(result.id).toBe('blog-owned-by-tenant-2')
        expect(mockUpdate).toHaveBeenCalled()
    })

    it('TC-F17-SEC-03d: Stale or deleted blog ID returns a controlled error instead of bubbling a 500 from the ownership pre-check', async () => {
        mockFindByID.mockReset()
        mockUpdate.mockReset()
        mockFindByID.mockRejectedValueOnce(new Error('Blog not found'))

        const result = await saveBlogAction({
            id: 'missing-blog',
            title: 'Updated', slug: 'updated', content: '<p>updated</p>', status: 'draft'
        })

        expect(result).toEqual({ error: 'Failed to save blog' })
        expect(mockUpdate).not.toHaveBeenCalled()
    })

    it('TC-F17-SEC-03e: Non-admin user cannot attach a cross-tenant blog category when saving a blog', async () => {
        mockFind.mockReset()
        mockFindByID.mockReset()
        mockCreate.mockReset()
        mockFind.mockResolvedValueOnce({ docs: [{ id: 'site-1' }] })
        mockFindByID.mockResolvedValueOnce({
            id: 'cat-tenant-2',
            tenant: 'tenant-2',
            status: 'active',
        })

        const result = await saveBlogAction({
            title: 'New blog',
            slug: 'new-blog',
            content: '<p>new</p>',
            status: 'draft',
            category: 'cat-tenant-2',
        })

        expect(result).toEqual({ error: 'Invalid category selection' })
        expect(mockCreate).not.toHaveBeenCalled()
        expect(mockFindByID).toHaveBeenCalledWith({
            collection: 'blog_categories',
            id: 'cat-tenant-2',
            overrideAccess: true,
            disableErrors: true,
        })
    })
})

// GH-1587 round-4 review: same fail-open pattern (if tenantId && ownerTenantId && mismatch)
// found in 5 sibling functions + a worse unscoped variant in bulkDeleteBlogsAction.
// TC-F17-SEC-04..09: each must reject a user with an unresolvable tenant, not fail open.
describe('Sibling actions — fail-open regression fixes (TC-F17-SEC-04..09)', () => {
    beforeEach(() => vi.clearAllMocks())

    it('TC-F17-SEC-04: deleteBlogAction rejects when actor has no resolvable tenant', async () => {
        vi.mocked(getCurrentUser).mockResolvedValueOnce({ id: 1, tenants: [] } as any)
        mockFindByID.mockResolvedValueOnce({ id: 'blog-1', tenant: 'tenant-2' })

        await expect(deleteBlogAction('blog-1')).rejects.toThrow('Unauthorized delete access')
        expect(mockDelete).not.toHaveBeenCalled()
    })

    it('TC-F17-SEC-05: updateBlogStatusAction rejects when actor has no resolvable tenant', async () => {
        vi.mocked(getCurrentUser).mockResolvedValueOnce({ id: 1, tenants: [] } as any)
        mockFindByID.mockResolvedValueOnce({ id: 'blog-1', tenant: 'tenant-2' })

        await expect(updateBlogStatusAction('blog-1', 'published')).rejects.toThrow('Unauthorized update access')
        expect(mockUpdate).not.toHaveBeenCalled()
    })

    it('TC-F17-SEC-06: updateBlogCategoryAction rejects when actor has no resolvable tenant', async () => {
        vi.mocked(getCurrentUser).mockResolvedValueOnce({ id: 1, tenants: [] } as any)
        mockFindByID.mockResolvedValueOnce({ id: 'cat-1', tenant: 'tenant-2' })

        const result = await updateBlogCategoryAction('cat-1', { name: 'Hacked Category' })
        expect(result).toEqual({ error: 'Unauthorized access' })
        expect(mockUpdate).not.toHaveBeenCalled()
    })

    it('TC-F17-SEC-07: deleteBlogCategoryAction rejects when actor has no resolvable tenant', async () => {
        vi.mocked(getCurrentUser).mockResolvedValueOnce({ id: 1, tenants: [] } as any)
        mockFindByID.mockResolvedValueOnce({ id: 'cat-1', tenant: 'tenant-2' })

        const result = await deleteBlogCategoryAction('cat-1')
        expect(result).toEqual({ error: 'ERR_UNAUTHORIZED' })
        expect(mockDelete).not.toHaveBeenCalled()
    })

    it('TC-F17-SEC-07b: deleteBlogCategoryAction tenant-scopes cleanup and uses access-controlled Local API writes', async () => {
        mockFindByID.mockResolvedValueOnce({ id: 'cat-1', tenant: 'tenant-1' })
        mockFind.mockResolvedValueOnce({ docs: [{ id: 'blog-1' }], totalDocs: 1 })
        mockUpdate.mockResolvedValueOnce({ id: 'blog-1', category: null })
        mockDelete.mockResolvedValueOnce({ id: 'cat-1' })

        const result = await deleteBlogCategoryAction('cat-1')

        expect(result).toEqual({ success: true })
        expect(mockFind).toHaveBeenCalledWith(expect.objectContaining({
            collection: 'blogs',
            where: {
                and: [
                    { category: { equals: 'cat-1' } },
                    { tenant: { equals: 'tenant-1' } },
                ],
            },
            user: mockUser,
            overrideAccess: false,
        }))
        expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
            collection: 'blogs',
            id: 'blog-1',
            data: { category: null },
            user: mockUser,
            overrideAccess: false,
        }))
        expect(mockDelete).toHaveBeenCalledWith(expect.objectContaining({
            collection: 'blog_categories',
            id: 'cat-1',
            user: mockUser,
            overrideAccess: false,
        }))
    })

    it('TC-F17-SEC-08: getBlogByIdAction rejects when actor has no resolvable tenant', async () => {
        vi.mocked(getCurrentUser).mockResolvedValueOnce({ id: 1, tenants: [] } as any)
        mockFindByID.mockResolvedValueOnce({ id: 'blog-1', tenant: 'tenant-2', title: 'Secret' })

        await expect(getBlogByIdAction('blog-1')).rejects.toThrow('Unauthorized access')
    })

    it('TC-F17-SEC-09: bulkDeleteBlogsAction refuses entirely (not unscoped) when actor has no resolvable tenant', async () => {
        vi.mocked(getCurrentUser).mockResolvedValueOnce({ id: 1, tenants: [] } as any)

        const result = await bulkDeleteBlogsAction(['blog-1', 'blog-2', 'blog-3'])
        expect(result).toEqual({ deleted: 0, error: 'Unauthorized delete access' })
        expect(mockDelete).not.toHaveBeenCalled()
    })

    it('TC-F17-SEC-09b: bulkDeleteBlogsAction still tenant-scopes normally for a resolvable actor', async () => {
        mockDelete.mockResolvedValueOnce({ docs: [{ id: 'blog-1' }] })

        const result = await bulkDeleteBlogsAction(['blog-1'])
        expect(result).toEqual({ deleted: 1 })
        expect(mockDelete).toHaveBeenCalledWith(
            expect.objectContaining({
                collection: 'blogs',
                where: { id: { in: ['blog-1'] }, tenant: { equals: 'tenant-1' } },
            })
        )
    })

    it('TC-F17-SEC-09c: super-admin with no tenant memberships can still bulk-delete across tenants', async () => {
        vi.mocked(getCurrentUser).mockResolvedValueOnce({ id: 1, tenants: [], roles: ['super-admin'] } as any)
        mockDelete.mockResolvedValueOnce({ docs: [{ id: 'blog-1' }, { id: 'blog-2' }] })

        const result = await bulkDeleteBlogsAction(['blog-1', 'blog-2'])
        expect(result).toEqual({ deleted: 2 })
    })
})

// ─── GH-2317: one slug rule for the modal (server actions) and the API ─────────

describe('Blog category slug matches the API (TC-F17-05-09)', () => {
    beforeEach(() => vi.clearAllMocks())

    it('TC-F17-05-09: createBlogCategoryAction strips accents like the API ("Tin tức" -> tin-tuc)', async () => {
        mockFind.mockResolvedValueOnce({ docs: [{ id: 'site-1' }] }) // site lookup
        mockFind.mockResolvedValueOnce({ docs: [] }) // duplicate check
        mockCreate.mockResolvedValue({ id: 'cat-new', name: 'Tin tức', slug: 'tin-tuc' })

        await createBlogCategoryAction({ name: 'Tin tức' })

        expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({ slug: 'tin-tuc' }),
        }))
    })

    it('TC-F17-05-09: updateBlogCategoryAction strips accents like the API ("Café Tips" -> cafe-tips)', async () => {
        mockFindByID.mockResolvedValueOnce({ id: 'cat-1', tenant: 'tenant-1' })
        mockFind.mockResolvedValueOnce({ docs: [] }) // duplicate check
        mockUpdate.mockResolvedValue({ id: 'cat-1', name: 'Café Tips', slug: 'cafe-tips' })

        await updateBlogCategoryAction('cat-1', { name: 'Café Tips' })

        expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({ slug: 'cafe-tips' }),
        }))
    })

    it('TC-F17-05-09: a stored legacy slug (tin-t-c) still blocks a name that now maps to it', async () => {
        mockFind.mockResolvedValueOnce({ docs: [{ id: 'site-1' }] })
        mockFind.mockResolvedValueOnce({ docs: [{ id: 'cat-old', name: 'Tin tức', slug: 'tin-t-c' }] })

        const result = await createBlogCategoryAction({ name: 'Tin t c' })

        expect(result).toEqual({ error: 'A category with this name already exists', code: 'DUPLICATE_SLUG' })
        expect(mockCreate).not.toHaveBeenCalled()
    })

    it('TC-F17-05-09: "Tin tuc" is blocked by a legacy "Tin tức" row (slug tin-t-c) through its name', async () => {
        mockFind.mockResolvedValueOnce({ docs: [{ id: 'site-1' }] })
        mockFind.mockResolvedValueOnce({ docs: [{ id: 'cat-old', name: 'Tin tức', slug: 'tin-t-c' }] })

        const result = await createBlogCategoryAction({ name: 'Tin tuc' })

        expect(result).toEqual({ error: 'A category with this name already exists', code: 'DUPLICATE_SLUG' })
        expect(mockCreate).not.toHaveBeenCalled()
    })
})
