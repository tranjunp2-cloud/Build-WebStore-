import { z } from 'zod'
import { BaseBlockSchema } from '../types'

export type DividerConfig = { blockType: 'divider'; variant?: 'line' | 'dots' | 'wave' | 'spacer'; height?: number; color?: string }
export const DividerConfigSchema = BaseBlockSchema.extend({
    blockType: z.literal('divider'), variant: z.enum(['line', 'dots', 'wave', 'spacer']).default('line'),
    height: z.number().default(40), color: z.string().optional(),
})
export const dividerMeta = { type: 'divider' as const, name: 'Divider', description: 'Visual separator between sections', icon: '➖', variants: ['line', 'dots', 'wave', 'spacer'], defaultVariant: 'line', editableFields: ['height', 'color'], quickActions: ['Change style'], aiVisible: true }

/** Canonical configSchema export for block-schema-registry.ts introspection */
export const configSchema = DividerConfigSchema
