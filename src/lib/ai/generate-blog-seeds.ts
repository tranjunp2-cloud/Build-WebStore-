import OpenAI from 'openai'
import { selectModel } from './config'

export interface BlogSeedAI {
    title: string
    excerpt: string
    slug: string
    imageKeyword: string
}

function getOpenAI(): OpenAI | null {
    const key = process.env.OPENAI_API_KEY
    if (!key) return null
    return new OpenAI({ apiKey: key })
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

export async function generateBlogSeedsAI(input: {
    businessName: string
    industry: string
    products?: readonly string[]
}): Promise<BlogSeedAI[]> {
    const openai = getOpenAI()
    if (!openai) throw new Error('OPENAI_API_KEY not set')

    const safeName = input.businessName.slice(0, 100)
    const safeIndustry = input.industry.slice(0, 50)
    const { products } = input
    const productsLine = products?.length
        ? `\nProducts/services: ${products.slice(0, 6).map(p => p.slice(0, 60)).join(', ')}`
        : ''

    const userPrompt = `Generate 3 blog posts for "${safeName}", a ${safeIndustry} business.${productsLine}
Return JSON: {"posts":[
  {"title":"max 70 chars","excerpt":"max 160 chars","slug":"kebab-case-slug","imageKeyword":"2-4 english words"}
]}
JSON only.`

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
Slugs MUST be kebab-case, lowercase, no business name embedded.
imageKeyword MUST be 2-4 plain English words describing a stock photo that fits the post (e.g. "fresh croissants pastry", "yoga studio mat").
Output strictly JSON. No markdown.`,
            },
            { role: 'user', content: userPrompt },
        ],
    }, { timeout: 30_000 })

    const content = response.choices[0]?.message?.content ?? ''
    const parsed = JSON.parse(content) as { posts?: unknown }

    if (!Array.isArray(parsed.posts) || parsed.posts.length === 0) {
        throw new Error('AI returned empty or invalid posts array')
    }

    return (parsed.posts as Array<Record<string, unknown>>)
        .slice(0, 3)
        .map((p) => ({
            title: String(p.title ?? '').slice(0, 70),
            excerpt: String(p.excerpt ?? '').slice(0, 160),
            slug: slugify(String(p.slug ?? p.title ?? 'post')),
            imageKeyword: String(p.imageKeyword ?? ''),
        }))
}

/**
 * Generates 400-600 word rich HTML content for a single blog post.
 * Throws on failure — caller should fall back to excerpt.
 */
export async function generateBlogPostContent(
    title: string,
    businessName: string,
    industry: string,
): Promise<string> {
    const openai = getOpenAI()
    if (!openai) throw new Error('OPENAI_API_KEY not set')

    const safeName = businessName.slice(0, 100)
    const safeIndustry = industry.slice(0, 50)

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
Be specific and practical. No markdown. JSON only.`,
            },
            {
                role: 'user',
                content: `Write blog post "${title}" for "${safeName}", a ${safeIndustry} business.
Return JSON: {"content":"<h2>...</h2><p>...</p>..."}`,
            },
        ],
    }, { timeout: 30_000 })

    const raw = response.choices[0]?.message?.content ?? ''
    const parsed = JSON.parse(raw) as { content?: string }
    if (!parsed.content) throw new Error('No content in response')
    return parsed.content
}
