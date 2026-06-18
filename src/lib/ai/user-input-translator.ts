import OpenAI from 'openai'
import { detectLanguage } from './lang-detect'

interface TranslatableBusinessInputs {
    businessName: string
    shortDescription: string
    products: string
}

const LOCALE_TO_LANG_NAME: Record<string, string> = {
    en: 'English',
    ms: 'Malay (Bahasa Melayu)',
    vi: 'Vietnamese',
    zh: 'Chinese (Mandarin)',
    ar: 'Arabic',
    ja: 'Japanese',
    ko: 'Korean',
    th: 'Thai',
    fr: 'French',
    de: 'German',
    es: 'Spanish',
    pt: 'Portuguese',
    ru: 'Russian',
    it: 'Italian',
    nl: 'Dutch',
    tr: 'Turkish',
    id: 'Indonesian',
}

/**
 * Translates user-supplied business inputs (businessName, shortDescription, products)
 * to the target generation locale when the detected input language differs.
 *
 * Example: user types in Vietnamese but selects English → fields translated to EN
 * before being injected into hero/feature blocks.
 *
 * Best-effort: returns original inputs unchanged on any failure so the pipeline
 * is never blocked by a translation error.
 */
export async function translateUserInputsIfNeeded(
    inputs: TranslatableBusinessInputs,
    targetLocale: string,
): Promise<TranslatableBusinessInputs> {
    const targetIso = (targetLocale.split('-')[0] ?? 'en').toLowerCase()

    const combined = [inputs.businessName, inputs.shortDescription, inputs.products]
        .filter(Boolean)
        .join(' ')
    if (!combined.trim()) return inputs

    const { blockLang: detectedIso } = detectLanguage(combined)
    if (detectedIso === targetIso) return inputs

    const key = process.env.OPENAI_API_KEY
    if (!key) return inputs

    const targetLangName = LOCALE_TO_LANG_NAME[targetIso] ?? 'English'

    try {
        const openai = new OpenAI({ apiKey: key })
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 8000)

        try {
            const response = await openai.chat.completions.create({
                model: 'gpt-4o-mini',
                messages: [{
                    role: 'user',
                    content: `Translate these business details to ${targetLangName}. Keep brand names and proper nouns as-is when they have no natural translation. Return valid JSON only, no markdown.

Input: ${JSON.stringify({ businessName: inputs.businessName, shortDescription: inputs.shortDescription, products: inputs.products })}

Return JSON with same three keys.`,
                }],
                max_tokens: 300,
                temperature: 0.1,
            }, { signal: controller.signal })

            const content = response.choices[0]?.message?.content?.trim()
            if (!content) return inputs

            const clean = content.replace(/```json/g, '').replace(/```/g, '').trim()
            const parsed = JSON.parse(clean) as Partial<TranslatableBusinessInputs>

            return {
                businessName: (typeof parsed.businessName === 'string' && parsed.businessName) ? parsed.businessName : inputs.businessName,
                shortDescription: (typeof parsed.shortDescription === 'string' && parsed.shortDescription) ? parsed.shortDescription : inputs.shortDescription,
                products: (typeof parsed.products === 'string' && parsed.products) ? parsed.products : inputs.products,
            }
        } finally {
            clearTimeout(timeoutId)
        }
    } catch {
        // Non-throwing — return original inputs so downstream pipeline is unaffected.
        return inputs
    }
}
