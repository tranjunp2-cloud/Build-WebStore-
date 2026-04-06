import { z } from 'zod'
import { BaseBlockSchema } from '../types'

export type StepItem = {
    title: string
    description: string
    icon?: string
}

export type StepProcessConfig = {
    blockType: 'step-process'
    variant?: 'vertical' | 'horizontal' | 'alternating'
    headline: string
    subheadline?: string
    steps: StepItem[]
}

export const StepProcessConfigSchema = BaseBlockSchema.extend({
    blockType: z.literal('step-process'),
    variant: z.enum(['vertical', 'horizontal', 'alternating']).default('vertical'),
    headline: z.string(),
    subheadline: z.string().optional(),
    steps: z.array(z.object({
        title: z.string(),
        description: z.string(),
        icon: z.string().optional(),
    })).default([]),
})

export const stepProcessMeta = {
    type: 'step-process' as const,
    name: 'Step Process',
    description: 'Numbered step-by-step process with connecting lines',
    icon: '🔢',
    variants: ['vertical', 'horizontal', 'alternating'],
    defaultVariant: 'vertical',
    editableFields: ['headline', 'subheadline', 'steps'],
    quickActions: ['Add step', 'Rewrite steps', 'Change layout'],
}
