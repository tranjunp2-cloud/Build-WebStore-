// Structural block fields — layout/config values that are SITE-WIDE, not
// per-locale content. They must always live on the flat block and must never
// be written into (or displayed from) a locale slot (localeOverrides /
// _localeContent). Writing them per-locale desyncs the canvas from settings:
// e.g. picking the hero "video" variant while editing a vi-generated site
// stored variant only in localeOverrides['vi'], so the next render from the
// flat block silently reverted to the old variant (split-right).
//
// Keep in sync with the translation-skip list NON_TRANSLATABLE_FIELDS in
// editor page.tsx — that list is a superset (it also protects business data
// like phone/email from TRANSLATION, which still legitimately lives per-locale
// in overrides; this set is only the fields that may not enter locale slots at
// all).
export const STRUCTURAL_BLOCK_FIELDS = new Set([
    'variant',
    'filterControls', 'selectionMode', 'selectedProductIds', 'includeOutOfStock', 'category', 'limit', 'showCategoryFilter',
    'backgroundColor',
    // locale-control flags are site-wide switches, not content
    'showLanguageSwitcher',
    'multilingualEnabled',
    'primaryLocale',
    'secondaryLocale',
])

/** Split a block patch into structural (always flat-block) and content (locale-routed) parts. */
export function splitStructuralChanges(changes: Record<string, unknown>): {
    structural: Record<string, unknown>
    content: Record<string, unknown>
} {
    const structural: Record<string, unknown> = {}
    const content: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(changes)) {
        if (STRUCTURAL_BLOCK_FIELDS.has(key)) structural[key] = value
        else content[key] = value
    }
    return { structural, content }
}

/** Remove structural keys from a locale patch before merging it over a flat block. */
export function stripStructuralFields(patch: Record<string, unknown>): Record<string, unknown> {
    return Object.fromEntries(
        Object.entries(patch).filter(([key]) => !STRUCTURAL_BLOCK_FIELDS.has(key)),
    )
}

export type BlockChangeRouting = {
    /** Patch for the flat block — structural always; content too on the base locale or id-less blocks. */
    flatChanges: Record<string, unknown>
    /** Content patch for localeOverrides[blockId][activeLocale]; empty for id-less blocks. */
    contentOverride: Record<string, unknown>
    /** Structural keys to purge from every locale slot of the block. */
    purgeKeys: string[]
}

/**
 * Decide where a block edit is written. This is the heart of the variant-revert
 * fix, extracted pure so tests can pin it:
 *   - structural fields → flat block, always; purge stale per-locale copies
 *   - content fields → locale override, plus the flat block when editing the
 *     language the flat blocks were AUTHORED in. That base language is
 *     generationLocale ('vi', 'el', …) — NOT Sites.locale, which only holds the
 *     EN/MS translation slot and can never equal 'vi', so comparing against it
 *     skipped the flat write for every native-language edit on vi/el sites.
 *   - id-less blocks (pre-save) have no override slot → everything goes flat.
 */
export function routeBlockChanges(
    changes: Record<string, unknown>,
    ctx: { hasBlockId: boolean; activeLocale: string; generationLocale?: string; siteLocale?: string },
): BlockChangeRouting {
    const { structural, content } = splitStructuralChanges(changes)
    const baseLocale = ctx.generationLocale || ctx.siteLocale || 'en'
    const writeContentFlat = !ctx.hasBlockId || ctx.activeLocale === baseLocale
    return {
        flatChanges: writeContentFlat ? changes : structural,
        contentOverride: ctx.hasBlockId ? content : {},
        purgeKeys: ctx.hasBlockId ? Object.keys(structural) : [],
    }
}
