/**
 * TC-F08-BS — Blog auto-seed on website generation (GH-871, GH-871+, GH-871++)
 * Source: plans/260507-1103-871-bloglist-auto-seed/phase-01-seed-blog-posts.md
 *         plans/260507-1347-GH-871-blog-seed-thumbnail/phase-01-blog-seed-thumbnail.md
 *         plans/260507-1455-GH-871-ai-blog-seeds/phase-01-ai-blog-seeds.md
 */

import { describe, expect, it, vi, beforeEach } from 'vitest'
import { seedBlogPosts } from '@/lib/ai/seed-blog-posts'
import type { BasePayload } from 'payload'
import type { PixabayPhoto } from '@/lib/ai/pixabay-client'

vi.mock('@/lib/ai/generate-blog-seeds', () => ({
    generateBlogSeedsAI: vi.fn().mockResolvedValue([
        { title: 'AI Post 1', excerpt: 'a'.repeat(50), slug: 'ai-post-1', imageKeyword: 'baking pastry' },
        { title: 'AI Post 2', excerpt: 'b'.repeat(50), slug: 'ai-post-2', imageKeyword: 'cafe interior' },
        { title: 'AI Post 3', excerpt: 'c'.repeat(50), slug: 'ai-post-3', imageKeyword: 'fresh bread' },
    ]),
    generateBlogPostContent: vi.fn().mockResolvedValue('<h2>Rich Content</h2><p>Full blog body here.</p>'),
    isQuotaExhausted: vi.fn().mockReturnValue(false),
}))

vi.mock('@/lib/ai/upload-media', () => ({
    uploadImageUrl: vi.fn().mockResolvedValue(99),
}))

vi.mock('@/lib/images/industry-images', () => ({
    getGalleryImages: vi.fn().mockReturnValue([
        'https://images.unsplash.com/gallery-0',
        'https://images.unsplash.com/gallery-1',
        'https://images.unsplash.com/gallery-2',
    ]),
}))

vi.mock('@/lib/images/blog-thumbnail-images', () => ({
    getBlogThumbnails: vi.fn().mockReturnValue([
        'https://images.unsplash.com/thumb-0',
        'https://images.unsplash.com/thumb-1',
        'https://images.unsplash.com/thumb-2',
    ] as [string, string, string]),
}))

vi.mock('@/lib/ai/pixabay-client', () => {
    class PixabayError extends Error {
        constructor(
            public readonly code: string,
            public readonly status: number,
            public readonly retryable: boolean,
            message?: string,
        ) {
            super(message ?? `[Pixabay] ${code}`)
            this.name = 'PixabayError'
        }
    }
    return {
        searchPhotos: vi.fn().mockResolvedValue([
            {
                id: 'p1',
                url: 'https://pixabay.com/get/photo_1280.jpg',
                alt: 'photo tags',
                photographer: 'Photographer',
                width: 1280,
                height: 720,
            } satisfies Partial<PixabayPhoto>,
        ]),
        PixabayError,
    }
})

vi.mock('@/lib/media/carton-placeholder', () => ({
    findOrCreateCartonMedia: vi.fn().mockResolvedValue({ id: 777 }),
}))

// Lazy imports resolved after vi.mock hoisting
const getGenerateBlogSeedsAI = async () => (await import('@/lib/ai/generate-blog-seeds')).generateBlogSeedsAI
const getGenerateBlogPostContent = async () => (await import('@/lib/ai/generate-blog-seeds')).generateBlogPostContent
const getIsQuotaExhausted = async () => (await import('@/lib/ai/generate-blog-seeds')).isQuotaExhausted
const getUploadImageUrl = async () => (await import('@/lib/ai/upload-media')).uploadImageUrl
const getSearchPhotos = async () => (await import('@/lib/ai/pixabay-client')).searchPhotos
const getGalleryImagesMock = async () => (await import('@/lib/images/industry-images')).getGalleryImages
const getBlogThumbnailsMock = async () => (await import('@/lib/images/blog-thumbnail-images')).getBlogThumbnails
const getFindOrCreateCartonMedia = async () => (await import('@/lib/media/carton-placeholder')).findOrCreateCartonMedia

// Valid media stub returned by default for payload.findByID (used by isValidMedia)
const validMediaStub = { filename: 'test.jpg', mimeType: 'image/jpeg', filesize: 1000 }
const orphanMediaStub = { filename: '', mimeType: '', filesize: 0 }

const makePayload = (countDocs = 0) => ({
    count: vi.fn().mockResolvedValue({ totalDocs: countDocs }),
    find: vi.fn().mockResolvedValue({ docs: [], totalDocs: 0 }),
    create: vi.fn().mockResolvedValue({ id: 1 }),
    findByID: vi.fn().mockResolvedValue(validMediaStub),
}) as unknown as BasePayload

// vi.clearAllMocks clears call history but NOT mockResolvedValueOnce queues.
// Isolation holds because each test consumes every queued Once-value it adds.
// Do NOT switch to vi.resetAllMocks without re-establishing factory defaults below.
beforeEach(() => {
    vi.clearAllMocks()
})

describe('TC-F08-BS.01 — seeds 3 published posts for new tenant', () => {
    it('creates 3 blog records with published status and prefixed slug', async () => {
        const payload = makePayload(0)
        const result = await seedBlogPosts(payload, 42, 99, 'restaurant', 'TestBiz', 7)

        expect(result).toBe(3)
        expect(payload.create).toHaveBeenCalledTimes(3)

        const firstCall = (payload.create as ReturnType<typeof vi.fn>).mock.calls[0][0]
        expect(firstCall.data.status).toBe('published')
        expect(firstCall.data.slug).toMatch(/^42-/)
        expect(firstCall.data.tenant).toBe(42)
        expect(firstCall.data.author).toBe(7)
        expect(firstCall.data.site).toBe(99)
        expect(firstCall.collection).toBe('blogs')
        // content is rich HTML from generateBlogPostContent
        expect(typeof firstCall.data.content).toBe('string')
        expect(firstCall.data.content).toContain('<h2>')
        // thumbnail populated from mocked uploadImageUrl
        expect(firstCall.data.thumbnail).toBe(99)
    })
})

describe('TC-F08-BS.02 — skips seeding when tenant already has blogs', () => {
    it('returns 0 and never calls create when count > 0', async () => {
        const payload = makePayload(3)
        const result = await seedBlogPosts(payload, 42, 99, 'restaurant', 'TestBiz', 7)

        expect(result).toBe(0)
        expect(payload.create).not.toHaveBeenCalled()
    })
})

describe('TC-F08-BS.03 — falls back to business category for unknown category', () => {
    it('still creates 3 posts for an unrecognised category', async () => {
        const payload = makePayload(0)
        const result = await seedBlogPosts(payload, 1, 2, 'unknowncategory', 'AnyBiz', 5)

        // AI mock returns 3 posts regardless of category
        expect(result).toBe(3)
        expect(payload.create).toHaveBeenCalledTimes(3)
    })
})

describe('TC-F08-BS.04 — non-fatal when payload.create throws', () => {
    it('resolves with partial count (not throw) when create fails', async () => {
        const payload = makePayload(0)
        ;(payload.create as ReturnType<typeof vi.fn>)
            .mockRejectedValueOnce(new Error('DB error'))
            .mockResolvedValue({ id: 2 })

        const result = await seedBlogPosts(payload, 1, 2, 'ecommerce', 'ShopBiz', 3)

        // 1 failed, 2 succeeded
        expect(result).toBe(2)
    })
})

describe('TC-F08-BS.05 — context.skipPublishNotify is set on each create call', () => {
    it('passes skipPublishNotify=true so Blogs afterChange hook suppresses notifications', async () => {
        const payload = makePayload(0)
        await seedBlogPosts(payload, 1, 2, 'restaurant', 'Biz', 5)

        const calls = (payload.create as ReturnType<typeof vi.fn>).mock.calls
        expect(calls).toHaveLength(3)
        for (const [arg] of calls) {
            expect(arg.context?.skipPublishNotify).toBe(true)
        }
    })
})

describe('TC-F08-BS.06 — thumbnail attached when upload succeeds', () => {
    it('each of the 3 posts has thumbnail set to the uploadImageUrl return value', async () => {
        const uploadImageUrl = await getUploadImageUrl()
        vi.mocked(uploadImageUrl)
            .mockResolvedValueOnce(101)
            .mockResolvedValueOnce(102)
            .mockResolvedValueOnce(103)

        const payload = makePayload(0)
        const result = await seedBlogPosts(payload, 5, 10, 'beauty', 'GlowBiz', 3)

        expect(result).toBe(3)
        const calls = (payload.create as ReturnType<typeof vi.fn>).mock.calls
        expect(calls[0][0].data.thumbnail).toBe(101)
        expect(calls[1][0].data.thumbnail).toBe(102)
        expect(calls[2][0].data.thumbnail).toBe(103)
    })
})

describe('TC-F08-BS.07 — Tier A upload failure falls through to Tier B', () => {
    it('Tier A rejection cascades to Tier B; all 3 posts still get thumbnails', async () => {
        const uploadImageUrl = await getUploadImageUrl()
        vi.mocked(uploadImageUrl)
            .mockRejectedValueOnce(new Error('network error')) // one Tier A fails
            .mockResolvedValueOnce(202)
            .mockResolvedValueOnce(203)
            // rejected post gets Tier B (default mock = 99)

        const payload = makePayload(0)
        const result = await seedBlogPosts(payload, 7, 20, 'restaurant', 'FoodBiz', 4)

        expect(result).toBe(3)
        // Parallel execution means create-call order ≠ seed order; sort for deterministic check
        const thumbnails = (payload.create as ReturnType<typeof vi.fn>).mock.calls
            .map(([arg]) => arg.data.thumbnail as number)
            .sort((a, b) => a - b)
        expect(thumbnails).toEqual([99, 202, 203])
    })
})

describe('TC-F08-BS.08 — Tier A: searchPhotos called with AI imageKeyword; gallery not used', () => {
    it('uses AI imageKeyword for searchPhotos and does not fall back to gallery', async () => {
        const searchPhotos = await getSearchPhotos()
        const getGalleryImages = await getGalleryImagesMock()
        const uploadImageUrl = await getUploadImageUrl()

        const mockPhoto: PixabayPhoto = {
            id: 'tier-a',
            url: 'https://pixabay.com/get/tier-a_1280.jpg',
            alt: 'tier a tags',
            photographer: 'Photographer',
            width: 1280,
            height: 720,
        }
        vi.mocked(searchPhotos).mockResolvedValue([mockPhoto])
        vi.mocked(uploadImageUrl).mockResolvedValue(300)

        const payload = makePayload(0)
        await seedBlogPosts(payload, 9, 11, 'restaurant', 'DineBiz', 6)

        // searchPhotos called once per post (3 posts) with AI imageKeyword
        expect(searchPhotos).toHaveBeenCalledTimes(3)
        expect(searchPhotos).toHaveBeenNthCalledWith(1, 'baking pastry', 1, { orientation: 'landscape', width: 1200 })
        expect(searchPhotos).toHaveBeenNthCalledWith(2, 'cafe interior', 1, { orientation: 'landscape', width: 1200 })
        expect(searchPhotos).toHaveBeenNthCalledWith(3, 'fresh bread', 1, { orientation: 'landscape', width: 1200 })

        // uploadImageUrl called with photo.url directly (no Imgix transformation on Pixabay)
        expect(uploadImageUrl).toHaveBeenCalledWith(
            'https://pixabay.com/get/tier-a_1280.jpg',
            expect.stringMatching(/^blog-9-/),
            expect.any(String),
            9,
            payload,
        )

        // gallery URLs were NOT passed to uploadImageUrl (Tier A succeeded)
        const galleryUrl = vi.mocked(getGalleryImages).mock.results[0]?.value?.[0]
        const uploadCalls = vi.mocked(uploadImageUrl).mock.calls
        for (const [url] of uploadCalls) {
            expect(url).not.toBe(galleryUrl)
        }
    })
})

describe('TC-F08-BS.08b — all tiers fail: uploadImageUrl undefined + carton null → no thumbnail', () => {
    it('omits thumbnail key entirely when upload always returns undefined and carton also fails', async () => {
        const uploadImageUrl = await getUploadImageUrl()
        vi.mocked(uploadImageUrl).mockResolvedValue(undefined)
        const findOrCreateCartonMedia = await getFindOrCreateCartonMedia()
        vi.mocked(findOrCreateCartonMedia).mockResolvedValue(null)

        const payload = makePayload(0)
        await seedBlogPosts(payload, 3, 6, 'beauty', 'NullBiz', 2)

        const calls = (payload.create as ReturnType<typeof vi.fn>).mock.calls
        expect(calls).toHaveLength(3)
        for (const [arg] of calls) {
            expect(arg.data).not.toHaveProperty('thumbnail')
        }
    })
})

describe('TC-F08-BS.09 — Tier B fallback: searchPhotos returns []; getBlogThumbnails URL used', () => {
    it('uses getBlogThumbnails[i] URL when searchPhotos returns empty; thumbnail still attached', async () => {
        const searchPhotos = await getSearchPhotos()
        const getBlogThumbnails = await getBlogThumbnailsMock()
        const uploadImageUrl = await getUploadImageUrl()

        vi.mocked(searchPhotos).mockResolvedValue([])
        vi.mocked(getBlogThumbnails).mockReturnValue([
            'https://images.unsplash.com/thumb-c-0',
            'https://images.unsplash.com/thumb-c-1',
            'https://images.unsplash.com/thumb-c-2',
        ] as [string, string, string])
        vi.mocked(uploadImageUrl).mockResolvedValue(400)

        const payload = makePayload(0)
        const result = await seedBlogPosts(payload, 11, 22, 'beauty', 'SpaBiz', 8)

        expect(result).toBe(3)

        // uploadImageUrl called with thumbnail URLs at indices 0, 1, 2
        const uploadCalls = vi.mocked(uploadImageUrl).mock.calls
        expect(uploadCalls[0][0]).toBe('https://images.unsplash.com/thumb-c-0')
        expect(uploadCalls[1][0]).toBe('https://images.unsplash.com/thumb-c-1')
        expect(uploadCalls[2][0]).toBe('https://images.unsplash.com/thumb-c-2')

        // All posts have thumbnails
        const createCalls = (payload.create as ReturnType<typeof vi.fn>).mock.calls
        for (const [arg] of createCalls) {
            expect(arg.data.thumbnail).toBe(400)
        }
    })
})

describe('TC-F08-BS.10 — AI happy path: 3 AI seeds → posts use AI titles', () => {
    it('creates 3 posts whose titles match the AI-generated output (not static seeds)', async () => {
        const payload = makePayload(0)
        await seedBlogPosts(payload, 1, 2, 'restaurant', 'BakeryBiz', 3)

        const calls = (payload.create as ReturnType<typeof vi.fn>).mock.calls
        expect(calls[0][0].data.title).toBe('AI Post 1')
        expect(calls[1][0].data.title).toBe('AI Post 2')
        expect(calls[2][0].data.title).toBe('AI Post 3')
    })
})

describe('TC-F08-BS.11 — AI throws → static fallback used', () => {
    it('falls back to static getBlogSeeds when generateBlogSeedsAI rejects', async () => {
        const generateBlogSeedsAI = await getGenerateBlogSeedsAI()
        vi.mocked(generateBlogSeedsAI).mockRejectedValueOnce(new Error('boom'))

        const payload = makePayload(0)
        const result = await seedBlogPosts(payload, 1, 2, 'restaurant', 'FoodBiz', 3)

        expect(result).toBe(3)
        const calls = (payload.create as ReturnType<typeof vi.fn>).mock.calls
        // Static restaurant seeds have different titles than AI Post 1/2/3
        expect(calls[0][0].data.title).not.toBe('AI Post 1')
    })
})

describe('TC-F08-BS.12 — AI quota 429 → static fallback (no retry)', () => {
    it('falls back to static seeds on quota-exhausted error without retrying', async () => {
        const generateBlogSeedsAI = await getGenerateBlogSeedsAI()
        const isQuotaExhausted = await getIsQuotaExhausted()
        const quotaErr = Object.assign(new Error('quota'), { status: 429, code: 'insufficient_quota' })
        vi.mocked(generateBlogSeedsAI).mockRejectedValueOnce(quotaErr)
        vi.mocked(isQuotaExhausted).mockReturnValueOnce(true)

        const payload = makePayload(0)
        const result = await seedBlogPosts(payload, 1, 2, 'restaurant', 'FoodBiz', 3)

        expect(result).toBe(3)
        // AI called exactly once (no retry)
        expect(generateBlogSeedsAI).toHaveBeenCalledTimes(1)
    })
})

describe('TC-F08-BS.13 — AI returns malformed JSON (helper rejects) → static fallback', () => {
    it('falls back to static seeds when generateBlogSeedsAI rejects with SyntaxError', async () => {
        const generateBlogSeedsAI = await getGenerateBlogSeedsAI()
        vi.mocked(generateBlogSeedsAI).mockRejectedValueOnce(new SyntaxError('Unexpected token'))

        const payload = makePayload(0)
        const result = await seedBlogPosts(payload, 1, 2, 'beauty', 'SpaBiz', 3)

        expect(result).toBe(3)
        const calls = (payload.create as ReturnType<typeof vi.fn>).mock.calls
        expect(calls[0][0].data.title).not.toBe('AI Post 1')
    })
})

describe('TC-F08-BS.14 — AI returns empty array (helper rejects) → static fallback', () => {
    it('falls back to static seeds when generateBlogSeedsAI rejects with empty-array error', async () => {
        const generateBlogSeedsAI = await getGenerateBlogSeedsAI()
        vi.mocked(generateBlogSeedsAI).mockRejectedValueOnce(
            new Error('AI returned empty or invalid posts array'),
        )

        const payload = makePayload(0)
        const result = await seedBlogPosts(payload, 1, 2, 'ecommerce', 'ShopBiz', 3)

        expect(result).toBe(3)
        const calls = (payload.create as ReturnType<typeof vi.fn>).mock.calls
        expect(calls[0][0].data.title).not.toBe('AI Post 1')
    })
})

describe('TC-F08-BS.15 — AI returns 2 items → 2 AI + 1 static fill', () => {
    it('uses 2 AI posts and fills 1 from static, creating 3 total', async () => {
        const generateBlogSeedsAI = await getGenerateBlogSeedsAI()
        vi.mocked(generateBlogSeedsAI).mockResolvedValueOnce([
            { title: 'AI Only 1', excerpt: 'exc1', slug: 'ai-only-1', imageKeyword: 'bread loaf' },
            { title: 'AI Only 2', excerpt: 'exc2', slug: 'ai-only-2', imageKeyword: 'coffee cup' },
        ])

        const payload = makePayload(0)
        const result = await seedBlogPosts(payload, 1, 2, 'restaurant', 'FoodBiz', 3)

        expect(result).toBe(3)
        const calls = (payload.create as ReturnType<typeof vi.fn>).mock.calls
        // First 2 posts from AI
        expect(calls[0][0].data.title).toBe('AI Only 1')
        expect(calls[1][0].data.title).toBe('AI Only 2')
        // Third post from static (different title)
        expect(calls[2][0].data.title).not.toBe('AI Only 1')
        expect(calls[2][0].data.title).not.toBe('AI Only 2')
    })
})

describe('TC-F08-BS.16 — AI imageKeyword passed to searchPhotos (not category)', () => {
    it('calls searchPhotos with the AI-provided imageKeyword', async () => {
        const searchPhotos = await getSearchPhotos()

        const payload = makePayload(0)
        await seedBlogPosts(payload, 1, 2, 'restaurant', 'BakeryBiz', 3)

        expect(searchPhotos).toHaveBeenNthCalledWith(1, 'baking pastry', 1, { orientation: 'landscape', width: 1200 })
        expect(searchPhotos).toHaveBeenNthCalledWith(2, 'cafe interior', 1, { orientation: 'landscape', width: 1200 })
        expect(searchPhotos).toHaveBeenNthCalledWith(3, 'fresh bread', 1, { orientation: 'landscape', width: 1200 })
    })
})

describe('TC-F08-BS.17 — OPENAI_API_KEY unset: helper rejects → static fallback', () => {
    it('falls back to static seeds when generateBlogSeedsAI rejects (simulates missing key)', async () => {
        const generateBlogSeedsAI = await getGenerateBlogSeedsAI()
        vi.mocked(generateBlogSeedsAI).mockRejectedValueOnce(new Error('OPENAI_API_KEY not set'))

        const payload = makePayload(0)
        const result = await seedBlogPosts(payload, 1, 2, 'beauty', 'GlowBiz', 3)

        expect(result).toBe(3)
        // AI was attempted exactly once (no retry on missing key)
        expect(generateBlogSeedsAI).toHaveBeenCalledTimes(1)
    })
})

describe('TC-F08-BS.18 — AI returns 3 items with same slug → suffix disambiguation', () => {
    it('appends -1, -2 suffixes to disambiguate within-batch duplicate slugs', async () => {
        const generateBlogSeedsAI = await getGenerateBlogSeedsAI()
        vi.mocked(generateBlogSeedsAI).mockResolvedValueOnce([
            { title: 'Post A', excerpt: 'excA', slug: 'duplicate', imageKeyword: 'kw1' },
            { title: 'Post B', excerpt: 'excB', slug: 'duplicate', imageKeyword: 'kw2' },
            { title: 'Post C', excerpt: 'excC', slug: 'duplicate', imageKeyword: 'kw3' },
        ])

        const payload = makePayload(0)
        const result = await seedBlogPosts(payload, 42, 2, 'restaurant', 'DineBiz', 3)

        expect(result).toBe(3)
        const calls = (payload.create as ReturnType<typeof vi.fn>).mock.calls
        expect(calls[0][0].data.slug).toBe('42-duplicate')
        expect(calls[1][0].data.slug).toBe('42-duplicate-1')
        expect(calls[2][0].data.slug).toBe('42-duplicate-2')
    })
})

describe('TC-F08-BS.19 — generateBlogPostContent failure → fallback to excerpt', () => {
    it('creates post with <p>excerpt</p> when content generation throws', async () => {
        const generateBlogPostContent = await getGenerateBlogPostContent()
        vi.mocked(generateBlogPostContent).mockRejectedValue(new Error('content gen failed'))

        const payload = makePayload(0)
        const result = await seedBlogPosts(payload, 1, 2, 'restaurant', 'FoodBiz', 3)

        expect(result).toBe(3)
        const calls = (payload.create as ReturnType<typeof vi.fn>).mock.calls
        for (const [arg] of calls) {
            expect(arg.data.content).toMatch(/^<p>.*<\/p>$/)
        }
    })
})

describe('TC-F08-BS.20 — Tier B: getBlogThumbnails called with category; indices cycle correctly', () => {
    it('calls getBlogThumbnails with seeding category and assigns distinct URL per post index', async () => {
        const searchPhotos = await getSearchPhotos()
        const getBlogThumbnails = await getBlogThumbnailsMock()
        const uploadImageUrl = await getUploadImageUrl()

        vi.mocked(searchPhotos).mockResolvedValue([])
        vi.mocked(getBlogThumbnails).mockReturnValue([
            'https://images.unsplash.com/thumb-r-0',
            'https://images.unsplash.com/thumb-r-1',
            'https://images.unsplash.com/thumb-r-2',
        ] as [string, string, string])
        vi.mocked(uploadImageUrl).mockResolvedValue(500)

        const payload = makePayload(0)
        const result = await seedBlogPosts(payload, 1, 2, 'restaurant', 'DineBiz', 3)

        expect(result).toBe(3)
        expect(getBlogThumbnails).toHaveBeenCalledWith('restaurant')

        const uploadCalls = vi.mocked(uploadImageUrl).mock.calls
        expect(uploadCalls[0][0]).toBe('https://images.unsplash.com/thumb-r-0')
        expect(uploadCalls[1][0]).toBe('https://images.unsplash.com/thumb-r-1')
        expect(uploadCalls[2][0]).toBe('https://images.unsplash.com/thumb-r-2')

        const createCalls = (payload.create as ReturnType<typeof vi.fn>).mock.calls
        for (const [arg] of createCalls) {
            expect(arg.data.thumbnail).toBe(500)
        }
    })
})

describe('TC-F08-BS.22 — orphan media: Tier A+B upload IDs invalid (filesize=0) → Tier C carton', () => {
    it('falls to Tier C carton when both Tier A and Tier B uploads produce orphan media rows', async () => {
        // Must explicitly set searchPhotos to return a photo so Tier A is actually attempted
        // (prior tests may have set it to []  — clearAllMocks resets call counts but not implementations)
        const searchPhotos = await getSearchPhotos()
        vi.mocked(searchPhotos).mockResolvedValue([{
            id: 'photo-abc',
            url: 'https://pixabay.com/get/photo-abc_1280.jpg',
            alt: 'photo tags',
            photographer: 'Photographer',
            width: 1280,
            height: 800,
        } as PixabayPhoto])

        const findOrCreateCartonMedia = await getFindOrCreateCartonMedia()
        vi.mocked(findOrCreateCartonMedia).mockResolvedValue({ id: 888 } as never)

        const payload = makePayload(0)
        // All findByID calls return orphan (filesize=0) — uploadImageUrl returns IDs but S3 row is invalid
        ;(payload.findByID as ReturnType<typeof vi.fn>).mockResolvedValue(orphanMediaStub)

        const result = await seedBlogPosts(payload, 5, 10, 'restaurant', 'Biz', 3)

        expect(result).toBe(3)
        const createCalls = (payload.create as ReturnType<typeof vi.fn>).mock.calls
        for (const [arg] of createCalls) {
            expect(arg.data.thumbnail).toBe(888)
        }
    })
})

describe('TC-F08-BS.23 — Pixabay 429 on seed 1 → searchRateLimited set, seeds 2+3 skip Tier A', () => {
    it('calls searchPhotos once when first seed hits RATE_LIMITED; remaining seeds use Tier B directly', async () => {
        const { PixabayError: PixabayErrorClass } = await import('@/lib/ai/pixabay-client')
        const searchPhotos = await getSearchPhotos()
        const uploadImageUrl = await getUploadImageUrl()

        vi.mocked(searchPhotos).mockRejectedValue(new PixabayErrorClass('RATE_LIMITED', 429, true))
        vi.mocked(uploadImageUrl).mockResolvedValue(555)

        const payload = makePayload(0)
        const result = await seedBlogPosts(payload, 5, 10, 'beauty', 'Biz', 3)

        expect(result).toBe(3)
        // searchPhotos called only for seed 0; seeds 1+2 skip Tier A due to searchRateLimited flag
        expect(searchPhotos).toHaveBeenCalledTimes(1)
        // All posts get thumbnails from Tier B (upload 555)
        const createCalls = (payload.create as ReturnType<typeof vi.fn>).mock.calls
        for (const [arg] of createCalls) {
            expect(arg.data.thumbnail).toBe(555)
        }
    })
})

describe('TC-F08-BS.21 — all tiers fail: Tier A/B uploads reject + carton null → no thumbnail', () => {
    it('creates all 3 posts without thumbnail when all upload tiers and carton fail', async () => {
        const searchPhotos = await getSearchPhotos()
        const uploadImageUrl = await getUploadImageUrl()
        const findOrCreateCartonMedia = await getFindOrCreateCartonMedia()

        vi.mocked(searchPhotos).mockResolvedValue([])
        vi.mocked(uploadImageUrl).mockRejectedValue(new Error('S3 down'))
        vi.mocked(findOrCreateCartonMedia).mockResolvedValue(null)

        const payload = makePayload(0)
        const result = await seedBlogPosts(payload, 1, 2, 'unknowncategory', 'Biz', 3)

        expect(result).toBe(3)
        const createCalls = (payload.create as ReturnType<typeof vi.fn>).mock.calls
        expect(createCalls).toHaveLength(3)
        for (const [arg] of createCalls) {
            expect(arg.data).not.toHaveProperty('thumbnail')
        }
    })
})
