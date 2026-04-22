import { z } from 'zod'
import { BaseBlockSchema } from '../types'

export type CartWidgetConfig = {
    blockType: 'cartWidget'
    variant?: 'floating' | 'inline'
    label?: string
    showLabel?: boolean
}

export const CartWidgetConfigSchema = BaseBlockSchema.extend({
    blockType: z.literal('cartWidget'),
    variant: z.enum(['floating', 'inline']).default('floating'),
    label: z.string().default('Cart'),
    showLabel: z.boolean().default(false),
})

export const cartWidgetMeta = {
    type: 'cartWidget' as const,
    name: 'Cart Button',
    description: 'Shopping cart button with live item count badge',
    icon: '🛒',
    variants: ['floating', 'inline'],
    defaultVariant: 'floating',
    editableFields: ['label', 'showLabel'],
    quickActions: ['Open cart', 'Toggle cart label'],
    aiVisible: false,
}

/** Canonical configSchema export for block-schema-registry.ts introspection */
export const configSchema = CartWidgetConfigSchema
