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
    // Core blocks
    'navigation', 'hero', 'about', 'features', 'testimonials',
    'contact', 'gallery', 'footer', 'stats', 'pricing',
    'faq', 'team', 'socialWidget', 'cartWidget',
    // AI-generated / Block Library blocks
    'cta', 'newsletter', 'video', 'logo-cloud', 'products-grid',
    'products-featured', 'service-cards', 'carousel', 'step-process',
    'divider', 'announcement-bar', 'whatsapp-button', 'menu-food',
    'social-proof', 'portfolio-grid', 'google-maps', 'accordion',
    'countdown-timer', 'custom-html', 'blog-list',
    'breadcrumb', 'client-logos',
    // Industry blocks (Plan 260417-0837 Phase 1.1)
    'doctor-profile', 'property-card', 'class-schedule',
    'video-showcase', 'product-quick-view', 'feature-comparison',
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
    // navigation has TWO select columns: `style` (validated here) and `variant`.
    // `variant` is intentionally NOT validated here because schema.field='style' means
    // the delete-cleanup inside sanitizeBlockForPayload never runs for variant — so variant
    // passes through as-is to Payload. It is sanitized downstream in apply-template/route.ts.
    navigation:   { field: 'style',   values: ['fixed', 'sticky', 'static', 'transparent'], fallback: 'fixed' },
    about:        { field: 'layout',  values: ['image-right', 'image-left', 'centered', 'cards'], fallback: 'image-right' },
    features:     { field: 'layout',  values: ['grid-3', 'grid-2', 'alternating', 'centered-list'], fallback: 'grid-3' },
    testimonials: { field: 'variant', values: ['cards', 'carousel', 'simple', 'masonry', 'spotlight', 'minimal-quote', 'avatar-row', 'video-text', 'grid', 'single'], fallback: 'cards' },
    gallery:      { field: 'layout',  values: ['masonry', 'grid', 'carousel', 'lightbox'], fallback: 'masonry' },
    // Plan 260415 — contact/footer/stats/team gained persisted variant columns;
    // sanitizer now validates + preserves them. Previously: schema=null stripped variant.
    contact:      { field: 'variant', values: ['form', 'info-only', 'split', 'card-float', 'map-split', 'minimal-inline'], fallback: 'form' },
    footer:       { field: 'variant', values: ['simple', 'minimal', 'centered-stack', 'dark-gradient'], fallback: 'simple' },
    stats:        { field: 'variant', values: ['row', 'grid', 'highlight', 'cards', 'inline-text', 'chart-bars'], fallback: 'row' },
    team:         { field: 'variant', values: ['grid', 'list', 'cards-hover-reveal', 'horizontal-scroll', 'bio-modal', 'compact-row'], fallback: 'grid' },
    socialWidget: { field: 'variant', values: ['floating', 'inline'], fallback: 'floating' },
    cartWidget:   { field: 'variant', values: ['floating', 'inline'], fallback: 'floating' },
    pricing:      { field: 'variant', values: ['cards', 'table', 'horizontal', 'toggle', 'tiered', 'comparison', 'minimal', 'slider'], fallback: 'cards' },
    faq:          { field: 'variant', values: ['accordion', 'grid', 'simple', 'two-column-accordion', 'chat-bubbles', 'numbered'], fallback: 'accordion' },
    // Industry blocks (Plan 260417-0837 Phase 1.1)
    'doctor-profile': { field: 'variant', values: ['cards', 'detailed', 'list'], fallback: 'cards' },
    'property-card': { field: 'variant', values: ['grid', 'list', 'featured'], fallback: 'grid' },
    'class-schedule': { field: 'variant', values: ['grid', 'list', 'cards'], fallback: 'grid' },
    'video-showcase': { field: 'variant', values: ['grid', 'featured', 'fullwidth'], fallback: 'grid' },
    'product-quick-view': { field: 'variant', values: ['grid', 'carousel', 'minimal'], fallback: 'grid' },
    'feature-comparison': { field: 'variant', values: ['table', 'cards'], fallback: 'table' },
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
    navigation: { 'default': 'fixed', 'centered': 'fixed', 'mega': 'fixed', 'sidebar': 'fixed', 'floating': 'fixed' },
    footer: { 'expanded': 'simple', 'mega-footer': 'dark-gradient' },
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
    pricing: ['variant', 'headline', 'subheadline', 'plans'],
    faq: ['variant', 'headline', 'faqs'],
    team: ['variant', 'headline', 'members'],
    socialWidget: ['variant', 'headline', 'links'],
    cartWidget: ['variant', 'label', 'showLabel'],
    // AI-generated / Block Library blocks (must be here for content merge during template switch)
    cta: ['variant', 'headline', 'subheadline', 'ctaLabel', 'ctaUrl', 'ctaStyle'],
    newsletter: ['variant', 'headline', 'subheadline', 'buttonLabel', 'placeholder'],
    video: ['variant', 'headline', 'subheadline', 'videoUrl'],
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
    breadcrumb: ['variant', 'items'],
    'client-logos': ['variant', 'headline', 'logos'],
    // Industry blocks (Plan 260417-0837 Phase 1.1)
    'doctor-profile': ['variant', 'headline', 'subheadline', 'doctors'],
    'property-card': ['variant', 'headline', 'subheadline', 'showMap', 'currency', 'properties'],
    'class-schedule': ['variant', 'headline', 'showCapacity', 'highlightToday', 'classes'],
    'video-showcase': ['variant', 'headline', 'subheadline', 'showCategories', 'autoplay', 'videos'],
    'product-quick-view': ['variant', 'headline', 'subheadline', 'columns', 'showQuickView', 'currency', 'products'],
    'feature-comparison': ['variant', 'headline', 'products', 'features'],
}

const STRUCTURAL_FIELDS = new Set(['variant', 'layout', 'style'])

/**
 * Top-level upload/media fields to carry over from the USER'S existing blocks
 * when switching templates on an existing site.
 *
 * Intentionally separate from PAGES_FIELDS so that sanitizeBlockForPayload
 * (which runs on template DB blocks) never touches these — template blocks
 * may have null/string-URL assets that Payload upload validators reject.
 * mergeUserContent reads this map to copy only the user's valid media IDs.
 *
 * Nested array upload fields (team.members[].image, testimonials[].avatar) are
 * already preserved because their parent arrays (members, testimonials) are in
 * CONTENT_FIELDS and copied wholesale.
 *
 * gallery.images is intentionally NOT in this map — gallery.images is also absent
 * from PAGES_FIELDS, so it is neither sanitized from templates nor preserved from
 * users. Wiring it up requires Payload upload-field validation (same class of risk
 * as hero.image); defer to the Unsplash pipeline (Phase 05).
 */
export const USER_PRESERVE_MEDIA_FIELDS: Record<string, string[]> = {
    hero: ['image', 'backgroundImage'],
    navigation: ['logo'],
    about: ['image'],
    footer: ['logo'],
    video: ['posterImage'], // upload field — excluded from PAGES_FIELDS to prevent template string URLs failing Payload validation
}

/** PAGES_FIELDS minus structural fields — used by mergeUserContent to preserve user copy. */
export const CONTENT_FIELDS: Record<string, string[]> = Object.fromEntries(
    Object.entries(PAGES_FIELDS).map(([bt, fields]) => [bt, fields.filter(f => !STRUCTURAL_FIELDS.has(f))])
)

/**
 * Plan 260415 fix-500 — walk nested array sub-items and strip `id` fields.
 * Payload generates its own `id` column for array sub-tables, and passing
 * a non-matching value causes "The following field is invalid: id" on
 * apply-template when the template JSON was authored by the composer.
 * Also normalize pricing.plans[].features from `string[]` to
 * `[{text, included}]` so the Payload pricing schema accepts them.
 */
function sanitizeNestedItems(block: Record<string, unknown>): void {
    const ARRAY_FIELDS = [
        'features', 'testimonials', 'faqs', 'items', 'images', 'plans',
        'members', 'columns', 'links', 'services', 'stats', 'formFields',
        'ctaButtons', 'logos', 'projects',
        // Industry blocks (Plan 260417-0837 Phase 1.1)
        'doctors', 'properties', 'classes', 'videos', 'products',
    ] as const

    // Payload upload fields within array items — must be a numeric Media ID or absent.
    // Template/composer data may carry string URLs or SVG placeholders that Payload
    // rejects with "field is invalid". Strip anything that is not already a numeric ID.
    const ITEM_UPLOAD_FIELDS = ['image', 'avatar', 'logo', 'posterImage', 'backgroundImage']

    for (const field of ARRAY_FIELDS) {
        const arr = block[field]
        if (!Array.isArray(arr)) continue
        block[field] = (arr as unknown[]).map((item) => {
            if (!item || typeof item !== 'object') return item
            const copy: Record<string, unknown> = { ...(item as Record<string, unknown>) }
            delete copy.id
            delete copy._uuid
            for (const uploadField of ITEM_UPLOAD_FIELDS) {
                if (uploadField in copy && typeof copy[uploadField] !== 'number') {
                    delete copy[uploadField]
                }
            }
            // Recurse 1 level deeper for nested sub-arrays (e.g.
            // footer.columns[].links[], menu-food.categories[].items[]).
            for (const subField of ARRAY_FIELDS) {
                const subArr = copy[subField]
                if (!Array.isArray(subArr)) continue
                copy[subField] = (subArr as unknown[]).map((subItem) => {
                    if (!subItem || typeof subItem !== 'object') return subItem
                    const subCopy: Record<string, unknown> = { ...(subItem as Record<string, unknown>) }
                    delete subCopy.id
                    delete subCopy._uuid
                    for (const uploadField of ITEM_UPLOAD_FIELDS) {
                        if (uploadField in subCopy && typeof subCopy[uploadField] !== 'number') {
                            delete subCopy[uploadField]
                        }
                    }
                    return subCopy
                })
            }
            return copy
        })
    }

    // Special-case: pricing.plans[].features may be string[] or object[].
    // Normalize to the Payload-required {text, included} shape.
    if (block.blockType === 'pricing' && Array.isArray(block.plans)) {
        block.plans = (block.plans as Array<Record<string, unknown>>).map((plan) => {
            if (!plan || typeof plan !== 'object') return plan
            const features = plan.features
            if (Array.isArray(features)) {
                return {
                    ...plan,
                    features: features.map((f) =>
                        typeof f === 'string'
                            ? { text: f, included: true }
                            : f,
                    ),
                }
            }
            return plan
        })
    }
}

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

    // Strip nested `id` + normalize pricing plan feature shape.
    sanitizeNestedItems(result)
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
