import { z } from 'zod'
import { BaseBlockSchema } from '../types'

export type SocialProofReview = { author: string; role?: string; content: string; rating: number; avatar?: { url: string; alt?: string } }
export type SocialProofConfig = { blockType: 'social-proof'; variant?: 'cards' | 'minimal' | 'grid'; headline?: string; reviews: SocialProofReview[] }
export const SocialProofConfigSchema = BaseBlockSchema.extend({
    blockType: z.literal('social-proof'), variant: z.enum(['cards', 'minimal', 'grid']).default('cards'),
    headline: z.string().optional(),
    reviews: z.array(z.object({
        author: z.string(), role: z.string().optional(), content: z.string(),
        rating: z.number().min(1).max(5).default(5), avatar: z.object({ url: z.string(), alt: z.string().optional() }).optional(),
    })).default([]),
})
export const socialProofMeta = { type: 'social-proof' as const, name: 'Social Proof', description: 'Customer reviews with star ratings and avatars', icon: '⭐', variants: ['cards', 'minimal', 'grid'], defaultVariant: 'cards', editableFields: ['headline', 'reviews'], quickActions: ['Add review', 'Change layout'], aiVisible: true }

/** Canonical configSchema export for block-schema-registry.ts introspection */
export const configSchema = SocialProofConfigSchema
