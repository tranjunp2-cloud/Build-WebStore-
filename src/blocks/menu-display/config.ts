import { z } from 'zod'
import { BaseBlockSchema } from '../types'

export type DietaryTag = 'halal' | 'vegetarian' | 'vegan' | 'spicy' | 'gluten-free'

export type MenuDisplayItem = {
    name: string
    description?: string
    price: number
    originalPrice?: number
    imageUrl?: string
    dietaryTags: DietaryTag[]
    isPopular?: boolean
    isNew?: boolean
}

export type MenuDisplayCategory = {
    name: string
    description?: string
    icon?: string
    items: MenuDisplayItem[]
}

export type MenuDisplayConfig = {
    blockType: 'menu-display'
    variant?: 'tabs' | 'photo-grid' | 'accordion'
    headline: string
    subheadline?: string
    categories: MenuDisplayCategory[]
    currency: string
    showDietaryIcons: boolean
}

const MenuDisplayItemSchema = z.object({
    name: z.string(),
    description: z.string().optional(),
    price: z.number(),
    originalPrice: z.number().optional(),
    imageUrl: z.string().optional(),
    dietaryTags: z.array(z.enum(['halal', 'vegetarian', 'vegan', 'spicy', 'gluten-free'])).default([]),
    isPopular: z.boolean().optional(),
    isNew: z.boolean().optional(),
})

const MenuDisplayCategorySchema = z.object({
    name: z.string(),
    description: z.string().optional(),
    icon: z.string().optional(),
    items: z.array(MenuDisplayItemSchema).default([]),
})

export const MenuDisplayConfigSchema = BaseBlockSchema.extend({
    blockType: z.literal('menu-display'),
    variant: z.enum(['tabs', 'photo-grid', 'accordion']).default('tabs'),
    headline: z.string(),
    subheadline: z.string().optional(),
    categories: z.array(MenuDisplayCategorySchema).default([]),
    currency: z.string().default('RM'),
    showDietaryIcons: z.boolean().default(true),
})

export const menuDisplayMeta = {
    type: 'menu-display' as const,
    name: 'Menu Display',
    description: 'Enhanced restaurant menu with dietary icons, photos and multiple layouts',
    icon: '\uD83C\uDF7D\uFE0F',
    variants: ['tabs', 'photo-grid', 'accordion'],
    defaultVariant: 'tabs',
    editableFields: ['headline', 'subheadline', 'categories', 'currency', 'showDietaryIcons'],
    quickActions: ['Add category', 'Add item', 'Toggle dietary icons'],
    // GH-960: re-enable when #961 (cart/checkout) ships
    aiVisible: false,
    category: 'archive' as const,
}

/** Canonical configSchema export for block-schema-registry.ts introspection */
export const configSchema = MenuDisplayConfigSchema
