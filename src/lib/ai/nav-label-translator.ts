/**
 * Nav label translator — GPT micro-call for languages not in the static seed.
 *
 * Cache strategy (Option B):
 *  - Cache miss → skip normalize this request, keep GPT output as-is
 *  - Fire-and-forget prefetch populates runtimeNavCache for next warm request
 *  - Failure → keep GPT output (no forced English fallback)
 *
 * The 8 languages in NAV_LABELS_SEED (en/ms/vi/ja/zh/ko/ar/th) cover the
 * most common non-Latin script languages. This module handles the long tail
 * (Swahili, Tagalog, Burmese, etc.) without requiring manual additions.
 */

import type OpenAI from 'openai'
import type { NavLabels } from './block-i18n'
import { getNavLabels, injectNavLabels } from './block-i18n'

async function callGptTranslation(gpLang: string, openai: OpenAI): Promise<NavLabels | null> {
    const completion = await openai.chat.completions.create({
        model: 'gpt-4.1-nano',
        messages: [{
            role: 'user',
            content: `Translate these 5 website navigation labels to ${gpLang}. Return ONLY a JSON object, no explanation or extra keys:\n{"home":"Home","about":"About","services":"Services","contact":"Contact","getStarted":"Get Started"}`,
        }],
        temperature: 0,
        max_tokens: 120,
        response_format: { type: 'json_object' },
    })

    const raw = completion.choices[0]?.message?.content ?? ''
    if (!raw) {
        console.warn(`[nav-label-translator] empty response for ${gpLang}`)
        return null
    }
    let parsed: Partial<NavLabels>
    try {
        parsed = JSON.parse(raw) as Partial<NavLabels>
    } catch {
        console.warn(`[nav-label-translator] JSON.parse failed for ${gpLang}`)
        return null
    }

    if (!parsed.home || !parsed.about || !parsed.services || !parsed.contact) {
        return null
    }

    return {
        home: parsed.home,
        about: parsed.about,
        services: parsed.services,
        contact: parsed.contact,
        getStarted: parsed.getStarted ?? parsed.contact,
    }
}

/**
 * Fire-and-forget nav label prefetch for a language not yet in runtimeNavCache.
 *
 * The current request proceeds without waiting — GPT output is kept as-is.
 * The next warm request will find the translated labels in cache and apply them.
 */
export function prefetchNavLabels(gpLang: string, blockLang: string, openai: OpenAI): void {
    // Guard: already in cache (another concurrent request may have seeded it)
    if (getNavLabels(blockLang)) return

    void callGptTranslation(gpLang, openai)
        .then((labels) => {
            if (labels) {
                injectNavLabels(blockLang, labels)
                console.log(`[nav-label-translator] cached nav labels for ${blockLang} (${gpLang})`)
            }
        })
        .catch((err) => {
            console.warn(`[nav-label-translator] prefetch failed for ${gpLang}:`, err)
        })
}
