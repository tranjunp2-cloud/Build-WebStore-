/**
 * extract-image-keywords.ts
 *
 * GH-1185 — LLM-derived visual keywords for the per-site Pixabay image pool.
 *
 * Problem: when a business has no/thin `products` input, `rawKeywords` in
 * `generate-site/route.ts` falls back to generic industry-level scaffolding
 * (`CATEGORY_BASE_KEYWORDS`), producing bland stock photos instead of
 * business-specific ones. This module asks a cheap LLM for 2-4 concrete
 * visual terms (SAME language as the business inputs) to fill that gap.
 *
 * IMPORTANT — Pixabay `q` is AND-matched on tags (see `image-pool.ts`
 * `buildPoolQuery`), so extracted terms are merged (not appended) with
 * `products` and capped at 3 total by `mergeKeywords` — mixing too many
 * terms into one query guarantees zero results.
 *
 * Failure modes (API key missing / timeout / malformed JSON / any throw)
 * all degrade to `[]` — caller then falls back to products-only keywords,
 * matching pre-fix behavior exactly (see route.ts imagePoolPromise IIFE).
 */

import OpenAI from 'openai'

function getOpenAI(): OpenAI | null {
    const key = process.env.OPENAI_API_KEY
    if (!key) return null
    return new OpenAI({ apiKey: key })
}

export interface ExtractImageKeywordsInput {
    businessName?: string
    industry?: string
    shortDescription?: string
    products?: string
    language?: string
}

const SYSTEM_PROMPT = [
    'Return JSON {"keywords": ["term1", "term2"]} of 2-4 concrete visual',
    'image-search terms for a stock-photo search, in the SAME language as',
    'the business inputs below. Prefer concrete nouns/scenes over abstract',
    // 1-2 words per term: merged terms are space-joined into ONE AND-matched
    // Pixabay query — longer terms make the query too specific (zero hits).
    'words. Each term must be short (1-2 words).',
].join(' ')

/** Truncate a keyword to at most `max` whitespace-separated words. */
function capWords(term: string, max: number): string {
    return term.split(/\s+/).slice(0, max).join(' ')
}

/**
 * Extract 2-4 short, concrete visual keywords from business info via a cheap
 * LLM call (`gpt-4.1-nano` — cheapest tier, matches `seo-generation` /
 * `url-extraction` in `config.ts`; hardcoded here per `generate-meta.ts`
 * precedent rather than adding a new `AITask` entry — KISS).
 *
 * Never throws — any failure (no API key, timeout, malformed JSON, network
 * error) resolves to `[]` so callers can safely fall back to products-only
 * keywords.
 */
export async function extractImageKeywords(
    input: ExtractImageKeywordsInput,
): Promise<string[]> {
    const openai = getOpenAI()
    if (!openai) return []

    const { businessName, industry, shortDescription, products, language } = input
    const hasContent = [businessName, industry, shortDescription, products].some(
        (v) => v && v.trim().length > 0,
    )
    if (!hasContent) return []

    const userPrompt = [
        businessName ? `Business name: ${businessName}` : '',
        industry ? `Industry: ${industry}` : '',
        shortDescription ? `Description: ${shortDescription}` : '',
        products ? `Products/services: ${products}` : '',
        // 'auto' is a routing sentinel, not a language — the LLM mirrors the
        // input script per SYSTEM_PROMPT, so omit the line entirely.
        language && language !== 'auto' ? `Language: ${language}` : '',
    ]
        .filter(Boolean)
        .join('\n')

    try {
        const completion = await openai.chat.completions.create(
            {
                model: 'gpt-4.1-nano',
                messages: [
                    { role: 'system', content: SYSTEM_PROMPT },
                    { role: 'user', content: userPrompt },
                ],
                temperature: 0.4,
                max_tokens: 120,
                response_format: { type: 'json_object' },
            },
            // fail-fast — falls back to [] on timeout. maxRetries: 0 disables
            // the SDK's default 2 retries; without it a degraded OpenAI turns
            // the "10s" budget into ~30s+ at the head of the pool chain.
            { timeout: 10000, maxRetries: 0 },
        )

        const content = completion.choices[0]?.message?.content
        if (!content) return []

        const parsed: unknown = JSON.parse(content)
        const rawKeywords = (parsed as { keywords?: unknown })?.keywords
        if (!Array.isArray(rawKeywords)) return []

        return rawKeywords
            .filter((k): k is string => typeof k === 'string' && k.trim().length > 0)
            // Hard-cap each term at 2 words even if the model ignores the
            // prompt — keeps the merged AND-matched Pixabay query answerable.
            .map((k) => capWords(k.trim(), 2))
            .slice(0, 4)
    } catch (err) {
        console.warn(
            '[extract-image-keywords] extraction failed (non-fatal):',
            err instanceof Error ? err.message : err,
        )
        return []
    }
}

/**
 * Merge extracted keywords into a base list (products), case-insensitive
 * dedup, base entries first. Capped at `cap` (default 3) to keep the
 * Pixabay AND-matched query tight (see `buildPoolQuery` in `image-pool.ts`).
 */
export function mergeKeywords(base: string[], extra: string[], cap = 3): string[] {
    const seen = new Set<string>()
    const out: string[] = []

    for (const term of [...base, ...extra]) {
        if (!term || !term.trim()) continue
        const lower = term.trim().toLowerCase()
        if (seen.has(lower)) continue
        seen.add(lower)
        out.push(term.trim())
        if (out.length >= cap) break
    }

    return out
}
