import { AiUnavailableError, completeComposed } from '@/lib/ai-platform/actor-scope'
import { getLocaleLabel } from '@/lib/locale-labels'
import { detectLanguageFromText } from '@/lib/language-detection'

export interface BlogSeedAI {
    title: string
    excerpt: string
    slug: string
    imageKeyword: string
}

/** True when no model can answer (no AI actor, or the workspace's AI quota is used up). */
export function isQuotaExhausted(err: unknown): boolean {
    if (err instanceof AiUnavailableError) return true
    return err instanceof Error && (err as { status?: unknown }).status === 429
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

export async function generateBlogSeedsAI(input: {
    businessName: string
    industry: string
    products?: readonly string[]
    locale?: string
}): Promise<BlogSeedAI[]> {

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

    const response = await completeComposed('sitegen.blog-seeds', {
        system: `You generate 3 blog post seeds for a small-business website.
Posts MUST be specific to the business — never generic placeholders.
Every human-facing title and excerpt MUST be written in the requested target language.
Preserve business and product names exactly as provided.
Slugs MUST be kebab-case, lowercase, no business name embedded.
imageKeyword MUST be 2-4 plain English words describing a stock photo that fits the post (e.g. "fresh croissants pastry", "yoga studio mat").
Output strictly JSON. No markdown.`,
        user: userPrompt,
        temperature: 0.4,
        maxOutputTokens: 600,
    })

    const content = response.content
    const parsed = JSON.parse(content) as { posts?: unknown }

    if (!Array.isArray(parsed.posts) || parsed.posts.length === 0) {
        throw new Error('AI returned empty or invalid posts array')
    }

    const posts = (parsed.posts as unknown as Array<Record<string, unknown>>)
        .slice(0, 3)
        .map((p, index) => ({
            title: String(p.title ?? '').slice(0, 70),
            excerpt: String(p.excerpt ?? '').slice(0, 160),
            slug: slugify(String(p.slug ?? p.title ?? '')) || `post-${index + 1}`,
            imageKeyword: String(p.imageKeyword ?? ''),
        }))

    posts.forEach((post, index) => {
        assertTargetLanguage(
            `${post.title}. ${post.excerpt}`,
            targetLanguage.code,
            `seed-${index + 1}`,
        )
    })
    return posts
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

    const safeName = businessName.slice(0, 100)
    const safeIndustry = industry.slice(0, 50)
    const targetLanguage = resolveBlogLanguage(locale)

    const response = await completeComposed('sitegen.blog-post-content', {
        system: `You write blog post content for small business websites.
Use rich HTML: <h2>, <h3>, <p>, <ul>, <li>, <strong>, <em>. Target 400-600 words.
Write every human-facing word strictly in the requested target language.
Preserve business and product names exactly as provided.
Be specific and practical. No markdown. JSON only.`,
        user: `Write blog post "${title}" for "${safeName}", a ${safeIndustry} business.
The complete article must be written strictly in ${targetLanguage.name} (${targetLanguage.code}).
Return JSON: {"content":"<h2>...</h2><p>...</p>..."}`,
        temperature: 0.7,
        maxOutputTokens: 2000,
    })

    const raw = response.content
    const parsed = JSON.parse(raw) as { content?: string }
    if (!parsed.content) throw new Error('No content in response')
    assertTargetLanguage(parsed.content, targetLanguage.code, 'article')
    return parsed.content
}
