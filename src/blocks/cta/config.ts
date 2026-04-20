import { z } from 'zod'
import { BaseBlockSchema } from '../types'

// ── CTA Block ──
// Plan 260415 Decision 5 — rename `floating` → `card` (old behavior: center card
// with shadow). New `floating-sticky` variant is the REAL fixed bottom-right
// sticky CTA. Migration SQL `UPDATE cta SET variant='card' WHERE variant='floating'`
// lives in scripts/db-setup.js.

export type CTAVariant =
    | 'banner'
    | 'inline'
    | 'card'
    | 'floating-sticky'
    | 'image-bg'
    | 'split-testimonial'
    | 'dark-card'
    | 'mesh-gradient-hero'

export const CTA_VARIANTS: CTAVariant[] = [
    'banner',
    'inline',
    'card',
    'floating-sticky',
    'image-bg',
    'split-testimonial',
    'dark-card',
    'mesh-gradient-hero',
]

export type CTAButton = {
    label: string
    url: string
    style?: 'primary' | 'outline'
}

export type CTAConfig = {
    blockType: 'cta'
    variant?: CTAVariant
    headline: string
    subheadline?: string
    ctaLabel: string
    ctaUrl: string
    ctaStyle?: 'primary' | 'outline'
    /** Optional secondary CTA (Plan 260415 Lỗi 6C) */
    secondaryCtaLabel?: string
    secondaryCtaUrl?: string
}

export const CTAConfigSchema = BaseBlockSchema.extend({
    blockType: z.literal('cta'),
    variant: z.enum(['banner', 'inline', 'card', 'floating-sticky', 'image-bg', 'split-testimonial', 'dark-card', 'mesh-gradient-hero']).default('banner'),
    headline: z.string(),
    subheadline: z.string().optional(),
    ctaLabel: z.string(),
    ctaUrl: z.string(),
    ctaStyle: z.enum(['primary', 'outline']).default('primary'),
    secondaryCtaLabel: z.string().optional(),
    secondaryCtaUrl: z.string().optional(),
})

export const ctaMeta = {
    type: 'cta' as const,
    name: 'CTA',
    description: 'Call to action banner',
    icon: '📣',
    variants: CTA_VARIANTS,
    defaultVariant: 'banner',
    editableFields: ['headline', 'subheadline', 'ctaLabel', 'ctaUrl', 'secondaryCtaLabel', 'secondaryCtaUrl'],
    quickActions: ['Rewrite CTA', 'Make urgent'],
}
