import { z } from 'zod'

// ── Theme Configuration ─────────────────────────────────────────────────────
export type ThemeConfig = {
    primaryColor: string
    secondaryColor: string
    backgroundColor: string
    fontHeading: string
    fontBody: string
    colorMode: 'light' | 'dark'
}

export const ThemeConfigSchema = z.object({
    primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default('#0ea5e9'),
    secondaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default('#d946ef'),
    backgroundColor: z.string().default('#09090b'),
    fontHeading: z.string().default('Outfit'),
    fontBody: z.string().default('Inter'),
    colorMode: z.enum(['light', 'dark']).default('dark'),
})

// ── Block Types Enum ─────────────────────────────────────────────────────────
export const BLOCK_TYPES = [
    'navigation', 'hero', 'about', 'features', 'testimonials',
    'contact', 'gallery', 'footer', 'faq', 'pricing',
    'cta', 'stats', 'team', 'newsletter',
    'products-grid', 'products-featured',
    'video', 'logo-cloud', 'blog-list', 'custom-html',
    'socialWidget', 'cartWidget',
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

// ── Block Component Props ────────────────────────────────────────────────────
export type BlockProps<T extends Record<string, unknown> = Record<string, unknown>> = {
    block: T & BaseBlockConfig
    theme: ThemeConfig
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
}

// ── CTA Button (shared across blocks) ────────────────────────────────────────
export type CTAButton = {
    label: string
    url: string
    style?: 'primary' | 'outline' | 'ghost'
}

export const CTAButtonSchema = z.object({
    label: z.string(),
    url: z.string(),
    style: z.enum(['primary', 'outline', 'ghost']).default('primary'),
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
    alt: z.string().optional(),
    width: z.number().optional(),
    height: z.number().optional(),
})
