import { z } from 'zod'
import { BaseBlockSchema } from '../types'
import type { BlockMeta } from '../types'
export const RichTextConfigSchema = BaseBlockSchema.extend({
    blockType: z.literal('rich-text'),
    html: z.string(),
    sourceComponentId: z.string().optional(),
    paddingY: z.number().min(0).max(240).default(64),
})
export type RichTextConfig = z.infer<typeof RichTextConfigSchema>
export const richTextMeta: BlockMeta = { type: 'rich-text', name: 'Rich Text', description: 'Formatted document content with headings, lists, figures and approved video embeds.', icon: '📝', variants: ['default'], defaultVariant: 'default', editableFields: ['html', 'paddingY'], quickActions: [], category: 'content', aiVisible: false }
export const configSchema = RichTextConfigSchema
