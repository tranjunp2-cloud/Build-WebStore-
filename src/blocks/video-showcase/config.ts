import { z } from 'zod'
import { BaseBlockSchema } from '../types'

export type VideoItem = {
    title: string
    thumbnailUrl?: string
    videoUrl: string
    category?: string
    duration?: string
    description?: string
}

export type VideoShowcaseConfig = {
    blockType: 'video-showcase'
    variant?: 'grid' | 'featured' | 'fullwidth'
    headline: string
    subheadline?: string
    videos: VideoItem[]
    showCategories: boolean
    autoplay: boolean
}

export const VideoShowcaseConfigSchema = BaseBlockSchema.extend({
    blockType: z.literal('video-showcase'),
    variant: z.enum(['grid', 'featured', 'fullwidth']).default('grid'),
    headline: z.string(),
    subheadline: z.string().optional(),
    videos: z.array(z.object({
        title: z.string(),
        thumbnailUrl: z.string().optional(),
        videoUrl: z.string(),
        category: z.string().optional(),
        duration: z.string().optional(),
        description: z.string().optional(),
    })).default([]),
    showCategories: z.boolean().default(true),
    autoplay: z.boolean().default(false),
})

export const videoShowcaseMeta = {
    type: 'video-showcase' as const,
    name: 'Video Showcase',
    description: 'Video portfolio with categories and multiple layouts',
    icon: '\uD83C\uDFAC',
    variants: ['grid', 'featured', 'fullwidth'],
    defaultVariant: 'grid',
    editableFields: ['headline', 'subheadline', 'videos', 'showCategories', 'autoplay'],
    quickActions: ['Add video', 'Filter categories', 'Toggle autoplay'],
    aiVisible: false,
    category: 'archive' as const,
}

/** Canonical configSchema export for block-schema-registry.ts introspection */
export const configSchema = VideoShowcaseConfigSchema
