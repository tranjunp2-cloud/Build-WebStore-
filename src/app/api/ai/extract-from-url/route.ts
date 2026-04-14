export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import OpenAI from 'openai'
import { withAuth } from '@/lib/auth'
import { checkRateLimit } from '@/lib/rateLimit'
import { parseRequest } from '@/lib/validations/helpers'
import { extractFromUrlSchema, extractionResultSchema } from '@/lib/validations/ai'
import { scrapeUrl } from '@/lib/ai/url-scraper'
import { buildExtractionPrompt } from '@/lib/ai/url-extraction-prompt'
import { checkUrlSafety, checkScrapedContentSafety } from '@/lib/ai/content-safety'

/**
 * POST /api/ai/extract-from-url
 * Scrapes a URL and uses GPT-4o-mini to extract structured business info.
 * Does NOT count as an AI generation credit (FR-15).
 */
export const POST = withAuth(async (user, req) => {
    try {
        // 1. Parse + validate request
        const { data, errorResponse } = await parseRequest(req, extractFromUrlSchema)
        if (errorResponse) return errorResponse

        const { url } = data!

        // 2. Rate limit: 5 extractions/min per user
        const rateLimit = await checkRateLimit(String(user.id), 5)
        if (!rateLimit.allowed) {
            return NextResponse.json(
                {
                    error: 'Too many requests. Please wait a moment and try again.',
                    code: 'RATE_LIMITED',
                    retryAfter: Math.ceil((rateLimit.resetAt - Date.now()) / 1000),
                },
                { status: 429 },
            )
        }

        // 3. URL domain safety check
        const urlSafety = checkUrlSafety(url)
        if (!urlSafety.safe) {
            return NextResponse.json(
                { error: urlSafety.message, code: 'URL_BLOCKED' },
                { status: 400 },
            )
        }

        // 4. Scrape URL (includes SSRF prevention, timeout, size limit)
        let scrapeResult
        try {
            scrapeResult = await scrapeUrl(url)
        } catch (scrapeError: unknown) {
            const message = scrapeError instanceof Error ? scrapeError.message : 'Could not access website'
            return NextResponse.json(
                { error: message, code: 'SCRAPE_FAILED' },
                { status: 422 },
            )
        }

        // 5. Content safety check on scraped text
        const contentSafety = checkScrapedContentSafety(scrapeResult.raw.preprocessedText)
        if (!contentSafety.safe) {
            return NextResponse.json(
                { error: contentSafety.message, code: 'CONTENT_UNSAFE' },
                { status: 400 },
            )
        }

        // 6. Extract business info via GPT-4o-mini
        const { system, user: userPrompt } = buildExtractionPrompt(scrapeResult.raw.preprocessedText)

        let extractedData
        try {
            const openai = new OpenAI()
            const completion = await openai.chat.completions.create({
                model: 'gpt-4o-mini',
                temperature: 0.3,
                max_tokens: 2000,
                response_format: { type: 'json_object' },
                messages: [
                    { role: 'system', content: system },
                    { role: 'user', content: userPrompt },
                ],
            })

            const raw = completion.choices[0]?.message?.content || '{}'
            const parsed = JSON.parse(raw)

            // 7. Validate with Zod (defaults for missing fields)
            extractedData = extractionResultSchema.parse(parsed)
        } catch (aiError: unknown) {
            console.error('[Extract URL] AI extraction failed:', aiError)

            // Fallback: return what we scraped without AI enrichment
            extractedData = extractionResultSchema.parse({
                businessName: scrapeResult.meta.title || '',
                industry: '',
                shortDescription: scrapeResult.meta.description || '',
                products: '',
                detectedLanguage: scrapeResult.meta.locale?.startsWith('ms') ? 'ms' : 'en',
                confidence: 'low',
            })
        }

        // 8. Merge scraper confidence with AI confidence
        const finalConfidence =
            scrapeResult.confidence === 'low' || extractedData.confidence === 'low'
                ? 'low'
                : scrapeResult.confidence === 'medium' || extractedData.confidence === 'medium'
                  ? 'medium'
                  : 'high'

        return NextResponse.json({
            success: true,
            data: {
                ...extractedData,
                confidence: finalConfidence,
            },
            scrapeConfidence: scrapeResult.confidence,
            warnings: scrapeResult.warnings,
            sourceUrl: url,
        })
    } catch (error: unknown) {
        console.error('[Extract URL] Unexpected error:', error)
        return NextResponse.json(
            { error: 'Something went wrong. Please try again or enter info manually.', code: 'INTERNAL_ERROR' },
            { status: 500 },
        )
    }
})
