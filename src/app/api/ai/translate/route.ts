/**
 * POST /api/ai/translate
 * F26-04: AI translate fallback — translates block template content EN → target locale.
 *
 * Body: { blockType: string, targetLocale: string, content: Record<string, unknown> }
 * Returns: { translated: Record<string, unknown>, cached: boolean }
 * On fail: { translated: <original content>, status: 'fallback' }
 */

import { NextResponse } from 'next/server'
import OpenAI from 'openai'
import { z } from 'zod'
import { withAuth } from '@/lib/auth'
import { checkRateLimit } from '@/lib/rateLimit'
import { parseRequest } from '@/lib/validations/helpers'
import { getCachedTranslation, setCachedTranslation } from '@/lib/ai/translate-cache'

// Allowlisted locales — prevents prompt injection via user-supplied locale strings
const SUPPORTED_TARGET_LOCALES = ['en', 'ms', 'zh', 'th', 'id'] as const

const translateSchema = z.object({
    blockType: z.string().min(1).max(64),
    targetLocale: z.enum(SUPPORTED_TARGET_LOCALES),
    // Bound total serialized size to ~10KB to cap OpenAI input tokens (cost attack).
    // Values can be nested objects/arrays — z.string() would reject ctaButtons, faq.items, etc.
    content: z.record(z.unknown()).refine(
        obj => JSON.stringify(obj).length <= 10_000,
        { message: 'Content exceeds 10KB limit' },
    ),
})

const LOCALE_NAMES: Record<string, string> = {
    en: 'English',
    ms: 'Bahasa Malaysia (Malaysian Malay)',
    zh: 'Simplified Chinese',
    th: 'Thai',
    id: 'Bahasa Indonesia',
}

function getOpenAI(): OpenAI | null {
    const key = process.env.OPENAI_API_KEY
    if (!key) return null
    return new OpenAI({ apiKey: key })
}

export const POST = withAuth(async (user, req) => {
    // Track parsed content for safe fallback in catch block
    let parsedContent: Record<string, unknown> = {}

    try {
        // Rate limit: 30 translate calls per hour (cheaper than generate-site)
        const rateLimit = await checkRateLimit(String(user.id), 30)
        if (!rateLimit.allowed) {
            return NextResponse.json(
                { error: 'Rate limit exceeded. Try again later.' },
                { status: 429 },
            )
        }

        const { data, errorResponse } = await parseRequest(req, translateSchema)
        if (errorResponse) return errorResponse

        const { blockType, targetLocale, content } = data!
        parsedContent = content

        // AC-4: Cache hit → skip AI call
        const cached = getCachedTranslation(blockType, targetLocale)
        if (cached) {
            return NextResponse.json({ translated: cached, cached: true })
        }

        const openai = getOpenAI()
        if (!openai) {
            // No API key — return original content as safe fallback
            return NextResponse.json({ translated: content, status: 'fallback' })
        }

        // targetLocale is enum-validated — always present in LOCALE_NAMES
        const localeName = LOCALE_NAMES[targetLocale]!

        // Source-agnostic — site content may be in any language (EN, MS, VI, EL, etc.)
        const translationInstruction = `Translate ALL string values in the given JSON into natural, idiomatic ${localeName}. The source may be in any language — detect and translate automatically.`

        const systemPrompt = [
            `You are a professional translator specializing in marketing and e-commerce copy.`,
            translationInstruction,
            `Rules:`,
            `- Return ONLY valid JSON with exactly the same structure and keys.`,
            `- Translate only string leaf values. Preserve numbers, booleans, nulls, and object/array shapes.`,
            `- Keep brand placeholder tokens like {brand} and {n} unchanged.`,
            `- Use natural, friendly tone appropriate for Malaysian small businesses.`,
            `- Do NOT add any explanation or markdown — just the JSON.`,
        ].join('\n')

        const completion = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            temperature: 0.3,
            max_tokens: 1024,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: JSON.stringify(content) },
            ],
        })

        const raw = completion.choices[0]?.message?.content?.trim() ?? ''

        // Parse and validate returned JSON
        let translated: Record<string, unknown>
        try {
            // Strip markdown code fences if the model wraps in ```json ... ```
            const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
            const parsed = JSON.parse(cleaned)
            if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
                throw new Error('Unexpected shape')
            }
            translated = parsed as Record<string, unknown>
        } catch {
            // Malformed JSON → safe fallback
            return NextResponse.json({ translated: content, status: 'fallback' })
        }

        // Cache for subsequent calls (same block type + locale)
        setCachedTranslation(blockType, targetLocale, translated)

        return NextResponse.json({ translated, cached: false })
    } catch (err) {
        console.error('[translate] error:', err)
        // AC-3: Never crash — return original content (captured before await chain) as fallback
        return NextResponse.json({ translated: parsedContent, status: 'fallback' })
    }
})
