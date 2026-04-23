import { z } from 'zod'
import { BaseBlockSchema, CTAButtonSchema, ImageRefSchema } from '../types'
import type { CTAButton, ImageRef } from '../types'

// ── Hero Config ──────────────────────────────────────────────────────────────
export type HeroConfig = {
    blockType: 'hero'
    variant?: 'centered' | 'split-left' | 'split-right' | 'fullscreen' | 'video'
        | 'magazine' | 'minimal' | 'cards-overlay' | 'gradient' | 'parallax' | 'slideshow' | 'split-video'
    headline: string
    subheadline?: string
    ctaButtons?: CTAButton[]
    image?: ImageRef
    badge?: { show: boolean; text: string }
    overlay?: boolean
    overlayOpacity?: number
    height?: string
    // New optional fields
    videoUrl?: string
    gradientPreset?: 'aurora' | 'sunset' | 'ocean' | 'forest'
    images?: ImageRef[]
}

export const HeroConfigSchema = BaseBlockSchema.extend({
    blockType: z.literal('hero'),
    variant: z.enum([
        'centered', 'split-left', 'split-right', 'fullscreen', 'video',
        'magazine', 'minimal', 'cards-overlay', 'gradient', 'parallax', 'slideshow', 'split-video',
    ]).default('centered'),
    headline: z.string(),
    subheadline: z.string().optional(),
    ctaButtons: z.array(CTAButtonSchema).default([]),
    image: ImageRefSchema.optional(),
    badge: z.object({ show: z.boolean(), text: z.string() }).optional(),
    overlay: z.boolean().default(false),
    overlayOpacity: z.number().min(0).max(1).default(0.4),
    height: z.string().default('90vh'),
    videoUrl: z.string().optional(),
    gradientPreset: z.enum(['aurora', 'sunset', 'ocean', 'forest']).optional(),
    images: z.array(ImageRefSchema).optional(),
})

export const heroMeta = {
    type: 'hero' as const,
    name: 'Hero',
    description: 'Main hero/banner section with headline, CTA, and optional image',
    icon: '🏔️',
    variants: [
        'centered', 'split-left', 'split-right', 'fullscreen', 'video',
        'magazine', 'minimal', 'cards-overlay', 'gradient', 'parallax', 'slideshow', 'split-video',
    ],
    defaultVariant: 'centered',
    editableFields: ['headline', 'subheadline', 'ctaButtons', 'image', 'badge', 'videoUrl', 'gradientPreset', 'images'],
    quickActions: ['Rewrite headline', 'Change CTA', 'Change style'],
    category: 'basics' as const,
}

/** Canonical configSchema export for block-schema-registry.ts introspection */
export const configSchema = HeroConfigSchema
