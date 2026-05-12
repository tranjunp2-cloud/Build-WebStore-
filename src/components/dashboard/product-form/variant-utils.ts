/** Returns true if the tier has any user-entered content (name or at least one option). */
export function isNonEmptyTier(tier: { name?: string; options?: string[] }): boolean {
    return !!(tier.name?.trim() || (tier.options || []).some(o => o?.trim()))
}

/**
 * Returns the set of indices (within a single tier's options array) that are
 * case-insensitive duplicates of another entry. Both the first and subsequent
 * occurrences are included so all conflicting inputs can be highlighted.
 */
export function computeDuplicateIndicesForOptions(options: string[]): Set<number> {
    const seen = new Map<string, number>()
    const dups = new Set<number>()
    options.forEach((opt, oIdx) => {
        const norm = (opt || '').trim().toLowerCase()
        if (!norm) return
        if (seen.has(norm)) {
            dups.add(oIdx)
            dups.add(seen.get(norm)!)
        } else {
            seen.set(norm, oIdx)
        }
    })
    return dups
}
