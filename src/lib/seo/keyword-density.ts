/**
 * Keyword density validation utility (AC-15).
 * Checks that keyword usage in text stays at or below 2% density.
 */

export interface KeywordDensityResult {
    keyword: string
    count: number
    density: number
    ok: boolean
}

const MAX_DENSITY = 0.02 // 2%

export function checkKeywordDensity(text: string, keywords: string[]): KeywordDensityResult[] {
    if (!text || !keywords?.length) return []

    const words = text.toLowerCase().split(/\s+/).filter(Boolean)
    const totalWords = words.length
    if (totalWords === 0) return keywords.map(k => ({ keyword: k, count: 0, density: 0, ok: true }))

    // Strip punctuation from words for accurate matching
    const cleanWords = words.map(w => w.replace(/[^\w]/g, ''))

    return keywords.map(keyword => {
        const kw = keyword.toLowerCase()
        const kwWords = kw.split(/\s+/)
        let count = 0

        // Count occurrences (supports multi-word keywords)
        if (kwWords.length === 1) {
            count = cleanWords.filter(w => w === kw).length
        } else {
            // Word-boundary matching: check consecutive word sequences
            for (let i = 0; i <= cleanWords.length - kwWords.length; i++) {
                const slice = cleanWords.slice(i, i + kwWords.length).join(' ')
                if (slice === kw) count++
            }
        }

        const density = totalWords > 0 ? count / totalWords : 0

        return {
            keyword,
            count,
            density: Math.round(density * 10000) / 10000, // 4 decimal precision
            ok: density <= MAX_DENSITY,
        }
    })
}
