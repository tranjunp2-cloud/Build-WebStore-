import { z } from 'zod'

// ── Theme Configuration ─────────────────────────────────────────────────────
export type ThemeConfig = {
    // Colors (6 tokens)
    primaryColor: string
    secondaryColor: string
    accentColor: string
    surfaceColor: string
    textColor: string
    mutedColor: string

    // Typography
    fontPairingId: string | null
    fontHeading: string
    fontBody: string

    // Spacing
    spacingPreset: 'compact' | 'default' | 'relaxed'

    // Shape
    borderRadius: 'sharp' | 'subtle' | 'rounded' | 'soft' | 'pill'
    shadowPreset: 'none' | 'subtle' | 'medium' | 'dramatic'

    // Mode
    colorMode: 'light' | 'dark'
    backgroundColor: string
}

export const ThemeConfigSchema = z.object({
    // Colors
    primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default('#0ea5e9'),
    secondaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default('#d946ef'),
    accentColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default('#f59e0b'),
    surfaceColor: z.string().default('#ffffff'),
    textColor: z.string().default('#09090b'),
    mutedColor: z.string().default('#71717a'),

    // Typography
    fontPairingId: z.string().nullable().default(null),
    fontHeading: z.string().default('Outfit'),
    fontBody: z.string().default('Inter'),

    // Spacing
    spacingPreset: z.enum(['compact', 'default', 'relaxed']).default('default'),

    // Shape
    borderRadius: z.enum(['sharp', 'subtle', 'rounded', 'soft', 'pill']).default('rounded'),
    shadowPreset: z.enum(['none', 'subtle', 'medium', 'dramatic']).default('subtle'),

    // Mode
    colorMode: z.enum(['light', 'dark']).default('dark'),
    backgroundColor: z.string().default('#09090b'),
})

// ── Block Types Enum ─────────────────────────────────────────────────────────
export const BLOCK_TYPES = [
    'navigation', 'hero', 'about', 'features', 'testimonials',
    'contact', 'gallery', 'footer', 'faq', 'pricing',
    'cta', 'stats', 'team', 'newsletter',
    'products-grid', 'products-featured',
    'video', 'logo-cloud', 'blog-list', 'custom-html',
    'socialWidget', 'cartWidget',
    // v1.1 — Block Library Expansion
    'pricing-table', 'gallery-masonry', 'whatsapp-button', 'google-maps', 'social-proof',
    'countdown-timer', 'before-after', 'feature-comparison', 'download-cta', 'video-background',
    'breadcrumb', 'divider', 'announcement-bar', 'client-logos', 'accordion',
    'step-process', 'portfolio-grid', 'menu-food', 'service-cards', 'carousel',
    // v2.0 — Industry Blocks
    'menu-display', 'booking-widget', 'class-schedule', 'review-cards',
    'video-showcase', 'doctor-profile', 'property-card', 'product-quick-view',
] as const

export type BlockType = (typeof BLOCK_TYPES)[number]

// ── Base Block Config ────────────────────────────────────────────────────────
export type BaseBlockConfig = {
    blockType: BlockType
    variant?: string
    isVisible?: boolean
    sortOrder?: number
    sectionLabel?: string
}

export const BaseBlockSchema = z.object({
    blockType: z.enum(BLOCK_TYPES),
    variant: z.string().optional(),
    isVisible: z.boolean().default(true),
    sortOrder: z.number().int().min(0).optional(),
    sectionLabel: z.string().optional(),
})

import type { SiteContactInfo, SiteSocialLinks, SiteBranding } from '@/lib/site-settings'
import type { ImageLibraryS3Map } from '@/lib/images/image-library-resolver'

export type SiteData = {
    contactInfo?: SiteContactInfo | null
    socialLinks?: SiteSocialLinks | null
    name?: string | null
    branding?: SiteBranding | null
    imageLibraryS3?: ImageLibraryS3Map // GH-727 Phase 03: seeded S3 URLs keyed by imglib altKey
    [key: string]: unknown
}

// ── Block Component Props ────────────────────────────────────────────────────
export type BlockProps<T extends Record<string, unknown> = Record<string, unknown>> = {
    block: T & BaseBlockConfig
    theme: ThemeConfig
    site?: SiteData | null
    page?: Record<string, unknown> | null
}

// ── Block Metadata (for AI Editor) ───────────────────────────────────────────
export type BlockMeta = {
    type: BlockType
    name: string
    description: string
    icon: string
    variants: string[]
    defaultVariant: string
    editableFields: string[]
    quickActions: string[]
    /**
     * Plan 2253 audit-unused-code — when false, this block is hidden from the
     * AI prompt's block list (buildSystemPrompt's blockList). Users can still
     * add these blocks manually via the editor library UI. Defaults to true.
     * Use for editor-only utility blocks: divider, breadcrumb, announcement-bar,
     * whatsapp-button, cart widgets, etc.
     */
    aiVisible?: boolean
    /**
     * Phase 1 of block-registry-single-source refactor.
     * Canonical category for Studio catalog + user Editor palette grouping.
     * Values: 'basics' | 'content' | 'media' | 'store' | 'commerce' | 'form'
     *       | 'widgets' | 'layout' | 'nav' | 'archive'
     * Phase 2 will swap block-registry-reader to read from here instead of CATEGORY_MAP.
     * Phase 3 will swap BlockLibraryPanel to consume registry instead of hardcode.
     */
    category?: 'basics' | 'content' | 'media' | 'store' | 'commerce' | 'form' | 'widgets' | 'layout' | 'nav' | 'archive'
    /**
     * true for blocks that are auto-placed (navigation, footer) and should NOT
     * appear in the user-facing Editor block palette. Phase 3 consumer.
     */
    isSystem?: boolean
}

// ── CTA Button (shared across blocks) ────────────────────────────────────────
export type CTAButton = {
    label: string
    url: string
    style?: 'primary' | 'secondary' | 'outline' | 'ghost'
}

// Keep enum in sync with Pages.ts hero.ctaButtons.style Payload select options
// (['primary','secondary','outline','ghost']). The previous 3-value enum
// caused AI-generated blocks with `style: 'secondary'` to fail
// blockRegistry.validate() and push invalid data into payload.create
// downstream — observed as staging 500s after the sanitizer emits
// 'secondary' as the default style for the 2nd CTA in hero blocks
// (openai-generator.ts:1023,1032).
export const CTAButtonSchema = z.object({
    label: z.string(),
    url: z.string(),
    style: z.enum(['primary', 'secondary', 'outline', 'ghost']).default('primary'),
})

// ── Image Reference (shared) ─────────────────────────────────────────────────
export type ImageRef = {
    url: string
    alt?: string
    width?: number
    height?: number
}

export const ImageRefSchema = z.object({
    url: z.string(),
    alt: z.string().default(''),
    width: z.number().default(800),
    height: z.number().default(600),
})
