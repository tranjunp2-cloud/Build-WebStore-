import { z } from 'zod'
import { BaseBlockSchema } from '../types'

export type FAQItem = { question: string; answer: string }
export type FAQConfig = { blockType: 'faq'; variant?: 'accordion' | 'grid' | 'simple'; headline?: string; subheadline?: string; items: FAQItem[] }
export const FAQConfigSchema = BaseBlockSchema.extend({
    blockType: z.literal('faq'), variant: z.enum(['accordion', 'grid', 'simple']).default('accordion'),
    headline: z.string().optional(), subheadline: z.string().optional(),
    items: z.array(z.object({ question: z.string(), answer: z.string() })).default([]),
})
export const faqMeta = { type: 'faq' as const, name: 'FAQ', description: 'Frequently asked questions section', icon: '❓', variants: ['accordion', 'grid', 'simple'], defaultVariant: 'accordion', editableFields: ['headline', 'items'], quickActions: ['Add question', 'Rewrite answers', 'Generate FAQ'] }
