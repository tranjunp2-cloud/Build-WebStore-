/**
 * TC-F08-BG — AI blog-seed helpers: isQuotaExhausted, generateBlogSeedsAI, generateBlogPostContent
 * Source: plans/260507-1455-GH-871-ai-blog-seeds/phase-01-ai-blog-seeds.md
 *
 * The model calls are the AI platform tasks `sitegen.blog-seeds` / `sitegen.blog-post-content`
 * (composed prompts via completeComposed). The platform client is faked; the actor scope is real.
 * Behaviour change recorded here: isQuotaExhausted is status-based (any 429, or no AI actor),
 * no longer keyed on the OpenAI `insufficient_quota` code (BG.03/BG.04 updated accordingly).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { AiClientError } from '@ech/ai-contracts'
import { AiUnavailableError } from '@/lib/ai-platform/actor-scope'
import { runWithAiActor } from '@/lib/ai-platform/actor-scope'
import { isQuotaExhausted, generateBlogSeedsAI, generateBlogPostContent } from '@/lib/ai/generate-blog-seeds'

const runTask = vi.hoisted(() => vi.fn())
vi.mock('@/lib/ai-platform/task-client', () => ({ getAiTaskClient: () => ({ runTask }) }))

const ACTOR = { user: { id: 7 }, tenantId: '1', organizationId: 'org_1', role: 'owner' } as never
const inScope = <T>(run: () => Promise<T>) => runWithAiActor(ACTOR, run)
const answer = (output: unknown) => ({ taskId: 'sitegen.blog-seeds', output, usage: { model: 'test', inputTokens: 10, outputTokens: 5 } })

function seedsOutput(posts: unknown[]) {
    return answer({ posts })
}

const seed = { title: 'T', excerpt: 'E', slug: 's', imageKeyword: 'k' }

beforeEach(() => {
    vi.stubEnv('AI_PLATFORM_URL', 'http://ai.internal:8300')
    vi.stubEnv('AI_PLATFORM_CONTEXT_SECRET', 'test-context-secret-at-least-32-characters')
    runTask.mockReset()
})

afterEach(() => {
    vi.unstubAllEnvs()
})

// ── isQuotaExhausted ─────────────────────────────────────────────────────────

describe('TC-F08-BG.01–05 — isQuotaExhausted pure logic', () => {
    it('BG.01 — returns false for non-Error values', () => {
        expect(isQuotaExhausted('string error')).toBe(false)
        expect(isQuotaExhausted(null)).toBe(false)
        expect(isQuotaExhausted(undefined)).toBe(false)
    })

    it('BG.02 — returns false for plain Error (no status)', () => {
        expect(isQuotaExhausted(new Error('boom'))).toBe(false)
    })

    it('BG.03 — returns true for a 429 without a code (status-based since the platform cutover)', () => {
        expect(isQuotaExhausted(Object.assign(new Error('limited'), { status: 429 }))).toBe(true)
    })

    it('BG.04 — returns true for a 429 with any code', () => {
        expect(isQuotaExhausted(Object.assign(new Error('limited'), { status: 429, code: 'rate_limit_exceeded' }))).toBe(true)
    })

    it('BG.05 — returns true for the platform quota error (AiClientError 429)', () => {
        expect(isQuotaExhausted(new AiClientError("Your workspace reached today's AI limit.", 429))).toBe(true)
    })

    it('BG.05b — returns false for a non-quota platform outage (AiClientError 503)', () => {
        expect(isQuotaExhausted(new AiClientError('upstream down', 503))).toBe(false)
    })

    it('BG.05c — returns true when no AI actor is in scope (AiUnavailableError)', () => {
        expect(isQuotaExhausted(new AiUnavailableError())).toBe(true)
    })
})

// ── generateBlogSeedsAI ──────────────────────────────────────────────────────

describe('TC-F08-BG.06 — generateBlogSeedsAI: no AI actor', () => {
    it('throws AiUnavailableError and makes no platform call', async () => {
        await expect(generateBlogSeedsAI({ businessName: 'Biz', industry: 'cafe' })).rejects.toBeInstanceOf(AiUnavailableError)
        expect(runTask).not.toHaveBeenCalled()
    })
})

describe('TC-F08-BG.07 — generateBlogSeedsAI: returns 3 posts with correct shape', () => {
    beforeEach(() => {
        runTask.mockResolvedValue(seedsOutput([
            { title: 'Post One', excerpt: 'Excerpt one.', slug: 'post-one', imageKeyword: 'coffee beans' },
            { title: 'Post Two', excerpt: 'Excerpt two.', slug: 'post-two', imageKeyword: 'latte art' },
            { title: 'Post Three', excerpt: 'Excerpt three.', slug: 'post-three', imageKeyword: 'cafe interior' },
            { title: 'Dropped', excerpt: 'Beyond three.', slug: 'dropped', imageKeyword: 'x' },
        ]))
    })

    it('returns array of 3 BlogSeedAI items with all fields', async () => {
        const posts = await inScope(() => generateBlogSeedsAI({ businessName: 'Kopi Kaki', industry: 'cafe' }))

        expect(posts).toEqual([
            { title: 'Post One', excerpt: 'Excerpt one.', slug: 'post-one', imageKeyword: 'coffee beans' },
            { title: 'Post Two', excerpt: 'Excerpt two.', slug: 'post-two', imageKeyword: 'latte art' },
            { title: 'Post Three', excerpt: 'Excerpt three.', slug: 'post-three', imageKeyword: 'cafe interior' },
        ])
        expect(runTask).toHaveBeenCalledWith('sitegen.blog-seeds', expect.objectContaining({ temperature: 0.4, maxOutputTokens: 600 }), expect.anything())
    })
})

describe('TC-F08-BG.08 — generateBlogSeedsAI: enforces field length limits from AI response', () => {
    it('truncates title to ≤70 chars and excerpt to ≤160 chars', async () => {
        runTask.mockResolvedValue(seedsOutput([{ title: 'T'.repeat(90), excerpt: 'E'.repeat(200), slug: 's', imageKeyword: 'k' }]))

        const [post] = await inScope(() => generateBlogSeedsAI({ businessName: 'Biz', industry: 'cafe' }))

        expect(post!.title.length).toBeLessThanOrEqual(70)
        expect(post!.excerpt.length).toBeLessThanOrEqual(160)
    })
})

describe('TC-F08-BG.09 — generateBlogSeedsAI: slugifies slug field', () => {
    it('converts AI slug to kebab-case, strips special chars', async () => {
        runTask.mockResolvedValue(seedsOutput([{ title: 'T', excerpt: 'E', slug: '  Fresh Croissants!! & Coffee  ', imageKeyword: 'k' }]))

        const [post] = await inScope(() => generateBlogSeedsAI({ businessName: 'Biz', industry: 'cafe' }))

        expect(post!.slug).toBe('fresh-croissants-coffee')
    })
})

describe('TC-F08-BG.10 — generateBlogSeedsAI: businessName >100 chars truncated in prompt', () => {
    it('injects max 100 chars of businessName into user prompt', async () => {
        runTask.mockResolvedValue(seedsOutput([seed]))

        await inScope(() => generateBlogSeedsAI({ businessName: 'N'.repeat(150), industry: 'cafe' }))

        const user: string = runTask.mock.calls[0]![1].user
        expect(user).toContain('N'.repeat(100))
        expect(user).not.toContain('N'.repeat(101))
    })
})

describe('TC-F08-BG.11 — generateBlogSeedsAI: industry >50 chars truncated in prompt', () => {
    it('injects max 50 chars of industry into user prompt', async () => {
        runTask.mockResolvedValue(seedsOutput([seed]))

        await inScope(() => generateBlogSeedsAI({ businessName: 'Biz', industry: 'I'.repeat(80) }))

        const user: string = runTask.mock.calls[0]![1].user
        expect(user).toContain('I'.repeat(50))
        expect(user).not.toContain('I'.repeat(51))
    })
})

describe('TC-F08-BG.12 — generateBlogSeedsAI: throws on empty posts array', () => {
    it('throws with descriptive error', async () => {
        runTask.mockResolvedValue(seedsOutput([]))

        await expect(inScope(() => generateBlogSeedsAI({ businessName: 'Biz', industry: 'cafe' })))
            .rejects.toThrow('AI returned empty or invalid posts array')
    })
})

describe('TC-F08-BG.13 — generateBlogSeedsAI: platform failures reach the caller', () => {
    it('propagates a platform quota error unchanged so the caller can fall back', async () => {
        runTask.mockRejectedValue(new AiClientError("Your workspace reached today's AI limit.", 429))

        const error = await inScope(() => generateBlogSeedsAI({ businessName: 'Biz', industry: 'cafe' })).catch((e: unknown) => e)

        expect(error).toBeInstanceOf(AiClientError)
        expect(isQuotaExhausted(error)).toBe(true)
    })
})

// ── generateBlogPostContent ──────────────────────────────────────────────────

describe('TC-F08-BG.14 — generateBlogPostContent: no AI actor', () => {
    it('throws AiUnavailableError and makes no platform call', async () => {
        await expect(generateBlogPostContent('Title', 'Biz', 'cafe')).rejects.toBeInstanceOf(AiUnavailableError)
        expect(runTask).not.toHaveBeenCalled()
    })
})

describe('TC-F08-BG.15 — generateBlogPostContent: returns HTML string on success', () => {
    it('returns the HTML content string', async () => {
        runTask.mockResolvedValue(answer({ content: '<h2>Intro</h2><p>Body.</p>' }))

        const html = await inScope(() => generateBlogPostContent('Title', 'Biz', 'cafe'))

        expect(html).toBe('<h2>Intro</h2><p>Body.</p>')
        expect(runTask).toHaveBeenCalledWith('sitegen.blog-post-content', expect.objectContaining({ temperature: 0.7, maxOutputTokens: 2000 }), expect.anything())
    })
})

describe('TC-F08-BG.16 — generateBlogPostContent: throws when content field absent', () => {
    it('throws No content in response', async () => {
        runTask.mockResolvedValue(answer({ other_field: 'oops' }))

        await expect(inScope(() => generateBlogPostContent('Title', 'Biz', 'cafe'))).rejects.toThrow('No content in response')
    })
})

describe('TC-F08-BG.17 — generateBlogPostContent: truncates businessName/industry in prompt', () => {
    it('injects max 100/50 chars of businessName/industry', async () => {
        runTask.mockResolvedValue(answer({ content: '<p>ok</p>' }))

        await inScope(() => generateBlogPostContent('Title', 'B'.repeat(150), 'I'.repeat(80)))

        const user: string = runTask.mock.calls[0]![1].user
        expect(user).toContain('B'.repeat(100))
        expect(user).not.toContain('B'.repeat(101))
        expect(user).toContain('I'.repeat(50))
        expect(user).not.toContain('I'.repeat(51))
    })
})

describe('TC-F08-BG.18 — generateBlogSeedsAI: products capped at 6 items in prompt', () => {
    it('injects at most 6 products into the prompt regardless of input length', async () => {
        runTask.mockResolvedValue(seedsOutput([seed]))
        const products = Array.from({ length: 10 }, (_, i) => `product-${i}`)

        await inScope(() => generateBlogSeedsAI({ businessName: 'Biz', industry: 'cafe', products }))

        const user: string = runTask.mock.calls[0]![1].user
        expect(user).toContain('product-5')
        expect(user).not.toContain('product-6')
    })
})

describe('TC-F08-BG.19 — generateBlogSeedsAI: per-product string capped at 60 chars', () => {
    it('truncates each product to 60 chars before injecting into prompt', async () => {
        runTask.mockResolvedValue(seedsOutput([seed]))

        await inScope(() => generateBlogSeedsAI({ businessName: 'Biz', industry: 'cafe', products: ['P'.repeat(120)] }))

        const user: string = runTask.mock.calls[0]![1].user
        expect(user).toContain('P'.repeat(60))
        expect(user).not.toContain('P'.repeat(61))
    })
})

// ── Locale enforcement ───────────────────────────────────────────────────────

describe('TC-F08-BG.20 — blog prompts enforce the dynamic target locale', () => {
    it('requests Vietnamese titles and excerpts while keeping image keywords in English', async () => {
        runTask.mockResolvedValue(seedsOutput([{ title: 'Mẹo chăm sóc răng', excerpt: 'Hướng dẫn chăm sóc răng miệng.', slug: 'meo-cham-soc-rang', imageKeyword: 'dental care' }]))

        await inScope(() => generateBlogSeedsAI({ businessName: 'Nha Khoa Việt Smile', industry: 'dental', locale: 'vi-VN' }))

        const { system, user } = runTask.mock.calls[0]![1] as { system: string; user: string }
        expect(user).toContain('Vietnamese (vi)')
        expect(system).toContain('title and excerpt MUST be written in the requested target language')
        expect(system).toContain('imageKeyword MUST be 2-4 plain English words')
    })

    it('requests the complete article body in a Latin-script target locale', async () => {
        runTask.mockResolvedValue(answer({
            content: '<p>Découvrez des conseils professionnels pour prendre soin de votre peau chaque jour. Nos traitements personnalisés vous aident à retrouver une peau saine, lumineuse et durable.</p>',
        }))

        await inScope(() => generateBlogPostContent('Conseils pratiques', 'Maison Claire', 'real estate', 'fr-FR'))

        const { user } = runTask.mock.calls[0]![1] as { user: string }
        expect(user).toContain('French (fr)')
    })
})

describe('TC-F08-BG.21 — blog output must match the requested locale', () => {
    it('rejects English seed content returned for a French request', async () => {
        runTask.mockResolvedValue(seedsOutput([{
            title: 'Effective Anti-Acne Treatments for Clearer Skin',
            excerpt: 'Learn how professional treatments can improve your skin and confidence.',
            slug: 'anti-acne-treatments',
            imageKeyword: 'acne skin treatment',
        }]))

        await expect(inScope(() => generateBlogSeedsAI({ businessName: 'Éclat Peau Studio', industry: 'beauty', locale: 'fr-FR' })))
            .rejects.toThrow('BLOG_LOCALE_MISMATCH source=seed-1 expected=fr actual=en')
        expect(runTask).toHaveBeenCalledTimes(1)
    })

    it('rejects an English article body returned for a French request', async () => {
        runTask.mockResolvedValue(answer({
            content: '<h2>Clearer skin starts here</h2><p>Our professional team helps you choose the right treatment for healthy skin.</p>',
        }))

        await expect(inScope(() => generateBlogPostContent('Conseils pour une peau saine', 'Éclat Peau Studio', 'beauty', 'fr-FR')))
            .rejects.toThrow('BLOG_LOCALE_MISMATCH source=article expected=fr actual=en')
        expect(runTask).toHaveBeenCalledTimes(1)
    })

    it('does not add a second model call after a Spanish locale mismatch', async () => {
        runTask.mockResolvedValue(seedsOutput([{
            title: 'Fresh Bread Every Day',
            excerpt: 'Discover our artisan bread and pastries baked with care.',
            slug: 'fresh-bread',
            imageKeyword: 'artisan bread',
        }]))

        await expect(inScope(() => generateBlogSeedsAI({ businessName: 'Panadería Sol', industry: 'bakery', locale: 'es' })))
            .rejects.toThrow('BLOG_LOCALE_MISMATCH')
        expect(runTask).toHaveBeenCalledTimes(1)
    })
})
