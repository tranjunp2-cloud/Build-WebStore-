import { z } from 'zod'
import { BaseBlockSchema } from '../types'

export type StatItem = { value: string; label: string; prefix?: string; suffix?: string }

export type StatsVariant = 'row' | 'grid' | 'highlight' | 'cards' | 'inline-text' | 'chart-bars'

export const STATS_VARIANTS: StatsVariant[] = ['row', 'grid', 'highlight', 'cards', 'inline-text', 'chart-bars']

export type StatsConfig = {
    blockType: 'stats'
    variant?: StatsVariant
    headline?: string
    stats: StatItem[]
}

export const StatsConfigSchema = BaseBlockSchema.extend({
    blockType: z.literal('stats'),
    variant: z.enum(['row', 'grid', 'highlight', 'cards', 'inline-text', 'chart-bars']).default('row'),
    headline: z.string().optional(),
    stats: z.array(z.object({
        value: z.string(),
        label: z.string(),
        prefix: z.string().optional(),
        suffix: z.string().optional(),
    })).default([]),
})

export const statsMeta = {
    type: 'stats' as const,
    name: 'Stats',
    description: 'Key metrics and statistics',
    icon: '📊',
    variants: STATS_VARIANTS,
    defaultVariant: 'row' as const,
    editableFields: ['headline', 'stats'],
    quickActions: ['Add stat', 'Update numbers'],
}

/** Canonical configSchema export for block-schema-registry.ts introspection */
export const configSchema = StatsConfigSchema
