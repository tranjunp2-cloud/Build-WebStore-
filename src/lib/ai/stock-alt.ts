/**
 * Alt text for stock photos (#2103 A5).
 *
 * Pixabay returns `hit.tags` as a comma list that often repeats the same word
 * ("cake, cakes, Cake, dessert, cake, ...") and can run past 200 chars. Using it
 * raw as `alt` hurts accessibility and SEO. This helper dedupes the tags, keeps
 * the first 2-3, prefixes the subject (product / business / block) and caps at
 * MAX_STOCK_ALT_LENGTH.
 *
 * Idempotent on its own output (the subject is removed from the tag list), so
 * it is safe to apply once at fetch time (no subject) and again at upload time
 * (with a subject).
 */

export const MAX_STOCK_ALT_LENGTH = 120
const MAX_TAGS = 3

/** Case- and plural-insensitive key so "Cake", "cakes" and "cake" collapse. */
function tagKey(tag: string): string {
    const lower = tag.trim().toLowerCase()
    if (lower.endsWith('ies') && lower.length > 4) return `${lower.slice(0, -3)}y`
    if (/(?:ss|x|z|ch|sh)es$/.test(lower)) return lower.slice(0, -2)
    if (lower.endsWith('s') && !lower.endsWith('ss') && lower.length > 3) return lower.slice(0, -1)
    return lower
}

export function buildStockAlt(
    tags: string | readonly string[] | null | undefined,
    subject?: string | null,
): string {
    const cleanSubject = (subject ?? '').replace(/\s+/g, ' ').trim()
    // Our own output ("Subject - a, b") fed back in: drop the subject prefix before splitting.
    const prefix = `${cleanSubject} - `
    const source = typeof tags === 'string' && cleanSubject && tags.startsWith(prefix) ? tags.slice(prefix.length) : tags
    const list = typeof source === 'string' ? source.split(',') : Array.isArray(source) ? [...source] : []
    const seen = new Set<string>(cleanSubject ? [tagKey(cleanSubject)] : [])
    const kept: string[] = []
    for (const raw of list) {
        const tag = String(raw).replace(/\s+/g, ' ').trim()
        if (!tag) continue
        const key = tagKey(tag)
        if (seen.has(key)) continue
        seen.add(key)
        kept.push(tag)
        if (kept.length >= MAX_TAGS) break
    }

    const compose = (n: number): string => {
        const tagPart = kept.slice(0, n).join(', ')
        if (cleanSubject && tagPart) return `${cleanSubject} - ${tagPart}`
        return cleanSubject || tagPart
    }
    // Drop trailing tags until it fits; subject alone is hard-cut as a last resort.
    for (let n = kept.length; n >= 0; n--) {
        const alt = compose(n)
        if (alt.length <= MAX_STOCK_ALT_LENGTH) return alt
    }
    return cleanSubject.slice(0, MAX_STOCK_ALT_LENGTH).trim()
}
