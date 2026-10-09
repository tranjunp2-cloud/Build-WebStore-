import { z } from 'zod'
import { BaseBlockSchema, ImageRefSchema } from '../types'
import type { BlockMeta } from '../types'
const SafeLink = z.string().refine(value => /^https?:\/\//.test(value) || /^\/(?!\/)/.test(value))
export const ContentCardsConfigSchema = BaseBlockSchema.extend({
    blockType: z.literal('content-cards'),
    variant: z.enum(['categories', 'articles', 'products']),
    headline: z.string(),
    sourceComponentId: z.string().optional(),
    sourceContent: z.object({
        capturedAt: z.string(),
        presentation: z.enum(['source', 'pw2']).optional(),
        bindingStatus: z.literal('captured-public-content'),
        items: z.array(z.object({ sourceId: z.string(), title: z.string(), image: ImageRefSchema.optional(), url: SafeLink.optional(),
            summary: z.string().optional(), date: z.string().optional(), price: z.string().optional(), ctaLabel: z.string().optional() })),
    }),
})
export type ContentCardsConfig = z.infer<typeof ContentCardsConfigSchema>
export const contentCardsMeta: BlockMeta = { type: 'content-cards', name: 'Content Cards', description: 'Source-bound category, article or product cards with explicit captured content.', icon: '▦', variants: ['categories','articles','products'], defaultVariant: 'categories', editableFields: ['headline','sourceContent'], quickActions: [], category: 'content', aiVisible: false }
export const configSchema = ContentCardsConfigSchema
