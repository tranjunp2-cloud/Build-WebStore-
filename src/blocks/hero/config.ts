import { z } from 'zod'
import { BaseBlockSchema, CTAButtonSchema, ImageRefSchema } from '../types'
import type { CTAButton, ImageRef } from '../types'

export const HeroSlideSchema = z.object({
    headline: z.string(),
    subheadline: z.string().optional(),
    image: ImageRefSchema.optional(),
    ctaButtons: z.array(CTAButtonSchema).default([]),
})
export type HeroSlide = z.infer<typeof HeroSlideSchema>

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
    overlayOpacity?: number
    // New optional fields
    videoUrl?: string
    gradientPreset?: 'aurora' | 'sunset' | 'ocean' | 'forest'
    sourceLayout?: { size: 'hero' | 'small'; autoplay: boolean; interval: number; sourceComponentId: string }
    slides?: HeroSlide[]
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
    overlayOpacity: z.number().min(0).max(1).default(0.4),
    videoUrl: z.string().optional(),
    gradientPreset: z.enum(['aurora', 'sunset', 'ocean', 'forest']).optional(),
    images: z.array(ImageRefSchema).optional(),
    slides: z.array(HeroSlideSchema).optional(),
    sourceLayout: z.object({ size: z.enum(['hero','small']), autoplay: z.boolean(), interval: z.number().min(1000).max(30000), sourceComponentId: z.string() }).optional(),
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
