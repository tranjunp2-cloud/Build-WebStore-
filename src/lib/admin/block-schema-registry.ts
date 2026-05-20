/**
 * block-schema-registry.ts
 * Provides real Zod-based schema introspection for blocks.
 * Each block's config.ts must export `configSchema` (a ZodObject).
 * The registry map is statically imported (no dynamic imports) for SSR perf.
 *
 * Phase P2 — replaces name-heuristic type inference in BlockSchemaInspector.
 */
import type { ZodObject, ZodTypeAny, ZodRawShape } from 'zod'

// ── Public types ──────────────────────────────────────────────────────────────

export type FieldMeta = {
    name: string
    /** Resolved type label: 'string' | 'number' | 'boolean' | 'array' | 'object' | 'enum' | 'url' */
    type: string
    required: boolean
    optional: boolean
    nullable: boolean
    description?: string
    minLength?: number
    maxLength?: number
    min?: number
    max?: number
    enumValues?: string[]
    /** Element type for arrays (shorthand, depth-1 only) */
    itemType?: string
}

// ── Zod internal type names ───────────────────────────────────────────────────

type ZodDef = {
    typeName: string
    description?: string
    checks?: Array<{ kind: string; value?: number }>
    minLength?: { value: number } | null
    maxLength?: { value: number } | null
    minimum?: number | null
    maximum?: number | null
    values?: Record<string, string>
    innerType?: ZodTypeAny
    type?: ZodTypeAny        // ZodArray element type
    schema?: ZodTypeAny      // ZodDefault inner schema
    options?: string[]       // ZodEnum options
    _def?: ZodDef
}

function getDef(z: ZodTypeAny): ZodDef {
    return (z as unknown as { _def: ZodDef })._def
}

/** Recursively unwrap ZodOptional / ZodNullable / ZodDefault to get the core type */
function unwrap(z: ZodTypeAny): { z: ZodTypeAny; optional: boolean; nullable: boolean } {
    let optional = false
    let nullable = false
    let cur: ZodTypeAny = z
    let depth = 0
    while (depth < 8) {
        const def = getDef(cur)
        if (def.typeName === 'ZodOptional') { optional = true; cur = def.innerType!; depth++; continue }
        if (def.typeName === 'ZodNullable') { nullable = true; cur = def.innerType!; depth++; continue }
        if (def.typeName === 'ZodDefault') { optional = true; cur = def.schema ?? def.innerType!; depth++; continue }
        break
    }
    return { z: cur, optional, nullable }
}

/** Derive a human-readable type label from the innermost ZodType */
function resolveType(z: ZodTypeAny): { type: string; enumValues?: string[]; itemType?: string } {
    const def = getDef(z)
    switch (def.typeName) {
        case 'ZodString': {
            const isUrl = def.checks?.some((c) => c.kind === 'url')
            return { type: isUrl ? 'url' : 'string' }
        }
        case 'ZodNumber': return { type: 'number' }
        case 'ZodBoolean': return { type: 'boolean' }
        case 'ZodEnum': {
            // `def.options` is an array in Zod v3 native enums; `def.values` is a
            // Record<string, string> in some edge-case shapes. Handle both defensively.
            const vals: string[] = Array.isArray(def.options)
                ? def.options
                : Array.isArray(def.values)
                    ? def.values
                    : Object.values(def.values ?? {})
            return { type: 'enum', enumValues: vals }
        }
        case 'ZodArray': {
            const elementDef = def.type ? getDef(def.type) : null
            const itemType = elementDef?.typeName === 'ZodObject' ? 'object'
                : elementDef?.typeName === 'ZodString' ? 'string'
                : elementDef?.typeName === 'ZodNumber' ? 'number'
                : 'unknown'
            return { type: 'array', itemType }
        }
        case 'ZodObject': return { type: 'object' }
        case 'ZodLiteral': return { type: 'string' }
        default: return { type: def.typeName?.replace('Zod', '').toLowerCase() ?? 'unknown' }
    }
}

/** Extract min/max constraints from ZodString or ZodNumber checks */
function extractConstraints(z: ZodTypeAny): Pick<FieldMeta, 'minLength' | 'maxLength' | 'min' | 'max'> {
    const def = getDef(z)
    const result: Pick<FieldMeta, 'minLength' | 'maxLength' | 'min' | 'max'> = {}
    if (!def.checks) return result
    for (const check of def.checks) {
        if (check.kind === 'min') {
            if (def.typeName === 'ZodString') result.minLength = check.value
            else result.min = check.value
        } else if (check.kind === 'max') {
            if (def.typeName === 'ZodString') result.maxLength = check.value
            else result.max = check.value
        }
    }
    return result
}

/**
 * Introspect a ZodObject schema and return FieldMeta[] for each field.
 * Depth limit: 1 (only top-level fields). Nested objects/arrays described by type only.
 */
export function introspectSchema(schema: ZodObject<ZodRawShape>): FieldMeta[] {
    const shape: Record<string, ZodTypeAny> =
        (schema as unknown as { shape?: Record<string, ZodTypeAny> }).shape ?? {}
    return Object.entries(shape).map(([name, raw]) => {
        const { z: inner, optional, nullable } = unwrap(raw)
        const { type, enumValues, itemType } = resolveType(inner)
        const innerDef = getDef(inner)
        const constraints = extractConstraints(inner)
        const description: string | undefined = getDef(raw)?.description ?? innerDef?.description

        return {
            name,
            type,
            required: !optional && !nullable,
            optional,
            nullable,
            description,
            enumValues,
            itemType,
            ...constraints,
        }
    })
}

// ── Static schema map (pre-bundled, no dynamic imports) ───────────────────────
// Import configSchema from each block's config.ts. Some blocks may not export
// it yet (legacy) — those entries are null and the UI shows "schema missing".

import { configSchema as aboutSchema } from '@/blocks/about/config'
import { configSchema as accordionSchema } from '@/blocks/accordion/config'
import { configSchema as announcementBarSchema } from '@/blocks/announcement-bar/config'
import { configSchema as beforeAfterSchema } from '@/blocks/before-after/config'
import { configSchema as blogListSchema } from '@/blocks/blog-list/config'
import { configSchema as bookingWidgetSchema } from '@/blocks/booking-widget/config'
import { configSchema as breadcrumbSchema } from '@/blocks/breadcrumb/config'
import { configSchema as carouselSchema } from '@/blocks/carousel/config'
import { configSchema as cartWidgetSchema } from '@/blocks/cart-widget/config'
import { configSchema as classScheduleSchema } from '@/blocks/class-schedule/config'
import { configSchema as clientLogosSchema } from '@/blocks/client-logos/config'
import { configSchema as contactSchema } from '@/blocks/contact/config'
import { configSchema as countdownTimerSchema } from '@/blocks/countdown-timer/config'
import { configSchema as ctaSchema } from '@/blocks/cta/config'
import { configSchema as customHtmlSchema } from '@/blocks/custom-html/config'
import { configSchema as dividerSchema } from '@/blocks/divider/config'
import { configSchema as doctorProfileSchema } from '@/blocks/doctor-profile/config'
import { configSchema as downloadCtaSchema } from '@/blocks/download-cta/config'
import { configSchema as faqSchema } from '@/blocks/faq/config'
import { configSchema as featureComparisonSchema } from '@/blocks/feature-comparison/config'
import { configSchema as featuresSchema } from '@/blocks/features/config'
import { configSchema as footerSchema } from '@/blocks/footer/config'
import { configSchema as gallerySchema } from '@/blocks/gallery/config'
import { configSchema as galleryMasonrySchema } from '@/blocks/gallery-masonry/config'
import { configSchema as googleMapsSchema } from '@/blocks/google-maps/config'
import { configSchema as heroSchema } from '@/blocks/hero/config'
import { configSchema as logoCloudSchema } from '@/blocks/logo-cloud/config'
import { configSchema as menuDisplaySchema } from '@/blocks/menu-display/config'
import { configSchema as menuFoodSchema } from '@/blocks/menu-food/config'
import { configSchema as navigationSchema } from '@/blocks/navigation/config'
import { configSchema as newsletterSchema } from '@/blocks/newsletter/config'
import { configSchema as portfolioGridSchema } from '@/blocks/portfolio-grid/config'
import { configSchema as pricingSchema } from '@/blocks/pricing/config'
import { configSchema as pricingTableSchema } from '@/blocks/pricing-table/config'
import { configSchema as productQuickViewSchema } from '@/blocks/product-quick-view/config'
import { configSchema as productsFeaturedSchema } from '@/blocks/products-featured/config'
import { configSchema as productsGridSchema } from '@/blocks/products-grid/config'
import { configSchema as propertyCardSchema } from '@/blocks/property-card/config'
import { configSchema as reviewCardsSchema } from '@/blocks/review-cards/config'
import { configSchema as serviceCardsSchema } from '@/blocks/service-cards/config'
import { configSchema as socialProofSchema } from '@/blocks/social-proof/config'
import { configSchema as socialWidgetSchema } from '@/blocks/social-widget/config'
import { configSchema as statsSchema } from '@/blocks/stats/config'
import { configSchema as stepProcessSchema } from '@/blocks/step-process/config'
import { configSchema as teamSchema } from '@/blocks/team/config'
import { configSchema as testimonialsSchema } from '@/blocks/testimonials/config'
import { configSchema as videoSchema } from '@/blocks/video/config'
import { configSchema as videoBackgroundSchema } from '@/blocks/video-background/config'
import { configSchema as videoShowcaseSchema } from '@/blocks/video-showcase/config'
import { configSchema as whatsappButtonSchema } from '@/blocks/whatsapp-button/config'

type AnyZodObject = ZodObject<ZodRawShape>

// Null entries = block config.ts doesn't export configSchema yet (legacy fallback)
const SCHEMA_MAP: Record<string, AnyZodObject | null> = {
    about: aboutSchema ?? null,
    accordion: accordionSchema ?? null,
    'announcement-bar': announcementBarSchema ?? null,
    'before-after': beforeAfterSchema ?? null,
    'blog-list': blogListSchema ?? null,
    'booking-widget': bookingWidgetSchema ?? null,
    breadcrumb: breadcrumbSchema ?? null,
    carousel: carouselSchema ?? null,
    'cart-widget': cartWidgetSchema ?? null,
    cartWidget: cartWidgetSchema ?? null,
    'class-schedule': classScheduleSchema ?? null,
    'client-logos': clientLogosSchema ?? null,
    contact: contactSchema ?? null,
    'countdown-timer': countdownTimerSchema ?? null,
    cta: ctaSchema ?? null,
    'custom-html': customHtmlSchema ?? null,
    divider: dividerSchema ?? null,
    'doctor-profile': doctorProfileSchema ?? null,
    'download-cta': downloadCtaSchema ?? null,
    faq: faqSchema ?? null,
    'feature-comparison': featureComparisonSchema ?? null,
    features: featuresSchema ?? null,
    footer: footerSchema ?? null,
    gallery: gallerySchema ?? null,
    'gallery-masonry': galleryMasonrySchema ?? null,
    'google-maps': googleMapsSchema ?? null,
    hero: heroSchema ?? null,
    'logo-cloud': logoCloudSchema ?? null,
    'menu-display': menuDisplaySchema ?? null,
    'menu-food': menuFoodSchema ?? null,
    navigation: navigationSchema ?? null,
    newsletter: newsletterSchema ?? null,
    'portfolio-grid': portfolioGridSchema ?? null,
    pricing: pricingSchema ?? null,
    'pricing-table': pricingTableSchema ?? null,
    'product-quick-view': productQuickViewSchema ?? null,
    'products-featured': productsFeaturedSchema ?? null,
    'products-grid': productsGridSchema ?? null,
    'property-card': propertyCardSchema ?? null,
    'review-cards': reviewCardsSchema ?? null,
    'service-cards': serviceCardsSchema ?? null,
    'social-proof': socialProofSchema ?? null,
    'social-widget': socialWidgetSchema ?? null,
    socialWidget: socialWidgetSchema ?? null,
    stats: statsSchema ?? null,
    'step-process': stepProcessSchema ?? null,
    team: teamSchema ?? null,
    testimonials: testimonialsSchema ?? null,
    video: videoSchema ?? null,
    'video-background': videoBackgroundSchema ?? null,
    'video-showcase': videoShowcaseSchema ?? null,
    'whatsapp-button': whatsappButtonSchema ?? null,
}

/**
 * Get the ZodObject schema for a block slug, or null if not available.
 */
export function getSchemaForBlock(slug: string): AnyZodObject | null {
    return SCHEMA_MAP[slug] ?? null
}
