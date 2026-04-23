import { z } from 'zod'
import { BaseBlockSchema, ImageRefSchema } from '../types'
import type { ImageRef } from '../types'

export type TimelineItem = {
    year: string
    title: string
    description?: string
    icon?: string
}

export type AboutVariant =
    | 'simple'
    | 'split'
    | 'story'
    | 'two-column'
    | 'founder-quote'
    | 'centered-large'
    | 'image-overlay'

export const ABOUT_VARIANTS: AboutVariant[] = [
    'simple',
    'split',
    'story',
    'two-column',
    'founder-quote',
    'centered-large',
    'image-overlay',
]

export type AboutConfig = {
    blockType: 'about'
    variant?: AboutVariant
    headline: string
    sectionLabel?: string
    body?: string
    image?: ImageRef
    layout?: 'image-right' | 'image-left' | 'centered'
    timelineItems?: TimelineItem[]
}

export const AboutConfigSchema = BaseBlockSchema.extend({
    blockType: z.literal('about'),
    variant: z.enum(['simple', 'split', 'story', 'two-column', 'founder-quote', 'centered-large', 'image-overlay']).default('simple'),
    headline: z.string(),
    body: z.string().optional(),
    image: ImageRefSchema.optional(),
    layout: z.enum(['image-right', 'image-left', 'centered']).default('image-right'),
    timelineItems: z.array(z.object({
        year: z.string(),
        title: z.string(),
        description: z.string().optional(),
        icon: z.string().optional(),
    })).optional(),
})

export const aboutMeta = {
    type: 'about' as const,
    name: 'About',
    description: 'About us section with text and optional image',
    icon: '📖',
    variants: ABOUT_VARIANTS,
    defaultVariant: 'simple' as const,
    editableFields: ['headline', 'body', 'image'],
    quickActions: ['Rewrite professional', 'Shorten', 'Add story'],
    category: 'basics' as const,
}

/** Canonical configSchema export for block-schema-registry.ts introspection */
export const configSchema = AboutConfigSchema
