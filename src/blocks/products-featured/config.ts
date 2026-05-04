import { z } from 'zod'
import { BaseBlockSchema } from '../types'
import type { BlockMeta } from '../types'

export const ProductsFeaturedConfigSchema = BaseBlockSchema.extend({
    variant: z.enum(['hero-product', 'carousel']).default('hero-product'),
    headline: z.string().optional(),
    subheadline: z.string().optional(),
    productIds: z.array(z.string()).optional(),
})

export type ProductsFeaturedConfig = z.infer<typeof ProductsFeaturedConfigSchema>

export const productsFeaturedMeta: BlockMeta = {
    type: 'products-featured',
    name: 'Featured Products',
    description: 'Highlight key products in a hero layout.',
    icon: '⭐',
    variants: ['hero-product', 'carousel'],
    defaultVariant: 'hero-product',
    editableFields: ['headline', 'subheadline'],
    quickActions: [],
    aiVisible: true,
}

/** Canonical configSchema export for block-schema-registry.ts introspection */
export const configSchema = ProductsFeaturedConfigSchema
