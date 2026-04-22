import { z } from 'zod'
import { BaseBlockSchema } from '../types'

export type TeamMember = { name: string; role: string; image?: { url: string; alt?: string }; bio?: string; socials?: { platform: string; url: string }[] }

export type TeamVariant = 'grid' | 'list' | 'cards-hover-reveal' | 'horizontal-scroll' | 'bio-modal' | 'compact-row'

export const TEAM_VARIANTS: TeamVariant[] = ['grid', 'list', 'cards-hover-reveal', 'horizontal-scroll', 'bio-modal', 'compact-row']

export type TeamConfig = { blockType: 'team'; variant?: TeamVariant; headline?: string; subheadline?: string; members: TeamMember[] }

export const TeamConfigSchema = BaseBlockSchema.extend({
    blockType: z.literal('team'),
    variant: z.enum(['grid', 'list', 'cards-hover-reveal', 'horizontal-scroll', 'bio-modal', 'compact-row']).default('grid'),
    headline: z.string().optional(),
    subheadline: z.string().optional(),
    members: z.array(z.object({
        name: z.string(),
        role: z.string(),
        image: z.object({ url: z.string(), alt: z.string().optional() }).optional(),
        bio: z.string().optional(),
        socials: z.array(z.object({ platform: z.string(), url: z.string() })).optional(),
    })).default([]),
})

export const teamMeta = {
    type: 'team' as const,
    name: 'Team',
    description: 'Team member profiles',
    icon: '👥',
    variants: TEAM_VARIANTS,
    defaultVariant: 'grid' as const,
    editableFields: ['headline', 'members'],
    quickActions: ['Add member', 'Generate bio'],
}
