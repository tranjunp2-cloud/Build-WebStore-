import { z } from 'zod'
import { BaseBlockSchema } from '../types'

// ── Before / After Block ──
export type BeforeAfterImage = { url: string; alt?: string; label?: string }
export type BeforeAfterConfig = { blockType: 'before-after'; variant?: 'slider' | 'side-by-side'; headline?: string; beforeImage: BeforeAfterImage; afterImage: BeforeAfterImage }
export const BeforeAfterConfigSchema = BaseBlockSchema.extend({ blockType: z.literal('before-after'), variant: z.enum(['slider', 'side-by-side']).default('slider'), headline: z.string().optional(), beforeImage: z.object({ url: z.string(), alt: z.string().optional(), label: z.string().optional() }), afterImage: z.object({ url: z.string(), alt: z.string().optional(), label: z.string().optional() }) })
export const beforeAfterMeta = { type: 'before-after' as const, name: 'Before / After', description: 'Compare two images with slider or side-by-side', icon: '🔀', variants: ['slider', 'side-by-side'], defaultVariant: 'slider', editableFields: ['headline', 'beforeImage', 'afterImage'], quickActions: ['Swap images'] }

/** Canonical configSchema export for block-schema-registry.ts introspection */
export const configSchema = BeforeAfterConfigSchema
