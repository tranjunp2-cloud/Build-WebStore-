import { z } from 'zod'
import { BaseBlockSchema } from '../types'
import type { BlockMeta } from '../types'

export const ProductsGridConfigSchema = BaseBlockSchema.extend({
    headline: z.string().optional(),
    subheadline: z.string().optional(),
    limit: z.number().int().min(1).max(20).default(6),
    category: z.string().optional(),
})

export type ProductsGridConfig = z.infer<typeof ProductsGridConfigSchema>

export const productsGridMeta: BlockMeta = {
    type: 'products-grid',
    name: 'Products Grid',
    description: 'Display products in a responsive grid.',
    icon: '🛍️',
    variants: ['grid-3', 'grid-4', 'list'],
    defaultVariant: 'grid-3',
    editableFields: ['headline', 'subheadline', 'limit', 'category'],
    quickActions: ['change-limit'],
}
