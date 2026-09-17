/**
 * Merge user content into new template blocks when switching templates.
 * Preserves user-edited content (text, arrays) while applying new template
 * structure (variant/layout).
 *
 * PAGES_FIELDS + CONTENT_FIELDS live in `./pages-schema.ts` (single source
 * of truth shared with apply-template sanitizer).
 */

import {
    CONTENT_FIELDS,
    PAGES_FIELDS,
    USER_PRESERVE_MEDIA_FIELDS,
    USER_PRESERVE_NESTED_MEDIA_FIELDS,
} from './pages-schema'

export { PAGES_FIELDS, CONTENT_FIELDS }

/**
 * Merge user content into template blocks.
 * Strategy: match blocks by blockType (first-match per type),
 * take structural fields (variant/layout) from template,
 * take content fields (headline, body, etc.) from user's existing block.
 */
export type MergeResult = {
    mergedBlocks: Record<string, unknown>[]
    unmatchedUserBlocks: Record<string, unknown>[]
}

function getPersistedMediaId(value: unknown): number | null {
    if (typeof value === 'number' && Number.isSafeInteger(value) && value > 0) return value
    if (value && typeof value === 'object') {
        const id = (value as { id?: unknown }).id
        if (typeof id === 'number' && Number.isSafeInteger(id) && id > 0) return id
    }
    return null
}

function preserveNestedMedia(
    blockType: string,
    existingBlock: Record<string, unknown>,
    mergedBlock: Record<string, unknown>,
) {
    const rule = USER_PRESERVE_NESTED_MEDIA_FIELDS[blockType]
    if (!rule) return

    const existingItems = existingBlock[rule.field]
    if (!Array.isArray(existingItems)) return

    const preservedItems = existingItems.flatMap((item) => {
        if (!item || typeof item !== 'object') return []
        const record = item as Record<string, unknown>
        const rawMedia = record[rule.mediaField]
        const hasMedia = rawMedia !== undefined && rawMedia !== null
        const mediaId = getPersistedMediaId(rawMedia)
        // A supplied non-Payload media value (for example a URL) cannot be
        // persisted safely. A missing media value is valid, though: gallery
        // rows may intentionally contain only a caption.
        if (hasMedia && !mediaId) return []

        const preserved: Record<string, unknown> = {}
        if (mediaId) preserved[rule.mediaField] = mediaId
        for (const field of rule.textFields) {
            if (Object.prototype.hasOwnProperty.call(record, field) && typeof record[field] === 'string') {
                preserved[field] = record[field]
            }
        }
        return Object.keys(preserved).length > 0 ? [preserved] : []
    })

    // Presence of the user's array is authoritative, including an intentional
    // empty array. Never fall back to template media after the user cleared it.
    mergedBlock[rule.field] = preservedItems
}

export function mergeUserContent(
    templateBlocks: Record<string, unknown>[],
    existingBlocks: Record<string, unknown>[],
): Record<string, unknown>[]
export function mergeUserContent(
    templateBlocks: Record<string, unknown>[],
    existingBlocks: Record<string, unknown>[],
    options: { returnDetails: true },
): MergeResult
export function mergeUserContent(
    templateBlocks: Record<string, unknown>[],
    existingBlocks: Record<string, unknown>[],
    options?: { returnDetails: boolean },
): Record<string, unknown>[] | MergeResult {
    // Group existing blocks by blockType (preserve order for multiple same-type blocks)
    const existingByType: Record<string, Record<string, unknown>[]> = {}
    for (const block of existingBlocks) {
        const bt = block.blockType as string
        if (!bt) continue
        if (!existingByType[bt]) existingByType[bt] = []
        existingByType[bt].push(block)
    }
    // Track usage index per blockType to handle multiple blocks of same type
    const usageIndex: Record<string, number> = {}

    const mergedBlocks = templateBlocks.map(templateBlock => {
        const bt = templateBlock.blockType as string
        if (!bt) return templateBlock

        const contentFields = CONTENT_FIELDS[bt]
        if (!contentFields || contentFields.length === 0) return templateBlock

        // Find matching existing block (by type, ordered)
        const idx = usageIndex[bt] || 0
        usageIndex[bt] = idx + 1
        const existingBlock = existingByType[bt]?.[idx]
        if (!existingBlock) return templateBlock

        // Merge: template structure + user content
        const merged = { ...templateBlock }
        // Canonical system blocks are JSON on Sites, not Pages layout columns.
        // Their translated copy and language configuration must survive a reskin.
        if (bt === 'navigation' || bt === 'footer') {
            for (const field of ['_localeContent', 'primaryLocale', 'secondaryLocale', 'showLanguageSwitcher', 'multilingualEnabled']) {
                if (Object.prototype.hasOwnProperty.call(existingBlock, field)) {
                    merged[field] = structuredClone(existingBlock[field])
                }
            }
        }
        // Keep the existing top-level block identity. Besides avoiding needless
        // Payload row churn, locale_content uses this ID as its lookup key.
        if (typeof existingBlock.id === 'string' && existingBlock.id.length > 0) {
            merged.id = existingBlock.id
        }
        for (const field of contentFields) {
            // An explicitly empty/null value is still user-owned content (for
            // example a cleared subtitle or empty feature list). Only absence
            // of the property permits the template default to fill the slot.
            if (Object.prototype.hasOwnProperty.call(existingBlock, field)) {
                merged[field] = existingBlock[field]
            }
        }
        // Preserve user's uploaded media (valid Payload IDs) — these are excluded
        // from PAGES_FIELDS to prevent template string-URL assets failing validation,
        // so we carry them over explicitly from the user's existing block.
        const mediaFields = USER_PRESERVE_MEDIA_FIELDS[bt]
        if (mediaFields) {
            for (const field of mediaFields) {
                if (Object.prototype.hasOwnProperty.call(existingBlock, field)) {
                    merged[field] = existingBlock[field]
                }
            }
        }
        preserveNestedMedia(bt, existingBlock, merged)
        return merged
    })

    if (!options?.returnDetails) return mergedBlocks

    // Compute unmatched user blocks: blocks with types not in template, or extras beyond template count
    const templateTypeCounts: Record<string, number> = {}
    for (const tb of templateBlocks) {
        const bt = tb.blockType as string
        if (bt) templateTypeCounts[bt] = (templateTypeCounts[bt] || 0) + 1
    }

    const unmatchedUserBlocks: Record<string, unknown>[] = []
    const existingCounts: Record<string, number> = {}
    for (const eb of existingBlocks) {
        const bt = eb.blockType as string
        if (!bt || bt === 'navigation' || bt === 'footer') continue
        existingCounts[bt] = (existingCounts[bt] || 0) + 1
        if (!templateTypeCounts[bt] || existingCounts[bt] > templateTypeCounts[bt]) {
            unmatchedUserBlocks.push(eb)
        }
    }

    return { mergedBlocks, unmatchedUserBlocks }
}
