/**
 * TC-F08-BG — AI blog-seed helpers: isQuotaExhausted, generateBlogSeedsAI, generateBlogPostContent
 * Source: plans/260507-1455-GH-871-ai-blog-seeds/phase-01-ai-blog-seeds.md
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('openai', () => ({ default: vi.fn() }))

import { isQuotaExhausted, generateBlogSeedsAI, generateBlogPostContent } from '@/lib/ai/generate-blog-seeds'

async function getOpenAIClass() {
    return (await import('openai')).default as ReturnType<typeof vi.fn>
}

function makeCreate(jsonContent: string) {
    return vi.fn().mockResolvedValue({ choices: [{ message: { content: jsonContent } }] })
}

function mockOpenAI(mockCreate: ReturnType<typeof vi.fn>) {
    return { chat: { completions: { create: mockCreate } } }
}

// ── isQuotaExhausted ─────────────────────────────────────────────────────────

describe('TC-F08-BG.01–05 — isQuotaExhausted pure logic', () => {
    it('BG.01 — returns false for non-Error values', () => {
        expect(isQuotaExhausted('string')).toBe(false)
        expect(isQuotaExhausted(null)).toBe(false)
        expect(isQuotaExhausted(429)).toBe(false)
    })

    it('BG.02 — returns false for plain Error (no status)', () => {
        expect(isQuotaExhausted(new Error('network error'))).toBe(false)
    })

    it('BG.03 — returns false for 429 without code', () => {
        expect(isQuotaExhausted(Object.assign(new Error('quota'), { status: 429 }))).toBe(false)
    })

    it('BG.04 — returns false for 429 + wrong code', () => {
        expect(isQuotaExhausted(
            Object.assign(new Error('rate'), { status: 429, code: 'rate_limit_exceeded' })
        )).toBe(false)
    })

    it('BG.05 — returns true for 429 + insufficient_quota', () => {
        expect(isQuotaExhausted(
            Object.assign(new Error('quota'), { status: 429, code: 'insufficient_quota' })
        )).toBe(true)
    })
})

// ── generateBlogSeedsAI ──────────────────────────────────────────────────────

describe('TC-F08-BG.06 — generateBlogSeedsAI: throws when no API key', () => {
    it('throws OPENAI_API_KEY not set', async () => {
        delete process.env.OPENAI_API_KEY
        await expect(generateBlogSeedsAI({ businessName: 'Biz', industry: 'tech' }))
            .rejects.toThrow('OPENAI_API_KEY not set')
    })
})

describe('TC-F08-BG.07 — generateBlogSeedsAI: returns 3 posts with correct shape', () => {
    beforeEach(async () => {
        process.env.OPENAI_API_KEY = 'test-key'
        const posts = [
            { title: 'Post A', excerpt: 'Excerpt A', slug: 'post-a', imageKeyword: 'bakery bread' },
            { title: 'Post B', excerpt: 'Excerpt B', slug: 'post-b', imageKeyword: 'coffee shop' },
            { title: 'Post C', excerpt: 'Excerpt C', slug: 'post-c', imageKeyword: 'sweet cake' },
        ]
        const OpenAI = await getOpenAIClass()
        OpenAI.mockImplementation(() => mockOpenAI(makeCreate(JSON.stringify({ posts }))))
    })
    afterEach(() => { delete process.env.OPENAI_API_KEY })

    it('returns array of 3 BlogSeedAI items with all fields', async () => {
        const results = await generateBlogSeedsAI({ businessName: 'BakeBiz', industry: 'bakery' })
        expect(results).toHaveLength(3)
        expect(results[0]).toMatchObject({ title: 'Post A', slug: 'post-a', imageKeyword: 'bakery bread' })
        for (const r of results) {
            expect(r).toHaveProperty('title')
            expect(r).toHaveProperty('excerpt')
            expect(r).toHaveProperty('slug')
            expect(r).toHaveProperty('imageKeyword')
        }
    })
})

describe('TC-F08-BG.08 — generateBlogSeedsAI: enforces field length limits from AI response', () => {
    beforeEach(async () => {
        process.env.OPENAI_API_KEY = 'test-key'
        const OpenAI = await getOpenAIClass()
        OpenAI.mockImplementation(() => mockOpenAI(makeCreate(JSON.stringify({
            posts: [{ title: 'A'.repeat(100), excerpt: 'B'.repeat(200), slug: 's', imageKeyword: 'kw' }],
        }))))
    })
    afterEach(() => { delete process.env.OPENAI_API_KEY })

    it('truncates title to ≤70 chars and excerpt to ≤160 chars', async () => {
        const [post] = await generateBlogSeedsAI({ businessName: 'Biz', industry: 'tech' })
        expect(post!.title.length).toBeLessThanOrEqual(70)
        expect(post!.excerpt.length).toBeLessThanOrEqual(160)
    })
})

describe('TC-F08-BG.09 — generateBlogSeedsAI: slugifies slug field', () => {
    beforeEach(async () => {
        process.env.OPENAI_API_KEY = 'test-key'
        const OpenAI = await getOpenAIClass()
        OpenAI.mockImplementation(() => mockOpenAI(makeCreate(JSON.stringify({
            posts: [{ title: 'Post A', excerpt: 'Ex', slug: 'My Blog Post!!', imageKeyword: 'kw' }],
        }))))
    })
    afterEach(() => { delete process.env.OPENAI_API_KEY })

    it('converts AI slug to kebab-case, strips special chars', async () => {
        const [post] = await generateBlogSeedsAI({ businessName: 'Biz', industry: 'tech' })
        expect(post!.slug).toBe('my-blog-post')
    })
})

describe('TC-F08-BG.10 — generateBlogSeedsAI: businessName >100 chars truncated in prompt', () => {
    let mockCreate: ReturnType<typeof vi.fn>
    beforeEach(async () => {
        process.env.OPENAI_API_KEY = 'test-key'
        mockCreate = makeCreate(JSON.stringify({ posts: [{ title: 'T', excerpt: 'E', slug: 's', imageKeyword: 'k' }] }))
        const OpenAI = await getOpenAIClass()
        OpenAI.mockImplementation(() => mockOpenAI(mockCreate))
    })
    afterEach(() => { delete process.env.OPENAI_API_KEY })

    it('injects max 100 chars of businessName into user prompt', async () => {
        await generateBlogSeedsAI({ businessName: 'A'.repeat(150), industry: 'tech' })
        const userContent: string = mockCreate.mock.calls[0][0].messages[1].content
        expect(userContent).toContain(`"${'A'.repeat(100)}"`)
        expect(userContent).not.toContain('A'.repeat(101))
    })
})

describe('TC-F08-BG.11 — generateBlogSeedsAI: industry >50 chars truncated in prompt', () => {
    let mockCreate: ReturnType<typeof vi.fn>
    beforeEach(async () => {
        process.env.OPENAI_API_KEY = 'test-key'
        mockCreate = makeCreate(JSON.stringify({ posts: [{ title: 'T', excerpt: 'E', slug: 's', imageKeyword: 'k' }] }))
        const OpenAI = await getOpenAIClass()
        OpenAI.mockImplementation(() => mockOpenAI(mockCreate))
    })
    afterEach(() => { delete process.env.OPENAI_API_KEY })

    it('injects max 50 chars of industry into user prompt', async () => {
        await generateBlogSeedsAI({ businessName: 'Biz', industry: 'X'.repeat(80) })
        const userContent: string = mockCreate.mock.calls[0][0].messages[1].content
        expect(userContent).toContain('X'.repeat(50))
        expect(userContent).not.toContain('X'.repeat(51))
    })
})

describe('TC-F08-BG.12 — generateBlogSeedsAI: throws on empty posts array', () => {
    beforeEach(async () => {
        process.env.OPENAI_API_KEY = 'test-key'
        const OpenAI = await getOpenAIClass()
        OpenAI.mockImplementation(() => mockOpenAI(makeCreate(JSON.stringify({ posts: [] }))))
    })
    afterEach(() => { delete process.env.OPENAI_API_KEY })

    it('throws with descriptive error', async () => {
        await expect(generateBlogSeedsAI({ businessName: 'Biz', industry: 'tech' }))
            .rejects.toThrow('AI returned empty or invalid posts array')
    })
})

describe('TC-F08-BG.13 — generateBlogSeedsAI: throws on invalid JSON', () => {
    beforeEach(async () => {
        process.env.OPENAI_API_KEY = 'test-key'
        const OpenAI = await getOpenAIClass()
        OpenAI.mockImplementation(() => mockOpenAI(makeCreate('not valid json {{{')))
    })
    afterEach(() => { delete process.env.OPENAI_API_KEY })

    it('throws SyntaxError on parse failure', async () => {
        await expect(generateBlogSeedsAI({ businessName: 'Biz', industry: 'tech' }))
            .rejects.toThrow(SyntaxError)
    })
})

// ── generateBlogPostContent ──────────────────────────────────────────────────

describe('TC-F08-BG.14 — generateBlogPostContent: throws when no API key', () => {
    it('throws OPENAI_API_KEY not set', async () => {
        delete process.env.OPENAI_API_KEY
        await expect(generateBlogPostContent('Title', 'Biz', 'tech'))
            .rejects.toThrow('OPENAI_API_KEY not set')
    })
})

describe('TC-F08-BG.15 — generateBlogPostContent: returns HTML string on success', () => {
    beforeEach(async () => {
        process.env.OPENAI_API_KEY = 'test-key'
        const OpenAI = await getOpenAIClass()
        OpenAI.mockImplementation(() => mockOpenAI(makeCreate(JSON.stringify({ content: '<h2>Intro</h2><p>Body.</p>' }))))
    })
    afterEach(() => { delete process.env.OPENAI_API_KEY })

    it('returns the HTML content string', async () => {
        const result = await generateBlogPostContent('My Post', 'BakeBiz', 'bakery')
        expect(result).toBe('<h2>Intro</h2><p>Body.</p>')
    })
})

describe('TC-F08-BG.16 — generateBlogPostContent: throws when content field absent', () => {
    beforeEach(async () => {
        process.env.OPENAI_API_KEY = 'test-key'
        const OpenAI = await getOpenAIClass()
        OpenAI.mockImplementation(() => mockOpenAI(makeCreate(JSON.stringify({ other_field: 'oops' }))))
    })
    afterEach(() => { delete process.env.OPENAI_API_KEY })

    it('throws No content in response', async () => {
        await expect(generateBlogPostContent('Title', 'Biz', 'tech'))
            .rejects.toThrow('No content in response')
    })
})

describe('TC-F08-BG.17 — generateBlogPostContent: truncates businessName/industry in prompt', () => {
    let mockCreate: ReturnType<typeof vi.fn>
    beforeEach(async () => {
        process.env.OPENAI_API_KEY = 'test-key'
        mockCreate = makeCreate(JSON.stringify({ content: '<p>ok</p>' }))
        const OpenAI = await getOpenAIClass()
        OpenAI.mockImplementation(() => mockOpenAI(mockCreate))
    })
    afterEach(() => { delete process.env.OPENAI_API_KEY })

    it('injects max 100/50 chars of businessName/industry', async () => {
        await generateBlogPostContent('Post', 'A'.repeat(150), 'X'.repeat(80))
        const userContent: string = mockCreate.mock.calls[0][0].messages[1].content
        expect(userContent).toContain(`"${'A'.repeat(100)}"`)
        expect(userContent).toContain('X'.repeat(50))
        expect(userContent).not.toContain('A'.repeat(101))
        expect(userContent).not.toContain('X'.repeat(51))
    })
})

describe('TC-F08-BG.18 — generateBlogSeedsAI: products capped at 6 items in prompt', () => {
    let mockCreate: ReturnType<typeof vi.fn>
    beforeEach(async () => {
        process.env.OPENAI_API_KEY = 'test-key'
        mockCreate = makeCreate(JSON.stringify({ posts: [{ title: 'T', excerpt: 'E', slug: 's', imageKeyword: 'k' }] }))
        const OpenAI = await getOpenAIClass()
        OpenAI.mockImplementation(() => mockOpenAI(mockCreate))
    })
    afterEach(() => { delete process.env.OPENAI_API_KEY })

    it('injects at most 6 products into the prompt regardless of input length', async () => {
        const tenProducts = Array.from({ length: 10 }, (_, i) => `Product${i}`)
        await generateBlogSeedsAI({ businessName: 'Biz', industry: 'tech', products: tenProducts })
        const userContent: string = mockCreate.mock.calls[0][0].messages[1].content
        expect(userContent).toContain('Product5')
        expect(userContent).not.toContain('Product6')
    })
})

describe('TC-F08-BG.19 — generateBlogSeedsAI: per-product string capped at 60 chars', () => {
    let mockCreate: ReturnType<typeof vi.fn>
    beforeEach(async () => {
        process.env.OPENAI_API_KEY = 'test-key'
        mockCreate = makeCreate(JSON.stringify({ posts: [{ title: 'T', excerpt: 'E', slug: 's', imageKeyword: 'k' }] }))
        const OpenAI = await getOpenAIClass()
        OpenAI.mockImplementation(() => mockOpenAI(mockCreate))
    })
    afterEach(() => { delete process.env.OPENAI_API_KEY })

    it('truncates each product to 60 chars before injecting into prompt', async () => {
        const longProduct = 'P'.repeat(100)
        await generateBlogSeedsAI({ businessName: 'Biz', industry: 'tech', products: [longProduct] })
        const userContent: string = mockCreate.mock.calls[0][0].messages[1].content
        expect(userContent).toContain('P'.repeat(60))
        expect(userContent).not.toContain('P'.repeat(61))
    })
})
