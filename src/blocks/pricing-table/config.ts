import { z } from 'zod'
import { BaseBlockSchema } from '../types'

export type PricingTablePlan = { name: string; price: string; yearlyPrice?: string; currency?: string; description?: string; features: string[]; cta: { label: string; url: string }; popular?: boolean }
export type PricingTableConfig = { blockType: 'pricing-table'; variant?: 'columns' | 'horizontal'; headline?: string; subheadline?: string; billingToggle?: 'monthly' | 'yearly'; plans: PricingTablePlan[] }
export const PricingTableConfigSchema = BaseBlockSchema.extend({
    blockType: z.literal('pricing-table'), variant: z.enum(['columns', 'horizontal']).default('columns'),
    headline: z.string().optional(), subheadline: z.string().optional(),
    billingToggle: z.enum(['monthly', 'yearly']).default('monthly'),
    plans: z.array(z.object({
        name: z.string(), price: z.string(), yearlyPrice: z.string().optional(), currency: z.string().default('$'),
        description: z.string().optional(), features: z.array(z.string()),
        cta: z.object({ label: z.string(), url: z.string() }), popular: z.boolean().default(false),
    })).default([]),
})
export const pricingTableMeta = { type: 'pricing-table' as const, name: 'Pricing Table', description: 'Pricing plans with monthly/yearly toggle and feature comparison', icon: '💲', variants: ['columns', 'horizontal'], defaultVariant: 'columns', editableFields: ['headline', 'subheadline', 'billingToggle', 'plans'], quickActions: ['Add plan', 'Toggle billing', 'Mark popular'], aiVisible: false }
