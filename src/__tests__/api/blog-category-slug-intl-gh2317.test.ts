// GH-2317 follow-up: blog category slugs for Vietnamese "đ" and for names with no Latin letters.
// TC-F17-05-10 — "đ" becomes "d", Chinese/Japanese names are romanized; existing slugs keep their shape.
// TC-F17-05-11 — an emoji/symbol-only name still gets a slug (it used to be empty, which the required
//                slug field refused with a generic error), and the same name is still caught as a duplicate.
// Real: toBlogCategorySlug, blogCategoryNameTaken, POST /api/blog-categories. Faked: auth, plan guard, Payload I/O.

import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockUser = { id: 1, tenants: [{ tenant: 'tenant-1' }] }
vi.mock('@/lib/auth', () => ({
    withAuth: vi.fn((handler: any) => async (req: any, ctx?: any) => handler(mockUser, req, ctx)),
    getCurrentUser: vi.fn(async () => mockUser),
}))

const mockFind = vi.fn()
const mockCreate = vi.fn()
vi.mock('payload', () => ({
    getPayload: vi.fn(() => Promise.resolve({ find: mockFind, create: mockCreate })),
}))
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('@/lib/subscriptions/feature-guard', () => ({
    withFeatureGuard: vi.fn(() => (h: any) => h),
}))
vi.mock('@/lib/subscriptions/plan-subscription', () => ({
    getActivePlanSubscription: vi.fn().mockResolvedValue({ id: 'sub-1', plan: 'PROFESSIONAL_TM_USER', status: 'active' }),
    canUse: vi.fn().mockResolvedValue(true),
}))

import { toBlogCategorySlug } from '@/lib/blog/blog-category-name'
import { POST } from '@/app/api/blog-categories/route'

const jsonReq = (body: unknown) => ({ json: () => Promise.resolve(body) }) as unknown as Request

describe('[TC-F17-05-10] category slug for Vietnamese and CJK names', () => {
    it.each([
        ['Đồ uống', 'do-uong'],
        ['ĐẶC BIỆT', 'dac-biet'],
        ['新闻', 'xin-wen'],
        ['ニュース', 'nyusu'],
        ['Kopi 新闻', 'kopi-xin-wen'],
    ])('"%s" → %s', (name, slug) => {
        // Arrange / Act / Assert
        expect(toBlogCategorySlug(name)).toBe(slug)
    })

    it.each([
        ['Tin tức', 'tin-tuc'],
        ['Kopi & Teh', 'kopi-teh'],
        ['Café Tips', 'cafe-tips'],
        ['AI', 'ai'],
        ['  Recent   News ', 'recent-news'],
    ])('names that already worked keep their slug: "%s" → %s', (name, slug) => {
        // Arrange / Act / Assert
        expect(toBlogCategorySlug(name)).toBe(slug)
    })
})

describe('[TC-F17-05-11] emoji or symbol-only category names', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('get a stable fallback slug, different per name', () => {
        // Arrange / Act
        const noodles = toBlogCategorySlug('🍜🍜')
        const again = toBlogCategorySlug('🍜🍜')
        const coffee = toBlogCategorySlug('☕')

        // Assert
        expect(noodles).toMatch(/^category-[a-z0-9]{7}$/)
        expect(again).toBe(noodles)
        expect(coffee).toMatch(/^category-[a-z0-9]{7}$/)
        expect(coffee).not.toBe(noodles)
    })

    it('names that differ only in spacing or letter case share one slug, like Latin names do', () => {
        // Arrange / Act / Assert
        expect(toBlogCategorySlug('🍜  🍜')).toBe(toBlogCategorySlug(' 🍜 🍜 '))
        expect(toBlogCategorySlug('Ω🍜')).toBe(toBlogCategorySlug('ω🍜'))
    })

    it('Korean and Thai names (not romanized) also get a fallback slug', () => {
        // Arrange / Act / Assert
        expect(toBlogCategorySlug('한국 뉴스')).toMatch(/^category-[a-z0-9]{7}$/)
        expect(toBlogCategorySlug('ข่าว')).toMatch(/^category-[a-z0-9]{7}$/)
    })

    it('POST a name of only spaces → 400, nothing created (it used to reach the database with an empty slug)', async () => {
        // Arrange
        mockFind.mockResolvedValue({ docs: [] })

        // Act
        const res = await POST(jsonReq({ name: '   ' }), {} as any)

        // Assert
        expect(res.status).toBe(400)
        expect(mockCreate).not.toHaveBeenCalled()
    })

    it('POST a Chinese name creates the category with a romanized slug', async () => {
        // Arrange
        mockFind.mockResolvedValue({ docs: [] })
        mockCreate.mockImplementation(async ({ data }) => ({ id: 'cat-new', ...data }))

        // Act
        const res = await POST(jsonReq({ name: '新闻' }), {} as any)

        // Assert
        expect(res.status).toBe(201)
        expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({
            collection: 'blog_categories',
            data: expect.objectContaining({ name: '新闻', slug: 'xin-wen' }),
        }))
    })

    it('POST the same emoji name twice → 409 DUPLICATE_SLUG, nothing created', async () => {
        // Arrange
        mockFind.mockResolvedValue({ docs: [{ id: 'cat-1', name: '🍜🍜', slug: toBlogCategorySlug('🍜🍜') }] })

        // Act
        const res = await POST(jsonReq({ name: '🍜🍜' }), {} as any)
        const json = await res.json()

        // Assert
        expect(res.status).toBe(409)
        expect(json.error.code).toBe('DUPLICATE_SLUG')
        expect(mockCreate).not.toHaveBeenCalled()
    })
})
