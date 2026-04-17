import { z } from 'zod'
import { BaseBlockSchema } from '../types'

// Plan 260415 Lỗi I — allowMultiple field để user mở nhiều items đồng thời.
// Default false để backward compat với single-expand behavior cũ.
export type FAQItem = { question: string; answer: string }
export type FAQConfig = {
    blockType: 'faq'
    variant?: 'accordion' | 'grid' | 'simple'
    headline?: string
    subheadline?: string
    items: FAQItem[]
    allowMultiple?: boolean
}
export const FAQConfigSchema = BaseBlockSchema.extend({
    blockType: z.literal('faq'),
    variant: z.enum(['accordion', 'grid', 'simple']).default('accordion'),
    headline: z.string().optional(),
    subheadline: z.string().optional(),
    items: z.array(z.object({ question: z.string(), answer: z.string() })).default([]),
    allowMultiple: z.boolean().default(false),
})
export const faqMeta = {
    type: 'faq' as const,
    name: 'FAQ',
    description: 'Frequently asked questions section',
    icon: '❓',
    variants: ['accordion', 'grid', 'simple'],
    defaultVariant: 'accordion',
    editableFields: ['headline', 'items', 'allowMultiple'],
    quickActions: ['Add question', 'Rewrite answers', 'Generate FAQ'],
}
