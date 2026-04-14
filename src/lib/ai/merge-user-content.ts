/**
 * Merge user content into new template blocks when switching templates.
 * Preserves user-edited content (text, arrays) while applying new template structure (variant/layout).
 */

// Fields that define template structure (variant/layout) — NOT user content
const STRUCTURAL_FIELDS = new Set(['variant', 'layout', 'style'])

// All allowed fields per block type (from Pages.ts Payload schema)
export const PAGES_FIELDS: Record<string, string[]> = {
    hero: ['variant', 'headline', 'subheadline', 'videoUrl'],
    navigation: ['style', 'logoText', 'links'],
    about: ['layout', 'sectionLabel', 'headline', 'body'],
    features: ['sectionLabel', 'headline', 'subheadline', 'layout', 'features'],
    testimonials: ['headline', 'variant', 'testimonials'],
    gallery: ['headline', 'layout'],
    contact: ['headline', 'subtext', 'email', 'phone', 'address', 'showMap', 'mapEmbedUrl'],
    footer: ['logoText', 'logo', 'tagline', 'columns', 'copyrightText', 'showSocialLinks'],
    stats: ['headline', 'stats'],
    pricing: ['headline', 'subheadline'],
    faq: ['headline', 'faqs'],
    team: ['headline'],
    socialWidget: ['variant', 'headline', 'links'],
    cartWidget: ['variant', 'label', 'showLabel'],
}

// Content fields per block type = PAGES_FIELDS minus structural fields
// These are preserved from user's existing blocks when switching templates
export const CONTENT_FIELDS: Record<string, string[]> = {}
for (const [bt, fields] of Object.entries(PAGES_FIELDS)) {
    CONTENT_FIELDS[bt] = fields.filter(f => !STRUCTURAL_FIELDS.has(f))
}

/**
 * Merge user content into template blocks.
 * Strategy: match blocks by blockType (first-match per type),
 * take structural fields (variant/layout) from template,
 * take content fields (headline, body, etc.) from user's existing block.
 */
export function mergeUserContent(
    templateBlocks: Record<string, unknown>[],
    existingBlocks: Record<string, unknown>[],
): Record<string, unknown>[] {
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

    return templateBlocks.map(templateBlock => {
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
        return merged
    })
}
