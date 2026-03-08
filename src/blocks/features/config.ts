import { z } from 'zod'
import { BaseBlockSchema } from '../types'

export type FeatureItem = {
    icon?: string
    title: string
    description: string
}

export type FeaturesConfig = {
    blockType: 'features'
    variant?: 'grid-2' | 'grid-3' | 'grid-4' | 'list'
    headline: string
    subheadline?: string
    sectionLabel?: string
    features: FeatureItem[]
}

export const FeaturesConfigSchema = BaseBlockSchema.extend({
    blockType: z.literal('features'),
    variant: z.enum(['grid-2', 'grid-3', 'grid-4', 'list']).default('grid-3'),
    headline: z.string(),
    subheadline: z.string().optional(),
    features: z.array(z.object({
        icon: z.string().optional(),
        title: z.string(),
        description: z.string(),
    })).default([]),
})

export const featuresMeta = {
    type: 'features' as const,
    name: 'Features',
    description: 'Feature/service grid with icons and descriptions',
    icon: '✨',
    variants: ['grid-2', 'grid-3', 'grid-4', 'list'],
    defaultVariant: 'grid-3',
    editableFields: ['headline', 'subheadline', 'features'],
    quickActions: ['Add feature', 'Rewrite all', 'Change icons'],
}
