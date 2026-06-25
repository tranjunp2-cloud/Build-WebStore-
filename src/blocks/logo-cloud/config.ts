import { z } from 'zod'
import { BaseBlockSchema } from '../types'

export type LogoItem = { name: string; logo: { id?: number; url: string; alt?: string } }
export type LogoCloudConfig = { blockType: 'logo-cloud'; variant?: 'row' | 'grid'; headline?: string; logos: LogoItem[] }
// logo.id intentionally absent from Zod schema — Payload stores/strips the relation ID internally; editor carries it transiently
export const LogoCloudConfigSchema = BaseBlockSchema.extend({ blockType: z.literal('logo-cloud'), variant: z.enum(['row', 'grid']).default('row'), headline: z.string().optional(), logos: z.array(z.object({ name: z.string(), logo: z.object({ url: z.string(), alt: z.string().optional() }) })).default([]) })
export const logoCloudMeta = { type: 'logo-cloud' as const, name: 'Logo Cloud', description: 'Partner/client logos display', icon: '🏢', variants: ['row', 'grid'], defaultVariant: 'row', editableFields: ['headline', 'logos'], quickActions: ['Add logo'], category: 'widgets' as const }

/** Canonical configSchema export for block-schema-registry.ts introspection */
export const configSchema = LogoCloudConfigSchema
