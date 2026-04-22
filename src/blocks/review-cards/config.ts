import { z } from 'zod'
import { BaseBlockSchema } from '../types'

export type ReviewItem = {
    name: string
    rating: number
    text: string
    date?: string
    avatar?: string
    source?: string
    verified?: boolean
}

export type ReviewCardsConfig = {
    blockType: 'review-cards'
    variant?: 'grid' | 'carousel' | 'masonry'
    headline: string
    subheadline?: string
    reviews: ReviewItem[]
    showAverage: boolean
    totalReviewCount?: number
}

export const ReviewCardsConfigSchema = BaseBlockSchema.extend({
    blockType: z.literal('review-cards'),
    variant: z.enum(['grid', 'carousel', 'masonry']).default('grid'),
    headline: z.string(),
    subheadline: z.string().optional(),
    reviews: z.array(z.object({
        name: z.string(),
        rating: z.number().min(1).max(5),
        text: z.string(),
        date: z.string().optional(),
        avatar: z.string().optional(),
        source: z.string().optional(),
        verified: z.boolean().optional(),
    })).default([]),
    showAverage: z.boolean().default(true),
    totalReviewCount: z.number().optional(),
})

export const reviewCardsMeta = {
    type: 'review-cards' as const,
    name: 'Review Cards',
    description: 'Customer reviews with star ratings and average score',
    icon: '\u2B50',
    variants: ['grid', 'carousel', 'masonry'],
    defaultVariant: 'grid',
    editableFields: ['headline', 'subheadline', 'reviews', 'showAverage', 'totalReviewCount'],
    quickActions: ['Add review', 'Sort by rating', 'Toggle average'],
}

/** Canonical configSchema export for block-schema-registry.ts introspection */
export const configSchema = ReviewCardsConfigSchema
