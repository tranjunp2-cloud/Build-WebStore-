import OpenAI from 'openai'

interface TranslatorInput {
    industry?: string
    products?: string
}

/**
 * Translates Vietnamese/Malay business terms to highly optimized English search keywords for Unsplash.
 * Uses a small, fast model (gpt-4o-mini).
 * Returns null if the LLM fails, ensuring the fallback dictionary takes over.
 */
export async function translateToEnglishKeywords(input: TranslatorInput): Promise<string[] | null> {
    const key = process.env.OPENAI_API_KEY
    if (!key) return null

    const prompt = `You are a search keyword optimization assistant for Unsplash stock photography.
Given a business industry and products (often in Vietnamese or Malay), extract 1 to 3 highly relevant English search keywords.
These keywords must be nouns or noun phrases that return great photos of the business concept (e.g. "pet shop", "furniture interior", "car showroom").
Avoid overly generic words if specific ones are better. Do not use punctuation.

Industry: ${input.industry ?? 'none'}
Products: ${input.products ?? 'none'}

Return ONLY a valid JSON array of strings. Do not include markdown formatting or explanation.
Example: ["pet shop", "cute animals"]`

    try {
        const openai = new OpenAI({ apiKey: key })
        
        const controller = new AbortController()
        // 8-second timeout — generous enough for gpt-4o-mini under load while
        // still bounding the total gen time well within maxDuration (300s).
        const timeoutId = setTimeout(() => controller.abort(), 8000)

        const response = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [{ role: 'user', content: prompt }],
            max_tokens: 30,
            temperature: 0.1,
        }, { signal: controller.signal })
        
        clearTimeout(timeoutId)

        const content = response.choices[0]?.message?.content?.trim()
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
            return parsed.map(k => k.toLowerCase())
        }
        return null

    } catch (e) {
        // We do not throw. We return null to trigger Tier 2 dictionary fallback.
        console.warn('[AI Translation] Failed to translate keywords:', e instanceof Error ? e.message : String(e))
        return null
    }
}
