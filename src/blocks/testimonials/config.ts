import { z } from 'zod'
import { BaseBlockSchema, ImageRefSchema } from '../types'

export type TestimonialItem = { quote: string; name: string; title?: string; company?: string; rating?: number; avatar?: { url: string; alt?: string } }
export type TestimonialsConfig = { blockType: 'testimonials'; variant?: 'cards' | 'carousel' | 'simple'; headline?: string; testimonials: TestimonialItem[] }
export const TestimonialsConfigSchema = BaseBlockSchema.extend({
    blockType: z.literal('testimonials'),
    variant: z.enum(['cards', 'carousel', 'simple']).default('cards'),
    headline: z.string().optional(),
    testimonials: z.array(z.object({ quote: z.string(), name: z.string(), title: z.string().optional(), company: z.string().optional(), rating: z.number().min(1).max(5).default(5), avatar: z.object({ url: z.string(), alt: z.string().optional() }).optional() })).default([]),
})
export const testimonialsMeta = { type: 'testimonials' as const, name: 'Testimonials', description: 'Customer reviews and testimonials', icon: '💬', variants: ['cards', 'carousel', 'simple'], defaultVariant: 'cards', editableFields: ['headline', 'testimonials'], quickActions: ['Add testimonial', 'Rewrite quotes'] }
