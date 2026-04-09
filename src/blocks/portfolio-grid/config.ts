import { z } from 'zod'
import { BaseBlockSchema } from '../types'

export type PortfolioProject = {
    title: string
    description: string
    imageUrl: string
    category: string
    linkUrl?: string
}

export type PortfolioGridConfig = {
    blockType: 'portfolio-grid'
    variant?: 'grid' | 'masonry' | 'showcase'
    headline: string
    subheadline?: string
    projects: PortfolioProject[]
}

export const PortfolioGridConfigSchema = BaseBlockSchema.extend({
    blockType: z.literal('portfolio-grid'),
    variant: z.enum(['grid', 'masonry', 'showcase']).default('grid'),
    headline: z.string(),
    subheadline: z.string().optional(),
    projects: z.array(z.object({
        title: z.string(),
        description: z.string(),
        imageUrl: z.string(),
        category: z.string(),
        linkUrl: z.string().optional(),
    })).default([]),
})

export const portfolioGridMeta = {
    type: 'portfolio-grid' as const,
    name: 'Portfolio Grid',
    description: 'Filterable portfolio grid with hover overlays',
    icon: '🎨',
    variants: ['grid', 'masonry', 'showcase'],
    defaultVariant: 'grid',
    editableFields: ['headline', 'subheadline', 'projects'],
    quickActions: ['Add project', 'Change layout', 'Edit categories'],
}
