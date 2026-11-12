import { z } from 'zod'
import { BaseBlockSchema } from '../types'

export type CarouselItem = {
    image?: { id?: number; url: string; alt?: string }
    imageUrl?: string  // legacy AI gen compat — prefer image.url
    title?: string
    description?: string
    linkUrl?: string
}

export type CarouselConfig = {
    blockType: 'carousel'
    variant?: 'images' | 'cards' | 'testimonials'
    aspectRatio?: number
    imageFit?: 'cover' | 'contain' | 'scale-down'
    maxImageWidth?: number
    slidesPerView?: number
    headline?: string
    autoplay?: boolean
    interval?: number
    items: CarouselItem[]
}

export const CarouselConfigSchema = BaseBlockSchema.extend({
    blockType: z.literal('carousel'),
    variant: z.enum(['images', 'cards', 'testimonials']).default('images'),
    aspectRatio: z.number().min(0.2).max(10).optional(),
    imageFit: z.enum(['cover','contain','scale-down']).optional(),
    maxImageWidth: z.number().min(1).max(10000).optional(),
    slidesPerView: z.number().int().min(1).max(6).optional(),
    headline: z.string().optional(),
    autoplay: z.boolean().default(true),
    interval: z.number().default(5000),
    items: z.array(z.object({
        image: z.object({ id: z.number().optional(), url: z.string(), alt: z.string().optional() }).optional(),
        imageUrl: z.string().optional(),
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
    editableFields: ['headline', 'autoplay', 'interval', 'aspectRatio', 'imageFit', 'maxImageWidth', 'slidesPerView', 'items'],
    quickActions: ['Add slide', 'Toggle autoplay', 'Change layout'],
    aiVisible: true,
    category: 'media' as const,
}

/** Canonical configSchema export for block-schema-registry.ts introspection */
export const configSchema = CarouselConfigSchema
