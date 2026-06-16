import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockUser = { id: 1, tenants: [{ tenant: { id: 'tenant-1' }, role: 'owner' }] }
vi.mock('@/lib/auth', () => ({
    getCurrentUser: vi.fn(() => Promise.resolve(mockUser)),
}))

const mockFind = vi.fn()
const mockCreate = vi.fn()
const mockUpdate = vi.fn()
const mockFindByID = vi.fn()
vi.mock('payload', () => ({
    getPayload: vi.fn(() => Promise.resolve({
        find: mockFind,
        create: mockCreate,
        update: mockUpdate,
        findByID: mockFindByID,
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

import { createBlogCategoryAction, saveBlogAction, listBlogsAction } from '@/app/(dashboard)/blog/actions'

// ─── TC-F17: Category Duplicate Name Check ───────────────────────────

describe('createBlogCategoryAction — duplicate name [TC-F17.05]', () => {
    beforeEach(() => vi.clearAllMocks())

    it('[TC-07] rejects duplicate category name within same tenant', async () => {
        // First find: site lookup
        mockFind.mockResolvedValueOnce({ docs: [{ id: 'site-1' }] })
        // Second find: duplicate check — returns existing
        mockFind.mockResolvedValueOnce({ docs: [{ id: 'cat-existing', name: 'Tech' }] })

        const result = await createBlogCategoryAction({ name: 'Tech' })
        expect(result).toEqual({ error: 'A category with this name already exists' })
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
