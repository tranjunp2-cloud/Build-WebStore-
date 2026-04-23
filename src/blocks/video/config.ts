import { z } from 'zod'
import { BaseBlockSchema } from '../types'

export type VideoConfig = { blockType: 'video'; variant?: 'embed' | 'background'; headline?: string; subheadline?: string; videoUrl: string; posterImage?: string }
export const VideoConfigSchema = BaseBlockSchema.extend({ blockType: z.literal('video'), variant: z.enum(['embed', 'background']).default('embed'), headline: z.string().optional(), subheadline: z.string().optional(), videoUrl: z.string(), posterImage: z.string().optional() })
export const videoMeta = { type: 'video' as const, name: 'Video', description: 'Embedded video section', icon: '🎬', variants: ['embed', 'background'], defaultVariant: 'embed', editableFields: ['headline', 'videoUrl'], quickActions: ['Change video'], aiVisible: true, category: 'media' as const }

/** Canonical configSchema export for block-schema-registry.ts introspection */
export const configSchema = VideoConfigSchema
