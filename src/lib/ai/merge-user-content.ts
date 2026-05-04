/**
 * Merge user content into new template blocks when switching templates.
 * Preserves user-edited content (text, arrays) while applying new template
 * structure (variant/layout).
 *
 * PAGES_FIELDS + CONTENT_FIELDS live in `./pages-schema.ts` (single source
 * of truth shared with apply-template sanitizer).
 */

import { CONTENT_FIELDS, PAGES_FIELDS, USER_PRESERVE_MEDIA_FIELDS } from './pages-schema'

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
        for (const field of contentFields) {
            const userValue = existingBlock[field]
            // Only preserve user content if it's non-empty
            if (userValue !== undefined && userValue !== null && userValue !== '') {
                merged[field] = userValue
            }
        }
        // Preserve user's uploaded media (valid Payload IDs) — these are excluded
        // from PAGES_FIELDS to prevent template string-URL assets failing validation,
        // so we carry them over explicitly from the user's existing block.
        const mediaFields = USER_PRESERVE_MEDIA_FIELDS[bt]
        if (mediaFields) {
            for (const field of mediaFields) {
                const userValue = existingBlock[field]
                if (userValue !== undefined && userValue !== null) {
                    merged[field] = userValue
                }
            }
        }
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
