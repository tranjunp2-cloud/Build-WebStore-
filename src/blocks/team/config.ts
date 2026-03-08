import { z } from 'zod'
import { BaseBlockSchema } from '../types'

export type TeamMember = { name: string; role: string; avatar?: { url: string; alt?: string }; bio?: string; socials?: { platform: string; url: string }[] }
export type TeamConfig = { blockType: 'team'; variant?: 'grid' | 'list'; headline?: string; subheadline?: string; members: TeamMember[] }
export const TeamConfigSchema = BaseBlockSchema.extend({ blockType: z.literal('team'), variant: z.enum(['grid', 'list']).default('grid'), headline: z.string().optional(), subheadline: z.string().optional(), members: z.array(z.object({ name: z.string(), role: z.string(), avatar: z.object({ url: z.string(), alt: z.string().optional() }).optional(), bio: z.string().optional(), socials: z.array(z.object({ platform: z.string(), url: z.string() })).optional() })).default([]) })
export const teamMeta = { type: 'team' as const, name: 'Team', description: 'Team member profiles', icon: '👥', variants: ['grid', 'list'], defaultVariant: 'grid', editableFields: ['headline', 'members'], quickActions: ['Add member', 'Generate bio'] }
