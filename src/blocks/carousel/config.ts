import { z } from 'zod'
import { BaseBlockSchema } from '../types'

export type CarouselItem = {
    imageUrl: string
    title?: string
    description?: string
    linkUrl?: string
}

export type CarouselConfig = {
    blockType: 'carousel'
    variant?: 'images' | 'cards' | 'testimonials'
    headline?: string
    autoplay?: boolean
    interval?: number
    items: CarouselItem[]
}

export const CarouselConfigSchema = BaseBlockSchema.extend({
    blockType: z.literal('carousel'),
    variant: z.enum(['images', 'cards', 'testimonials']).default('images'),
    headline: z.string().optional(),
    autoplay: z.boolean().default(true),
    interval: z.number().default(5000),
    items: z.array(z.object({
        imageUrl: z.string(),
        title: z.string().optional(),
        description: z.string().optional(),
        linkUrl: z.string().optional(),
    })).default([]),
})

export const carouselMeta = {
    type: 'carousel' as const,
    name: 'Carousel',
    description: 'Image, card or testimonial carousel with autoplay',
    icon: '🎠',
    variants: ['images', 'cards', 'testimonials'],
    defaultVariant: 'images',
    editableFields: ['headline', 'autoplay', 'interval', 'items'],
    quickActions: ['Add slide', 'Toggle autoplay', 'Change layout'],
}
