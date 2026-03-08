import { z } from 'zod'
import { BaseBlockSchema } from '../types'

export type StatItem = { value: string; label: string; prefix?: string; suffix?: string }
export type StatsConfig = { blockType: 'stats'; variant?: 'row' | 'grid' | 'highlight'; headline?: string; stats: StatItem[] }
export const StatsConfigSchema = BaseBlockSchema.extend({ blockType: z.literal('stats'), variant: z.enum(['row', 'grid', 'highlight']).default('row'), headline: z.string().optional(), stats: z.array(z.object({ value: z.string(), label: z.string(), prefix: z.string().optional(), suffix: z.string().optional() })).default([]) })
export const statsMeta = { type: 'stats' as const, name: 'Stats', description: 'Key metrics and statistics', icon: '📊', variants: ['row', 'grid', 'highlight'], defaultVariant: 'row', editableFields: ['headline', 'stats'], quickActions: ['Add stat', 'Update numbers'] }
