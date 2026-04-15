import { z } from 'zod'
import { BaseBlockSchema } from '../types'
import type { BlockMeta } from '../types'

export const CustomHtmlConfigSchema = BaseBlockSchema.extend({
    html: z.string().min(1, 'HTML content is required'),
})

export type CustomHtmlConfig = z.infer<typeof CustomHtmlConfigSchema>

export const customHtmlMeta: BlockMeta = {
    type: 'custom-html',
    name: 'Custom HTML',
    description: 'Render custom HTML content safely.',
    icon: '💻',
    variants: ['default'],
    defaultVariant: 'default',
    editableFields: ['html'],
    quickActions: [],
    aiVisible: false,
}
