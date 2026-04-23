import { z } from 'zod'
import { BaseBlockSchema } from '../types'

export type AccordionItem = { title: string; content: string }
export type AccordionConfig = { blockType: 'accordion'; variant?: 'bordered' | 'separated' | 'flush'; headline?: string; description?: string; items: AccordionItem[] }
export const AccordionConfigSchema = BaseBlockSchema.extend({
    blockType: z.literal('accordion'), variant: z.enum(['bordered', 'separated', 'flush']).default('bordered'),
    headline: z.string().optional(), description: z.string().optional(),
    items: z.array(z.object({ title: z.string(), content: z.string() })).default([]),
})
export const accordionMeta = { type: 'accordion' as const, name: 'Accordion', description: 'Expandable content sections', icon: '📂', variants: ['bordered', 'separated', 'flush'], defaultVariant: 'bordered', editableFields: ['headline', 'description', 'items'], quickActions: ['Add item', 'Expand all', 'Rewrite content'], aiVisible: false, category: 'archive' as const }

/** Canonical configSchema export for block-schema-registry.ts introspection */
export const configSchema = AccordionConfigSchema
