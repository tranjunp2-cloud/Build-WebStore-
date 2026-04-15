/**
 * Merge user content into new template blocks when switching templates.
 * Preserves user-edited content (text, arrays) while applying new template structure (variant/layout).
 */

// Fields that define template structure (variant/layout) — NOT user content
const STRUCTURAL_FIELDS = new Set(['variant', 'layout', 'style'])

// All allowed fields per block type (from Pages.ts Payload schema)
export const PAGES_FIELDS: Record<string, string[]> = {
    // Core blocks
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
    // AI-generated / Block Library blocks (must be here for content merge during template switch)
    cta: ['variant', 'headline', 'subheadline', 'ctaLabel', 'ctaUrl', 'ctaStyle'],
    newsletter: ['variant', 'headline', 'subheadline', 'buttonLabel', 'placeholder'],
    video: ['variant', 'headline', 'subheadline', 'videoUrl', 'posterImage'],
    'logo-cloud': ['variant', 'headline', 'logos'],
    'products-grid': ['variant', 'headline', 'subheadline', 'limit', 'category'],
    'products-featured': ['variant', 'headline', 'subheadline'],
    'service-cards': ['variant', 'headline', 'subheadline', 'services'],
    carousel: ['variant', 'headline', 'autoplay', 'interval', 'items'],
    'step-process': ['variant', 'headline', 'subheadline', 'steps'],
    divider: ['variant', 'height', 'color'],
    'announcement-bar': ['variant', 'message', 'linkText', 'linkUrl', 'dismissible', 'backgroundColor'],
    'whatsapp-button': ['variant', 'phoneNumber', 'message', 'label', 'position'],
    'menu-food': ['variant', 'headline', 'categories'],
    'social-proof': ['variant', 'headline', 'reviews'],
    'portfolio-grid': ['variant', 'headline', 'subheadline', 'projects'],
    'google-maps': ['variant', 'headline', 'embedUrl', 'address', 'height'],
    accordion: ['variant', 'headline', 'description', 'items'],
    'countdown-timer': ['variant', 'headline', 'targetDate', 'expiredMessage', 'showDays', 'showHours', 'showMinutes', 'showSeconds'],
    'custom-html': ['html'],
    'blog-list': ['variant', 'headline', 'subheadline', 'limit'],
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
