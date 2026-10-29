import { z } from 'zod'
import { BaseBlockSchema } from '../types'
import type { BlockMeta } from '../types'

export const ProductsFeaturedConfigSchema = BaseBlockSchema.extend({
    variant: z.enum(['hero-product', 'carousel']).default('hero-product'),
    headline: z.string().optional(),
    subheadline: z.string().optional(),
    // The section's own pictures (a gallery's rows): shown while no product is
    // on sale instead of the industry sample pictures, and for a product
    // without a photo. Products with a photo always show their own photo.
    images: z.array(z.object({ image: z.object({ url: z.string(), alt: z.string().optional() }), caption: z.string().optional() })).optional(),
})

export type ProductsFeaturedConfig = z.infer<typeof ProductsFeaturedConfigSchema>

export const productsFeaturedMeta: BlockMeta = {
    type: 'products-featured',
    name: 'Featured Products',
    description: 'Highlight key products in a hero layout.',
    icon: '⭐',
    variants: ['hero-product', 'carousel'],
    defaultVariant: 'hero-product',
    editableFields: ['headline', 'subheadline', 'images'],
    quickActions: [],
    aiVisible: true,
    category: 'commerce' as const,
}

/** Canonical configSchema export for block-schema-registry.ts introspection */
export const configSchema = ProductsFeaturedConfigSchema
