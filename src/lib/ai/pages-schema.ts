/**
 * Shared source of truth for Pages.ts block schema — used by:
 *  - `src/app/api/ai/apply-template/route.ts` sanitizeBlocks()
 *  - `src/lib/ai/merge-user-content.ts` mergeUserContent()
 *
 * Must match `src/collections/Pages.ts` exactly. When Pages.ts schema
 * changes, update this file in the same PR.
 *
 * Upload fields (hero.image, navigation.logo, team.members[].image, etc.)
 * are intentionally excluded here — apply-template path does not yet run
 * the Unsplash pipeline (Phase 05 will wire it). Composer/seed data emit
 * string URLs or placeholder objects which Payload upload fields reject.
 */

/** Block types that have a persistence schema in Pages.ts layout blocks[]. */
export const PAGES_BLOCK_WHITELIST: ReadonlySet<string> = new Set([
    'navigation', 'hero', 'about', 'features', 'testimonials',
    'contact', 'gallery', 'footer', 'stats', 'pricing',
    'faq', 'team', 'socialWidget', 'cartWidget',
])

/**
 * Variant/layout validation — the sanitizer coerces each block's variant
 * to a Pages.ts enum value. `field` = which Pages.ts column receives it;
 * `values` = legal enum values; `fallback` = safe default.
 *
 * Blocks with both variant AND layout (navigation, about, features, gallery)
 * currently only route ONE of the two through this validator — see
 * apply-template sanitizer logic. Refactor is out of scope for Phase 01.
 */
export const PAGES_SCHEMA: Record<string, { field: string; values: string[]; fallback: string } | null> = {
    hero:         { field: 'variant', values: ['centered', 'split-left', 'split-right', 'fullscreen', 'video', 'magazine', 'minimal', 'cards-overlay', 'gradient', 'parallax', 'slideshow', 'split-video'], fallback: 'centered' },
    navigation:   { field: 'style',   values: ['fixed', 'sticky', 'static', 'transparent'], fallback: 'fixed' },
    about:        { field: 'layout',  values: ['image-right', 'image-left', 'centered', 'cards'], fallback: 'image-right' },
    features:     { field: 'layout',  values: ['grid-3', 'grid-2', 'alternating', 'centered-list'], fallback: 'grid-3' },
    testimonials: { field: 'variant', values: ['cards', 'carousel', 'simple', 'masonry', 'spotlight', 'minimal-quote', 'avatar-row', 'video-text', 'grid', 'single'], fallback: 'cards' },
    gallery:      { field: 'layout',  values: ['masonry', 'grid', 'carousel', 'lightbox'], fallback: 'masonry' },
    // Plan 260415 — contact/footer/stats/team gained persisted variant columns;
    // sanitizer now validates + preserves them. Previously: schema=null stripped variant.
    contact:      { field: 'variant', values: ['form', 'info-only', 'split', 'card-float', 'map-split', 'minimal-inline'], fallback: 'form' },
    footer:       { field: 'variant', values: ['simple', 'expanded', 'minimal', 'centered-stack', 'mega-footer', 'dark-gradient'], fallback: 'simple' },
    stats:        { field: 'variant', values: ['row', 'grid', 'highlight'], fallback: 'row' },
    team:         { field: 'variant', values: ['grid', 'list'], fallback: 'grid' },
    socialWidget: { field: 'variant', values: ['floating', 'inline'], fallback: 'floating' },
    cartWidget:   { field: 'variant', values: ['floating', 'inline'], fallback: 'floating' },
    pricing: null, faq: null,
}

/** Map blueprint variant names → Pages.ts valid values. */
export const VARIANT_ALIASES: Record<string, Record<string, string>> = {
    hero: {
        'split': 'split-left', 'split-image': 'split-left', 'editorial': 'centered',
        'fullscreen-image': 'fullscreen', 'fullscreen-video': 'video',
        'video-background': 'video', 'video-bg': 'video', 'overlay': 'fullscreen',
        'story': 'split-left',
    },
    about: { 'simple': 'centered', 'split': 'image-right', 'story': 'image-right', 'single-column': 'centered', 'two-column': 'image-right', 'timeline': 'image-right' },
    features: { 'grid': 'grid-3', 'list': 'centered-list', 'icon-grid': 'grid-3', 'card-grid': 'grid-3', 'cards': 'grid-3', 'detailed': 'centered-list', 'detailed-list': 'centered-list', 'icon-top': 'grid-3', 'icon-left': 'grid-2', 'zigzag': 'alternating', 'carousel': 'grid-3', 'minimal-list': 'centered-list' },
    testimonials: { 'cards': 'grid', 'simple': 'carousel', 'spotlight': 'single', 'minimal-quote': 'single', 'avatar-row': 'carousel', 'video-text': 'carousel', 'featured': 'single', 'marquee': 'carousel', 'quote': 'single', 'single-highlight': 'single', 'slider': 'carousel' },
    gallery: { 'filmstrip': 'carousel', 'justified': 'grid', 'fullscreen-grid': 'grid', 'slider': 'carousel', 'spotlight': 'lightbox' },
    navigation: { 'simple': 'fixed', 'centered': 'fixed', 'mega-menu': 'fixed', 'sidebar': 'fixed', 'pill': 'fixed' },
}

/**
 * Whitelist of fields to preserve per block type. Everything else is stripped.
 *
 * SOURCE OF TRUTH: `src/collections/Pages.ts` block field definitions.
 * UPLOAD FIELDS EXCLUDED: hero.image/backgroundImage, navigation.logo,
 * about.image, footer.logo, team.members[].image, testimonials[].avatar,
 * gallery.images[].image — see file header for rationale.
 */
export const PAGES_FIELDS: Record<string, string[]> = {
    hero: ['variant', 'headline', 'subheadline', 'ctaButtons', 'videoUrl', 'badge'],
    navigation: ['variant', 'style', 'logoText', 'links', 'ctaButton'],
    about: ['variant', 'layout', 'sectionLabel', 'headline', 'body', 'stats'],
    features: ['sectionLabel', 'headline', 'subheadline', 'variant', 'layout', 'features'],
    testimonials: ['headline', 'variant', 'testimonials'],
    gallery: ['headline', 'variant', 'layout'],
    contact: ['variant', 'headline', 'subtext', 'email', 'phone', 'address', 'formFields', 'showMap', 'mapEmbedUrl'],
    footer: ['variant', 'logoText', 'tagline', 'columns', 'copyrightText', 'showSocialLinks'],
    stats: ['variant', 'headline', 'stats'],
    pricing: ['headline', 'subheadline', 'plans'],
    faq: ['headline', 'faqs'],
    team: ['variant', 'headline', 'members'],
    socialWidget: ['variant', 'headline', 'links'],
    cartWidget: ['variant', 'label', 'showLabel'],
}

const STRUCTURAL_FIELDS = new Set(['variant', 'layout', 'style'])

/** PAGES_FIELDS minus structural fields — used by mergeUserContent to preserve user copy. */
export const CONTENT_FIELDS: Record<string, string[]> = Object.fromEntries(
    Object.entries(PAGES_FIELDS).map(([bt, fields]) => [bt, fields.filter(f => !STRUCTURAL_FIELDS.has(f))])
)

/**
 * Sanitize a single block: keep only whitelisted fields, coerce variant/layout
 * to valid Pages.ts enum, drop everything else. Returns a new object.
 */
export function sanitizeBlockForPayload(block: Record<string, unknown>): Record<string, unknown> | null {
    const bt = block.blockType as string
    if (!PAGES_BLOCK_WHITELIST.has(bt)) return null

    const schema = PAGES_SCHEMA[bt]
    const allowedFields = PAGES_FIELDS[bt] || []
    const result: Record<string, unknown> = { blockType: bt }

    for (const field of allowedFields) {
        if (block[field] !== undefined) {
            result[field] = block[field]
        }
    }

    if (schema) {
        const raw = (block.variant ?? block.layout) as string | undefined
        const aliased = raw && VARIANT_ALIASES[bt]?.[raw] ? VARIANT_ALIASES[bt]![raw]! : raw
        const resolved = aliased && schema.values.includes(aliased) ? aliased : schema.fallback
        result[schema.field] = resolved
        if (schema.field === 'variant') delete result.layout
        if (schema.field === 'layout') delete result.variant
    } else {
        delete result.variant
        delete result.layout
    }

    return result
}

/** Bulk sanitize: filter out unknown block types, sanitize the rest. */
export function sanitizeBlocksForPayload(
    blocks: Record<string, unknown>[],
): Record<string, unknown>[] {
    return blocks
        .map(sanitizeBlockForPayload)
        .filter((b): b is Record<string, unknown> => b !== null)
}
