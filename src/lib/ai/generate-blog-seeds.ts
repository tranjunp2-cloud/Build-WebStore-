import OpenAI from 'openai'
import { selectModel } from './config'
import { getLocaleLabel } from '@/lib/locale-labels'
import { detectLanguageFromText } from '@/lib/language-detection'

export interface BlogSeedAI {
    title: string
    excerpt: string
    slug: string
    imageKeyword: string
}

function getOpenAI(): OpenAI | null {
    const key = process.env.OPENAI_API_KEY
    if (!key) return null
    return new OpenAI({ apiKey: key, timeout: 12_000, maxRetries: 0 })
}

export function isQuotaExhausted(err: unknown): boolean {
    if (!(err instanceof Error)) return false
    const status = (err as { status?: unknown }).status
    if (status !== 429) return false
    const code = (err as { code?: string | null }).code
    if (!code) return false
    return code === 'insufficient_quota'
}

function slugify(text: string): string {
    return text
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
}

function resolveBlogLanguage(locale?: string): { code: string; name: string } {
    const code = locale?.trim().toLowerCase().split('-')[0] || 'en'
    return { code, name: getLocaleLabel(code).full }
}

function assertTargetLanguage(text: string, locale: string, source: string): void {
    if (locale === 'en') return

    const plainText = text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
    const detected = detectLanguageFromText(plainText)
    if (detected.locale !== locale) {
        throw new Error(
            `BLOG_LOCALE_MISMATCH source=${source} expected=${locale} actual=${detected.locale}`,
        )
    }
}

function isLocaleMismatch(error: unknown): boolean {
    return error instanceof Error && error.message.startsWith('BLOG_LOCALE_MISMATCH')
}

export async function generateBlogSeedsAI(input: {
    businessName: string
    industry: string
    products?: readonly string[]
    locale?: string
}): Promise<BlogSeedAI[]> {
    const openai = getOpenAI()
    if (!openai) throw new Error('OPENAI_API_KEY not set')

    const safeName = input.businessName.slice(0, 100)
    const safeIndustry = input.industry.slice(0, 50)
    const { products } = input
    const targetLanguage = resolveBlogLanguage(input.locale)
    const productsLine = products?.length
        ? `\nProducts/services: ${products.slice(0, 6).map(p => p.slice(0, 60)).join(', ')}`
        : ''

    const userPrompt = `Generate 3 blog posts for "${safeName}", a ${safeIndustry} business.${productsLine}
Write every human-facing title and excerpt strictly in ${targetLanguage.name} (${targetLanguage.code}).
Return JSON: {"posts":[
  {"title":"max 70 chars","excerpt":"max 160 chars","slug":"kebab-case-slug","imageKeyword":"2-4 english words"}
]}
JSON only.`

    for (let attempt = 1; attempt <= 2; attempt++) {
        const response = await openai.chat.completions.create({
            model: selectModel('blog-seed'),
            response_format: { type: 'json_object' },
            max_tokens: 600,
            temperature: 0.4,
            messages: [
                {
                    role: 'system',
                    content: `You generate 3 blog post seeds for a small-business website.
Posts MUST be specific to the business — never generic placeholders.
Every human-facing title and excerpt MUST be written in the requested target language.
Preserve business and product names exactly as provided.
Slugs MUST be kebab-case, lowercase, no business name embedded.
imageKeyword MUST be 2-4 plain English words describing a stock photo that fits the post (e.g. "fresh croissants pastry", "yoga studio mat").
Output strictly JSON. No markdown.`,
                },
                {
                    role: 'user',
                    content: attempt === 1
                        ? userPrompt
                        : `${userPrompt}\nCorrection: the previous response used the wrong language. Do not use English in title or excerpt.`,
                },
            ],
        }, { timeout: 12_000 })

        const content = response.choices[0]?.message?.content ?? ''
        const parsed = JSON.parse(content) as { posts?: unknown }

        if (!Array.isArray(parsed.posts) || parsed.posts.length === 0) {
            throw new Error('AI returned empty or invalid posts array')
        }

        const posts = (parsed.posts as Array<Record<string, unknown>>)
            .slice(0, 3)
            .map((p) => ({
                title: String(p.title ?? '').slice(0, 70),
                excerpt: String(p.excerpt ?? '').slice(0, 160),
                slug: slugify(String(p.slug ?? p.title ?? 'post')),
                imageKeyword: String(p.imageKeyword ?? ''),
            }))

        try {
            posts.forEach((post, index) => {
                assertTargetLanguage(
                    `${post.title}. ${post.excerpt}`,
                    targetLanguage.code,
                    `seed-${index + 1}`,
                )
            })
            return posts
        } catch (error) {
            if (attempt === 2 || !isLocaleMismatch(error)) throw error
        }
    }

    throw new Error(`BLOG_LOCALE_MISMATCH source=seeds expected=${targetLanguage.code}`)
}

/**
 * Generates 400-600 word rich HTML content for a single blog post.
 * Throws on failure — caller should fall back to excerpt.
 */
export async function generateBlogPostContent(
    title: string,
    businessName: string,
    industry: string,
    locale: string = 'en',
): Promise<string> {
    const openai = getOpenAI()
    if (!openai) throw new Error('OPENAI_API_KEY not set')

    const safeName = businessName.slice(0, 100)
    const safeIndustry = industry.slice(0, 50)
    const targetLanguage = resolveBlogLanguage(locale)

    for (let attempt = 1; attempt <= 2; attempt++) {
        const response = await openai.chat.completions.create({
            model: selectModel('blog-seed'),
            response_format: { type: 'json_object' },
            max_tokens: 2000,
            temperature: 0.7,
            messages: [
                {
                    role: 'system',
                    content: `You write blog post content for small business websites.
Use rich HTML: <h2>, <h3>, <p>, <ul>, <li>, <strong>, <em>. Target 400-600 words.
Write every human-facing word strictly in the requested target language.
Preserve business and product names exactly as provided.
Be specific and practical. No markdown. JSON only.`,
                },
                {
                    role: 'user',
                    content: `Write blog post "${title}" for "${safeName}", a ${safeIndustry} business.
The complete article must be written strictly in ${targetLanguage.name} (${targetLanguage.code}).
${attempt === 2 ? 'Correction: the previous response used the wrong language. Rewrite every paragraph in the requested language.' : ''}
Return JSON: {"content":"<h2>...</h2><p>...</p>..."}`,
                },
            ],
        }, { timeout: 12_000 })

        const raw = response.choices[0]?.message?.content ?? ''
        const parsed = JSON.parse(raw) as { content?: string }
        if (!parsed.content) throw new Error('No content in response')
        try {
            assertTargetLanguage(parsed.content, targetLanguage.code, 'article')
            return parsed.content
        } catch (error) {
            if (attempt === 2 || !isLocaleMismatch(error)) throw error
        }
    }

    throw new Error(`BLOG_LOCALE_MISMATCH source=article expected=${targetLanguage.code}`)
}
