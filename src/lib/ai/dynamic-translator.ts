import { completeComposed, currentAiActor } from '@/lib/ai-platform/actor-scope'

interface TranslatorInput {
    industry?: string
    products?: string[]
}

/**
 * Faithfully translates each Vietnamese/Malay keyword (usually a dish or
 * product) to its accurate English equivalent — the phrase a stock-photo site
 * would tag the SAME subject with. Preserves count + order (N terms in → N
 * phrases out), and does NOT generalize a specific dish into a generic scene.
 * Runs the AI platform task `i18n.translate-image-terms`. Returns null on failure
 * (or outside a site-generation run) so the caller falls back to raw.
 */
export async function translateToEnglishKeywords(input: TranslatorInput): Promise<string[] | null> {
    if (!currentAiActor()) return null

    const terms = (input.products ?? []).map((t) => t.trim()).filter(Boolean)
    if (terms.length === 0) return null

    const prompt = `Translate each Vietnamese/Malay term below into an accurate English phrase a stock-photo site would tag the SAME subject with. Translate the SPECIFIC meaning — for a dish, describe what is actually on the plate; do NOT replace it with a generic scene like "restaurant interior".

RULES:
- Return EXACTLY ${terms.length} phrase(s), one per input term, IN THE SAME ORDER.
- Each phrase = 2-5 lowercase English words naming the concrete subject.
- Faithful, specific translation. Examples: "chả cá lã vọng" → "grilled turmeric fish", "bún chả" → "grilled pork rice noodles", "phở bò" → "beef noodle soup", "cơm tấm sườn" → "grilled pork rice".
- Only for abstract tech terms with no visual (SaaS, CRM, API) fall back to a concrete scene like "software team".

Industry: ${input.industry ?? 'none'}
Terms to translate (in order):
${terms.map((t, i) => `${i + 1}. ${t}`).join('\n')}

Return ONLY a JSON array of exactly ${terms.length} strings in the same order. No markdown, no explanation.`

    try {
        const controller = new AbortController()
        // 8-second timeout — generous enough for the fast tier under load while
        // still bounding the total gen time well within maxDuration (300s).
        const timeoutId = setTimeout(() => controller.abort(), 8000)

        try {
            const response = await completeComposed('i18n.translate-image-terms', {
                user: prompt,
                // ~12 tokens per short phrase + JSON punctuation; scales with count.
                maxOutputTokens: Math.min(160, 40 + terms.length * 30),
                temperature: 0.1,
            }, { signal: controller.signal })

            const content = response.content.trim()
            if (!content) return null

            let parsed: string[]
            try {
                parsed = JSON.parse(content) as string[]
            } catch {
                // Strip markdown code blocks just in case
                const clean = content.replace(/```json/g, '').replace(/```/g, '').trim()
                parsed = JSON.parse(clean) as string[]
            }

            if (Array.isArray(parsed) && parsed.length > 0) {
                // Enforce the input→output count contract: trim any extra the
                // model added; never emit more phrases than terms requested.
                return parsed
                    .filter((k): k is string => typeof k === 'string' && k.trim().length > 0)
                    .slice(0, terms.length)
                    .map((k) => k.toLowerCase().trim())
            }
            return null
        } finally {
            clearTimeout(timeoutId)
        }

    } catch (e) {
        // We do not throw. We return null to trigger Tier 2 dictionary fallback.
        console.warn('[AI Translation] Failed to translate keywords:', e instanceof Error ? e.message : String(e))
        return null
    }
}
