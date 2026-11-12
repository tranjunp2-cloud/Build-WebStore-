import { z } from 'zod'
import { BaseBlockSchema, ImageRefSchema } from '../types'

/**
 * Marker kept in a testimonial's `title` (editor-only, never printed): the item is the generated
 * "Be the first to review" invitation, not a customer review (#2103 A1). Renderers show it
 * without stars, name or avatar; replacing the card in the editor clears it.
 */
export const TESTIMONIAL_INVITE_TITLE = 'Invitation (replace with a real review)'

export type TestimonialItem = { quote: string; name: string; title?: string; company?: string; rating?: number; avatar?: { url: string; alt?: string } }
export type TestimonialsConfig = { blockType: 'testimonials'; variant?: 'cards' | 'carousel' | 'simple' | 'masonry' | 'spotlight' | 'minimal-quote' | 'avatar-row' | 'video-text' | 'grid' | 'single'; headline?: string; subheadline?: string; testimonials: TestimonialItem[] }
export const TestimonialsConfigSchema = BaseBlockSchema.extend({
    blockType: z.literal('testimonials'),
    variant: z.enum(['cards', 'carousel', 'simple', 'masonry', 'spotlight', 'minimal-quote', 'avatar-row', 'video-text', 'grid', 'single']).default('cards'),
    headline: z.string().optional(),
    subheadline: z.string().optional(),
    testimonials: z.array(z.object({ quote: z.string(), name: z.string(), title: z.string().optional(), company: z.string().optional(), rating: z.number().min(1).max(5).default(5), avatar: z.object({ url: z.string(), alt: z.string().optional() }).optional() })).default([]),
})
export const testimonialsMeta = { type: 'testimonials' as const, name: 'Testimonials', description: 'Customer reviews and testimonials', icon: '💬', variants: ['cards', 'carousel', 'simple', 'masonry', 'spotlight', 'minimal-quote', 'avatar-row', 'video-text', 'grid', 'single'], defaultVariant: 'cards', editableFields: ['headline', 'testimonials'], quickActions: ['Add testimonial', 'Rewrite quotes'], aiVisible: true, category: 'content' as const }

/** Canonical configSchema export for block-schema-registry.ts introspection */
export const configSchema = TestimonialsConfigSchema
