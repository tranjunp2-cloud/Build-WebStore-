import { z } from 'zod'
import { BaseBlockSchema } from '../types'

export type GoogleMapsConfig = { blockType: 'google-maps'; variant?: 'full-width' | 'card'; embedUrl?: string; headline?: string; address?: string; height?: number }
export const GoogleMapsConfigSchema = BaseBlockSchema.extend({
    blockType: z.literal('google-maps'), variant: z.enum(['full-width', 'card']).default('full-width'),
    embedUrl: z.string().default(''), headline: z.string().optional(), address: z.string().optional(),
    height: z.number().default(400),
})
export const googleMapsMeta = { type: 'google-maps' as const, name: 'Google Maps', description: 'Embedded Google Maps with optional address card', icon: '📍', variants: ['full-width', 'card'], defaultVariant: 'full-width', editableFields: ['embedUrl', 'headline', 'address', 'height'], quickActions: ['Change height', 'Edit address'], aiVisible: false }

/** Canonical configSchema export for block-schema-registry.ts introspection */
export const configSchema = GoogleMapsConfigSchema
