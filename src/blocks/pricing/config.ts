import { z } from 'zod'
import { BaseBlockSchema, CTAButtonSchema } from '../types'

export type PricingPlan = { name: string; price: string; period?: string; description?: string; features: string[]; ctaLabel: string; ctaUrl: string; highlighted?: boolean }
export type PricingConfig = { blockType: 'pricing'; variant?: 'cards' | 'table'; headline?: string; subheadline?: string; plans: PricingPlan[] }
export const PricingConfigSchema = BaseBlockSchema.extend({
    blockType: z.literal('pricing'), variant: z.enum(['cards', 'table']).default('cards'),
    headline: z.string().optional(), subheadline: z.string().optional(),
    plans: z.array(z.object({ name: z.string(), price: z.string(), period: z.string().optional(), description: z.string().optional(), features: z.array(z.string()), ctaLabel: z.string(), ctaUrl: z.string(), highlighted: z.boolean().default(false) })).default([]),
})
export const pricingMeta = { type: 'pricing' as const, name: 'Pricing', description: 'Pricing plans comparison', icon: '💰', variants: ['cards', 'table'], defaultVariant: 'cards', editableFields: ['headline', 'plans'], quickActions: ['Add plan', 'Change prices'] }
