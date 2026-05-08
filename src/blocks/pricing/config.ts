import { z } from 'zod'
import { BaseBlockSchema, CTAButtonSchema } from '../types'

export type PricingFeature = { text: string; included?: boolean }
export type PricingPlan = { name: string; price: string; period?: string; yearlyPrice?: string; description?: string; features: PricingFeature[]; ctaLabel: string; ctaUrl: string; highlighted?: boolean; ctaActionType?: 'external' | 'internal'; ctaStyle?: 'primary' | 'outline' | 'ghost' }
export type PricingFeatureMatrixRow = { featureName: string; values: { included: boolean }[] }
export type PricingConfig = { blockType: 'pricing'; variant?: 'cards' | 'table' | 'horizontal' | 'toggle' | 'tiered' | 'comparison' | 'minimal' | 'slider'; headline?: string; subheadline?: string; plans: PricingPlan[]; yearlyDiscount?: number; billingCycle1?: string; billingCycle2?: string; discountPercent?: number; featureMatrix?: PricingFeatureMatrixRow[] }
export const PricingConfigSchema = BaseBlockSchema.extend({
    blockType: z.literal('pricing'), variant: z.enum(['cards', 'table', 'horizontal', 'toggle', 'tiered', 'comparison', 'minimal', 'slider']).default('cards'),
    headline: z.string().optional(), subheadline: z.string().optional(),
    yearlyDiscount: z.number().optional(),
    billingCycle1: z.string().optional(), billingCycle2: z.string().optional(), discountPercent: z.number().optional(),
    featureMatrix: z.array(z.object({ featureName: z.string(), values: z.array(z.object({ included: z.boolean().default(false) })).default([]) })).optional(),
    plans: z.array(z.object({ name: z.string(), price: z.string(), period: z.string().optional(), yearlyPrice: z.string().optional(), description: z.string().optional(), features: z.array(z.union([z.string().transform(text => ({ text, included: true })), z.object({ text: z.string(), included: z.boolean().default(true) })])), ctaLabel: z.string(), ctaUrl: z.string(), highlighted: z.boolean().default(false), ctaActionType: z.enum(['external', 'internal']).default('external'), ctaStyle: z.enum(['primary', 'outline', 'ghost']).default('primary') })).default([]),
})
export const pricingMeta = { type: 'pricing' as const, name: 'Pricing', description: 'Pricing plans comparison', icon: '💰', variants: ['cards', 'table', 'horizontal', 'toggle', 'tiered', 'comparison', 'minimal', 'slider'], defaultVariant: 'cards', editableFields: ['headline', 'plans'], quickActions: ['Add plan', 'Change prices'], category: 'store' as const }

/** Canonical configSchema export for block-schema-registry.ts introspection */
export const configSchema = PricingConfigSchema
