export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth'
import { checkRateLimit } from '@/lib/rateLimit'
import { parseRequest } from '@/lib/validations/helpers'
import { extractFromUrlSchema, extractionResultSchema } from '@/lib/validations/ai'
import { scrapeUrl } from '@/lib/ai/url-scraper'
import { runAiTaskForUser } from '@/lib/ai-platform/ai-tasks'
import { AI_UNAVAILABLE_MESSAGE, isAiTasksEnabled } from '@/lib/ai-platform/config'
import { AgentAccessError } from '@/lib/ai-platform/context'
import type { AiSkipReason } from '@/lib/ai/generation-actor'
import { checkUrlSafety, checkScrapedContentSafety } from '@/lib/ai/content-safety'

/**
 * POST /api/ai/extract-from-url
 * Scrapes a URL and extracts structured business info with the AI platform task
 * `site.extract-business-info` (falls back to the page meta when AI is unavailable).
 * Does NOT count as an AI generation credit (FR-15).
 */
export const POST = withAuth(async (user, req) => {
    try {
        // 1. Parse + validate request
        const { data, errorResponse } = await parseRequest(req, extractFromUrlSchema)
        if (errorResponse) return errorResponse

        const { url } = data!

        // 2. Rate limit: 5 extractions/hour per user
        const rateLimit = await checkRateLimit(`ai:extract-from-url:${user.id}`, 5)
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

        // 6. Extract business info with the AI platform task (page text is fenced as untrusted there)
        let extractedData
        // Set when the response is scraper-only: tells the client / admins WHY (no usable workspace vs
        // platform off vs task failure) instead of presenting a low-confidence result as a plain success.
        let aiFallbackReason: AiSkipReason | 'ai_task_failed' | undefined
        try {
            if (!isAiTasksEnabled()) {
                aiFallbackReason = 'ai_unconfigured'
                throw new Error(AI_UNAVAILABLE_MESSAGE)
            }
            const { output } = await runAiTaskForUser(user, req, 'site.extract-business-info', {
                pageText: scrapeResult.raw.preprocessedText.slice(0, 40_000),
            })

            // 7. Validate with Zod (defaults for missing fields)
            extractedData = extractionResultSchema.parse(output)
        } catch (aiError: unknown) {
            console.error('[Extract URL] AI extraction failed:', aiError instanceof Error ? aiError.message : aiError)
            // No active workspace / super-admin outside the workspace / lapsed membership all surface as AgentAccessError.
            aiFallbackReason ??= aiError instanceof AgentAccessError ? 'not_workspace_member' : 'ai_task_failed'

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
            ...(aiFallbackReason ? { aiFallbackReason } : {}),
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
}, { csrf: true })
