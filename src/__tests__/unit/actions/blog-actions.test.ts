import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Mocks ────────────────────────────────────────────────────────────

const mockUser = {
    id: 'user-1',
    email: 'test@test.com',
    tenants: [{ tenant: { id: 'tenant-1' }, role: 'owner', status: 'active' }],
}

const mockUserOtherTenant = {
    id: 'user-2',
    email: 'other@test.com',
    tenants: [{ tenant: { id: 'tenant-2' }, role: 'owner', status: 'active' }],
}

vi.mock('@/lib/auth', () => ({
    getCurrentUser: vi.fn(),
}))

const mockFind = vi.fn()
const mockFindByID = vi.fn()
const mockCreate = vi.fn()
const mockUpdate = vi.fn()
const mockDelete = vi.fn()
vi.mock('payload', () => ({
    getPayload: vi.fn(() =>
        Promise.resolve({
            find: mockFind,
            findByID: mockFindByID,
            create: mockCreate,
            update: mockUpdate,
            delete: mockDelete,
        }),
    ),
}))
vi.mock('@payload-config', () => ({ default: {} }))

import { getCurrentUser } from '@/lib/auth'
import {
    getBlogCategoriesAction,
    createBlogCategoryAction,
    updateBlogCategoryAction,
    deleteBlogCategoryAction,
    listBlogsAction,
    deleteBlogAction,
    updateBlogStatusAction,
    getBlogByIdAction,
} from '@/app/(dashboard)/blog/actions'

// ─── TC-F17: Blog Categories ──────────────────────────────────────────

describe('getBlogCategoriesAction [TC-F17.01]', () => {
    beforeEach(() => vi.clearAllMocks())

    it('returns empty array when user is not authenticated', async () => {
        vi.mocked(getCurrentUser).mockResolvedValue(null)
        const result = await getBlogCategoriesAction()
        expect(result).toEqual([])
    })

    it('returns categories scoped to tenant', async () => {
        vi.mocked(getCurrentUser).mockResolvedValue(mockUser as any)
        mockFind.mockResolvedValue({ docs: [{ id: 'cat-1', name: 'Tech' }] })

        const result = await getBlogCategoriesAction()

        expect(mockFind).toHaveBeenCalledWith(
            expect.objectContaining({
                collection: 'blog_categories',
                where: { tenant: { equals: 'tenant-1' } },
            }),
        )
        expect(result).toEqual([{ id: 'cat-1', name: 'Tech' }])
    })
})

describe('createBlogCategoryAction [TC-F17.02]', () => {
    beforeEach(() => vi.clearAllMocks())

    it('throws Unauthorized when user not authenticated', async () => {
        vi.mocked(getCurrentUser).mockResolvedValue(null)
        await expect(createBlogCategoryAction({ name: 'Test' })).rejects.toThrow('Unauthorized')
    })

    it('returns validation error for empty name', async () => {
        vi.mocked(getCurrentUser).mockResolvedValue(mockUser as any)
        const result = await createBlogCategoryAction({ name: '' })
        expect(result).toEqual({ error: expect.stringContaining('Validation Error') })
    })

    it('returns validation error for name exceeding 80 chars', async () => {
        vi.mocked(getCurrentUser).mockResolvedValue(mockUser as any)
        const longName = 'a'.repeat(81)
        const result = await createBlogCategoryAction({ name: longName })
        expect(result).toEqual({ error: expect.stringContaining('Validation Error') })
    })

    it('creates category with correct tenant and slug', async () => {
        vi.mocked(getCurrentUser).mockResolvedValue(mockUser as any)
        // First call: site lookup, Second call: duplicate name check (empty = no duplicate)
        mockFind.mockResolvedValueOnce({ docs: [{ id: 'site-1' }] })
        mockFind.mockResolvedValueOnce({ docs: [] })
        mockCreate.mockResolvedValue({ id: 'cat-new', name: 'My Category', slug: 'my-category' })

        const result = await createBlogCategoryAction({ name: 'My Category' })

        expect(mockCreate).toHaveBeenCalledWith(
            expect.objectContaining({
                collection: 'blog_categories',
                data: expect.objectContaining({
                    name: 'My Category',
                    slug: 'my-category',
                    tenant: 'tenant-1',
                    site: 'site-1',
                }),
            }),
        )
        expect(result).toHaveProperty('id', 'cat-new')
    })
})

describe('updateBlogCategoryAction [TC-F17.03]', () => {
    beforeEach(() => vi.clearAllMocks())

    it('throws Unauthorized when user not authenticated', async () => {
        vi.mocked(getCurrentUser).mockResolvedValue(null)
        await expect(updateBlogCategoryAction('cat-1', { name: 'Updated' })).rejects.toThrow('Unauthorized')
    })

    it('returns validation error for empty name', async () => {
        vi.mocked(getCurrentUser).mockResolvedValue(mockUser as any)
        const result = await updateBlogCategoryAction('cat-1', { name: '   ' })
        expect(result).toEqual({ error: expect.stringContaining('Validation Error') })
    })

    it('returns error when category belongs to different tenant', async () => {
        vi.mocked(getCurrentUser).mockResolvedValue(mockUser as any)
        mockFindByID.mockResolvedValue({ id: 'cat-1', tenant: { id: 'tenant-other' } })

        const result = await updateBlogCategoryAction('cat-1', { name: 'Hacked' })
        expect(result).toEqual({ error: 'Unauthorized access' })
        expect(mockUpdate).not.toHaveBeenCalled()
    })

    it('updates category when tenant matches', async () => {
        vi.mocked(getCurrentUser).mockResolvedValue(mockUser as any)
        mockFindByID.mockResolvedValue({ id: 'cat-1', tenant: { id: 'tenant-1' } })
        mockUpdate.mockResolvedValue({ id: 'cat-1', name: 'Updated', slug: 'updated' })

        const result = await updateBlogCategoryAction('cat-1', { name: 'Updated' })
        expect(mockUpdate).toHaveBeenCalled()
        expect(result).toHaveProperty('name', 'Updated')
    })
})

describe('deleteBlogCategoryAction [TC-F17.04]', () => {
    beforeEach(() => vi.clearAllMocks())

    it('throws Unauthorized when user not authenticated', async () => {
        vi.mocked(getCurrentUser).mockResolvedValue(null)
        await expect(deleteBlogCategoryAction('cat-1')).rejects.toThrow('Unauthorized')
    })

    it('returns error when category belongs to different tenant', async () => {
        vi.mocked(getCurrentUser).mockResolvedValue(mockUser as any)
        mockFindByID.mockResolvedValue({ id: 'cat-1', tenant: { id: 'tenant-other' } })

        const result = await deleteBlogCategoryAction('cat-1')
        expect(result).toEqual({ error: 'Unauthorized delete access' })
        expect(mockDelete).not.toHaveBeenCalled()
    })

    it('soft-deletes category when tenant matches', async () => {
        vi.mocked(getCurrentUser).mockResolvedValue(mockUser as any)
        mockFindByID.mockResolvedValue({ id: 'cat-1', tenant: { id: 'tenant-1' } })
        mockUpdate.mockResolvedValue({ id: 'cat-1', status: 'deleted' })

        const result = await deleteBlogCategoryAction('cat-1')
        expect(result).toEqual({ success: true })
        expect(mockUpdate).toHaveBeenCalledWith(
            expect.objectContaining({ collection: 'blog_categories', id: 'cat-1', data: { status: 'deleted' } }),
        )
    })
})

// ─── TC-F17: Blog CRUD & Tenant Isolation ─────────────────────────────

describe('listBlogsAction [TC-F17.05]', () => {
    beforeEach(() => vi.clearAllMocks())

    it('returns empty when user not authenticated', async () => {
        vi.mocked(getCurrentUser).mockResolvedValue(null)
        const result = await listBlogsAction({})
        expect(result).toEqual({
            data: [],
            meta: null,
        })
    })

    it('scopes blog list to current tenant', async () => {
        vi.mocked(getCurrentUser).mockResolvedValue(mockUser as any)
        mockFind.mockResolvedValue({
            docs: [{ id: 'blog-1', title: 'My Post' }],
            totalDocs: 1,
            totalPages: 1,
            page: 1,
            hasNextPage: false,
            hasPrevPage: false,
        })

        await listBlogsAction({})

        expect(mockFind).toHaveBeenCalledWith(
            expect.objectContaining({
                collection: 'blogs',
                where: expect.objectContaining({
                    tenant: { equals: 'tenant-1' },
                }),
            }),
        )
    })
})

describe('deleteBlogAction [TC-F17.06]', () => {
    beforeEach(() => vi.clearAllMocks())

    it('throws Unauthorized when user not authenticated', async () => {
        vi.mocked(getCurrentUser).mockResolvedValue(null)
        await expect(deleteBlogAction('blog-1')).rejects.toThrow('Unauthorized')
    })

    it('throws when blog belongs to different tenant', async () => {
        vi.mocked(getCurrentUser).mockResolvedValue(mockUser as any)
        mockFindByID.mockResolvedValue({ id: 'blog-1', tenant: { id: 'tenant-other' } })

        await expect(deleteBlogAction('blog-1')).rejects.toThrow('Unauthorized delete access')
        expect(mockDelete).not.toHaveBeenCalled()
    })

    it('deletes blog when tenant matches', async () => {
        vi.mocked(getCurrentUser).mockResolvedValue(mockUser as any)
        mockFindByID.mockResolvedValue({ id: 'blog-1', tenant: { id: 'tenant-1' } })
        mockDelete.mockResolvedValue({})

        const result = await deleteBlogAction('blog-1')
        expect(result).toEqual({ success: true })
    })
})

describe('updateBlogStatusAction [TC-F17.07]', () => {
    beforeEach(() => vi.clearAllMocks())

    it('throws Unauthorized when user not authenticated', async () => {
        vi.mocked(getCurrentUser).mockResolvedValue(null)
        await expect(updateBlogStatusAction('blog-1', 'published')).rejects.toThrow('Unauthorized')
    })

    it('throws when blog belongs to different tenant', async () => {
        vi.mocked(getCurrentUser).mockResolvedValue(mockUser as any)
        mockFindByID.mockResolvedValue({ id: 'blog-1', tenant: { id: 'tenant-other' } })

        await expect(updateBlogStatusAction('blog-1', 'published')).rejects.toThrow('Unauthorized update access')
        expect(mockUpdate).not.toHaveBeenCalled()
    })

    it('updates status when tenant matches', async () => {
        vi.mocked(getCurrentUser).mockResolvedValue(mockUser as any)
        mockFindByID.mockResolvedValue({ id: 'blog-1', tenant: { id: 'tenant-1' } })
        mockUpdate.mockResolvedValue({ id: 'blog-1', status: 'published' })

        const result = await updateBlogStatusAction('blog-1', 'published')
        expect(result).toHaveProperty('status', 'published')
    })
})

describe('getBlogByIdAction [TC-F17.08]', () => {
    beforeEach(() => vi.clearAllMocks())

    it('throws Unauthorized when user not authenticated', async () => {
        vi.mocked(getCurrentUser).mockResolvedValue(null)
        await expect(getBlogByIdAction('blog-1')).rejects.toThrow('Unauthorized')
    })

    it('throws when blog belongs to different tenant', async () => {
        vi.mocked(getCurrentUser).mockResolvedValue(mockUser as any)
        mockFindByID.mockResolvedValue({ id: 'blog-1', title: 'Secret Post', tenant: { id: 'tenant-other' } })

        await expect(getBlogByIdAction('blog-1')).rejects.toThrow('Unauthorized access')
    })

    it('returns blog when tenant matches', async () => {
        vi.mocked(getCurrentUser).mockResolvedValue(mockUser as any)
        mockFindByID.mockResolvedValue({ id: 'blog-1', title: 'My Post', tenant: { id: 'tenant-1' } })

        const result = await getBlogByIdAction('blog-1')
        expect(result).toHaveProperty('title', 'My Post')
    })
})
