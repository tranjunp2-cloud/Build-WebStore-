import { z } from 'zod'
import { BaseBlockSchema } from '../types'

export type MenuItem = {
    name: string
    description?: string
    price: string
    currency?: string
    tag?: string
    imageUrl?: string
}

export type MenuCategory = {
    name: string
    items: MenuItem[]
}

export type MenuFoodConfig = {
    blockType: 'menu-food'
    variant?: 'classic' | 'cards' | 'minimal'
    headline: string
    categories: MenuCategory[]
}

export const MenuFoodConfigSchema = BaseBlockSchema.extend({
    blockType: z.literal('menu-food'),
    variant: z.enum(['classic', 'cards', 'minimal']).default('classic'),
    headline: z.string(),
    categories: z.array(z.object({
        name: z.string(),
        items: z.array(z.object({
            name: z.string(),
            description: z.string().optional(),
            price: z.string(),
            currency: z.string().default('RM'),
            tag: z.string().optional(),
            imageUrl: z.string().optional(),
        })).default([]),
    })).default([]),
})

export const menuFoodMeta = {
    type: 'menu-food' as const,
    name: 'Food Menu',
    description: 'Restaurant menu with categories, prices and tags',
    icon: '🍽️',
    variants: ['classic', 'cards', 'minimal'],
    defaultVariant: 'classic',
    editableFields: ['headline', 'categories'],
    quickActions: ['Add category', 'Add item', 'Change prices'],
    // GH-960: re-enable when #961 (cart/checkout) ships
    aiVisible: false,
    // intentionally 'store' not 'archive' — menu-food renders in editor without cart; only hidden from AI generation
    category: 'store' as const,
}

/** Canonical configSchema export for block-schema-registry.ts introspection */
export const configSchema = MenuFoodConfigSchema
