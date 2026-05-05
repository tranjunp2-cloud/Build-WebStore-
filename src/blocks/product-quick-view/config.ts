import { z } from 'zod'
import { BaseBlockSchema } from '../types'

export type QuickViewProduct = {
    name: string
    price: number
    originalPrice?: number
    imageUrls: string[]
    description?: string
    variants?: string[]
    badge?: string
    ctaLabel?: string
    ctaUrl?: string
}

export type ProductQuickViewConfig = {
    blockType: 'product-quick-view'
    variant?: 'grid' | 'carousel' | 'minimal'
    headline: string
    subheadline?: string
    products: QuickViewProduct[]
    columns: 2 | 3 | 4
    showQuickView: boolean
    currency: string
}

export const ProductQuickViewConfigSchema = BaseBlockSchema.extend({
    blockType: z.literal('product-quick-view'),
    variant: z.enum(['grid', 'carousel', 'minimal']).default('grid'),
    headline: z.string(),
    subheadline: z.string().optional(),
    products: z.array(z.object({
        name: z.string(),
        price: z.number(),
        originalPrice: z.number().optional(),
        imageUrls: z.array(z.string()).default([]),
        description: z.string().optional(),
        variants: z.array(z.string()).optional(),
        badge: z.string().optional(),
        ctaLabel: z.string().optional(),
        ctaUrl: z.string().optional(),
    })).default([]),
    columns: z.union([z.literal(2), z.literal(3), z.literal(4)]).default(4),
    showQuickView: z.boolean().default(true),
    currency: z.string().default('RM'),
})

export const productQuickViewMeta = {
    type: 'product-quick-view' as const,
    name: 'Product Quick View',
    description: 'E-commerce product grid with quick view and cart actions',
    icon: '\uD83D\uDED2',
    variants: ['grid', 'carousel', 'minimal'],
    defaultVariant: 'grid',
    editableFields: ['headline', 'subheadline', 'products', 'columns', 'showQuickView', 'currency'],
    quickActions: ['Add product', 'Change columns', 'Update prices'],
    aiVisible: false,
    category: 'archive' as const,
}

/** Canonical configSchema export for block-schema-registry.ts introspection */
export const configSchema = ProductQuickViewConfigSchema
