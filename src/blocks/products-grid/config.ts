import { z } from 'zod'
import { BaseBlockSchema } from '../types'
import type { BlockMeta } from '../types'

export const PRODUCTS_GRID_LIMIT = {
    default: 6,
    min: 1,
    max: 20,
} as const

export const ProductsGridConfigSchema = BaseBlockSchema.extend({
    variant: z.enum(['grid-3', 'grid-4', 'list']).default('grid-3'),
    headline: z.string().optional(),
    subheadline: z.string().optional(),
    limit: z.number()
        .int()
        .min(PRODUCTS_GRID_LIMIT.min)
        .max(PRODUCTS_GRID_LIMIT.max)
        .default(PRODUCTS_GRID_LIMIT.default),
    category: z.string().optional(),
    selectionMode: z.enum(['all', 'fixed', 'random']).default('all'),
    selectedProductIds: z.array(z.string().regex(/^[1-9]\d*$/)).default([]),
    includeOutOfStock: z.boolean().default(true),
    filterControls: z.object({ category: z.boolean(), price: z.boolean(), search: z.boolean(), attributes: z.boolean() }).optional(),
    showCategoryFilter: z.boolean().default(false),
})

export type ProductsGridConfig = z.infer<typeof ProductsGridConfigSchema>

export const productsGridMeta: BlockMeta = {
    type: 'products-grid',
    name: 'Products Grid',
    description: 'Display products in a responsive grid.',
    icon: '🛍️',
    variants: ['grid-3', 'grid-4', 'list'],
    defaultVariant: 'grid-3',
    editableFields: ['headline', 'subheadline', 'limit', 'category', 'showCategoryFilter'],
    quickActions: ['change-limit'],
    category: 'commerce' as const,
}

/** Canonical configSchema export for block-schema-registry.ts introspection */
export const configSchema = ProductsGridConfigSchema
