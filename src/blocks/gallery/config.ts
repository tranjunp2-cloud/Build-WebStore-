import { z } from 'zod'
import { BaseBlockSchema, ImageRefSchema } from '../types'

export type GalleryConfig = { blockType: 'gallery'; variant?: 'grid' | 'masonry' | 'carousel' | 'lightbox' | 'filmstrip' | 'justified'; headline?: string; images: { image: { url: string; alt?: string }; caption?: string }[] }
export const GalleryConfigSchema = BaseBlockSchema.extend({
    blockType: z.literal('gallery'), variant: z.enum(['grid', 'masonry', 'carousel', 'lightbox', 'filmstrip', 'justified']).default('grid'),
    headline: z.string().optional(),
    images: z.array(z.object({ image: z.object({ url: z.string(), alt: z.string().optional() }), caption: z.string().optional() })).default([]),
})
export const galleryMeta = { type: 'gallery' as const, name: 'Gallery', description: 'Image gallery with grid, masonry, or carousel layout', icon: '🖼️', variants: ['grid', 'masonry', 'carousel', 'lightbox', 'filmstrip', 'justified'], defaultVariant: 'grid', editableFields: ['headline', 'images'], quickActions: ['Add images', 'Change layout'] }

/** Canonical configSchema export for block-schema-registry.ts introspection */
export const configSchema = GalleryConfigSchema
