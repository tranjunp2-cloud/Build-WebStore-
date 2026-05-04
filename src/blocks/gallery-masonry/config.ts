import { z } from 'zod'
import { BaseBlockSchema } from '../types'

export type GalleryMasonryImage = { url: string; alt?: string; caption?: string }
export type GalleryMasonryConfig = { blockType: 'gallery-masonry'; variant?: 'masonry' | 'grid-3' | 'grid-4'; headline?: string; images: GalleryMasonryImage[] }
export const GalleryMasonryConfigSchema = BaseBlockSchema.extend({
    blockType: z.literal('gallery-masonry'), variant: z.enum(['masonry', 'grid-3', 'grid-4']).default('masonry'),
    headline: z.string().optional(),
    images: z.array(z.object({ url: z.string(), alt: z.string().optional(), caption: z.string().optional() })).default([]),
})
export const galleryMasonryMeta = { type: 'gallery-masonry' as const, name: 'Gallery Masonry', description: 'Masonry or grid image gallery with hover overlays', icon: '🖼️', variants: ['masonry', 'grid-3', 'grid-4'], defaultVariant: 'masonry', editableFields: ['headline', 'images'], quickActions: ['Add images', 'Change layout'], aiVisible: true }

/** Canonical configSchema export for block-schema-registry.ts introspection */
export const configSchema = GalleryMasonryConfigSchema
