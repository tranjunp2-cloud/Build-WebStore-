import { z } from 'zod'
import { BaseBlockSchema, ImageRefSchema } from '../types'
import type { ImageRef } from '../types'

export type AboutConfig = {
    blockType: 'about'
    variant?: 'simple' | 'split' | 'story'
    headline: string
    sectionLabel?: string
    body?: string
    image?: ImageRef
    layout?: 'image-right' | 'image-left' | 'centered'
}

export const AboutConfigSchema = BaseBlockSchema.extend({
    blockType: z.literal('about'),
    variant: z.enum(['simple', 'split', 'story']).default('simple'),
    headline: z.string(),
    body: z.string().optional(),
    image: ImageRefSchema.optional(),
    layout: z.enum(['image-right', 'image-left', 'centered']).default('image-right'),
})

export const aboutMeta = {
    type: 'about' as const,
    name: 'About',
    description: 'About us section with text and optional image',
    icon: '📖',
    variants: ['simple', 'split', 'story'],
    defaultVariant: 'simple',
    editableFields: ['headline', 'body', 'image'],
    quickActions: ['Rewrite professional', 'Shorten', 'Add story'],
}
