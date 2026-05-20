type GlobalBlockEntry = Record<string, unknown> | null

export type GlobalBlocks = {
    cartWidget?: GlobalBlockEntry
    whatsappButton?: GlobalBlockEntry
    socialWidget?: GlobalBlockEntry
} | null

/**
 * Partial-merge patch into existing globalBlocks.
 * - patch === null → wipe all (returns null)
 * - patch key === null → remove that key from result
 * - patch key === object → replace that key
 * - patch key === undefined (omitted) → leave unchanged
 */
export function mergeGlobalBlocks(
    prev: GlobalBlocks,
    patch: GlobalBlocks,
): GlobalBlocks {
    if (patch === null) return null

    const base: NonNullable<GlobalBlocks> = { ...(prev ?? {}) }

    for (const key of ['cartWidget', 'whatsappButton', 'socialWidget'] as const) {
        if (!(key in patch)) continue
        // Keep null as an explicit value — an absent key would be treated as `undefined`
        // by SiteRenderer's BC sentinel logic, reactivating the page-scan fallback for
        // a block the user intentionally disabled.
        base[key] = patch[key]
    }

    return Object.keys(base).length === 0 ? null : base
}
