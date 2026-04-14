import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { withAuth } from '@/lib/auth'
import OpenAI from 'openai'
import { checkRateLimit } from '@/lib/rateLimit'

function getOpenAI(): OpenAI | null {
    const key = process.env.OPENAI_API_KEY
    if (!key) return null
    return new OpenAI({ apiKey: key })
}

/**
 * POST /api/ai/seo-generate
 *
 * US-F08-03: AI SEO Generation
 * Generates SEO metadata for a product based on name + category.
 *
 * Body: { name: string, category?: string }
 * Returns: { success: true, data: { title: string, description: string, slug: string } }
 *
 * Constraints (from PRD v2.1):
 *   - title: ≤ 70 characters
 *   - description: 150–160 characters
 *   - slug: kebab-case, URL-safe
 */
export const POST = withAuth(async (user, req) => {
    try {
        // Rate Limit: 20 AI tasks per hour
        const rateLimit = await checkRateLimit(String(user.id), 20)
        if (!rateLimit.allowed) {
            return NextResponse.json(
                { success: false, error: 'Rate limit exceeded. Try again later.' },
                { status: 429 }
            )
        }

        const body = await req.json()
        const { name, category, language = 'en', siteId } = body

        // Fetch tracked keywords if siteId provided (AC-15)
        let trackedKeywords: string[] = []
        if (siteId) {
            try {
                const payload = await getPayload({ config })
                const site = await payload.findByID({ collection: 'sites', id: siteId })
                trackedKeywords = ((site as any)?.seo?.trackedKeywords as Array<{ keyword: string }> | undefined)
                    ?.map(k => k.keyword).filter(Boolean) || []
            } catch { /* site fetch failed — proceed without keywords */ }
        }

        if (!name || typeof name !== 'string' || name.trim().length < 3) {
            return NextResponse.json(
                { success: false, error: 'Product name (min 3 chars) is required' },
                { status: 400 }
            )
        }

        const openai = getOpenAI()
        if (!openai) {
            return NextResponse.json(
                { success: false, error: 'OPENAI_API_KEY is not configured' },
                { status: 501 }
            )
        }

        const categoryContext = category ? ` in the "${category}" category` : ''

        const systemPrompt = `You are an expert SEO copywriter for Malaysian e-commerce (Bahasa Melayu and English market).
Your job is to generate SEO metadata for a product listing.

The output MUST be in ${language === 'ms' ? 'Bahasa Melayu (Malay)' : 'English'}.

STRICT OUTPUT FORMAT — respond ONLY with a valid JSON object, no extra text:
{
  "title": "SEO-optimized product title in ${language === 'ms' ? 'Malay' : 'English'} (MUST be ≤ 70 characters, include product name, add a compelling attribute)",
  "description": "Compelling meta description in ${language === 'ms' ? 'Malay' : 'English'} (MUST be between 150 and 160 characters, action-oriented, include a call to action like '${language === 'ms' ? 'Beli sekarang' : 'Shop now'}', mention price context if relevant)",
  "slug": "url-friendly-slug (kebab-case, romanized if in Malay/Vietnamese, no special chars, all lowercase, no trailing/leading hyphens)"
}

IMPORTANT RULES:
1. title MUST NOT exceed 70 characters — count carefully.
2. description MUST be between 150 and 160 characters — count carefully and pad if needed.
3. slug is derived from the product name only — pure ASCII kebab-case.
4. Do NOT include store brand name in title or description.
5. Use natural, friendly language appropriate for Malaysian SME market.`

        const keywordContext = trackedKeywords.length
            ? `\nTarget Keywords: ${trackedKeywords.join(', ')}\n- Naturally incorporate 1-2 keywords if relevant (keyword density ≤ 2%)`
            : ''

        const userPrompt = `Generate SEO metadata for this product:
Product Name: "${name.trim()}"${categoryContext}${keywordContext}

Remember: title ≤ 70 chars, description 150-160 chars, slug kebab-case ASCII.`

        const completion = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt },
            ],
            temperature: 0.6,
            max_tokens: 400,
            response_format: { type: 'json_object' },
        })

        const content = completion.choices[0]?.message?.content
        if (!content) {
            throw new Error('No content received from OpenAI')
        }

        const parsed = JSON.parse(content) as {
            title?: string
            description?: string
            slug?: string
        }

        // Enforce hard constraints server-side as safety net
        const title = (parsed.title || '').slice(0, 70).trim()
        const description = (parsed.description || '').slice(0, 160).trim()
        const slug = (parsed.slug || slugify(name))
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/(^-|-$)/g, '')

        return NextResponse.json({
            success: true,
            data: { title, description, slug },
        })
    } catch (error) {
        console.error('API /api/ai/seo-generate error:', error)
        return NextResponse.json(
            { success: false, error: 'Failed to generate SEO metadata' },
            { status: 500 }
        )
    }
})

function slugify(text: string): string {
    return text
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // strip diacritics
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '')
}
