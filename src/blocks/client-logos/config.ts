import { z } from 'zod'
import { BaseBlockSchema } from '../types'

export type LogoItem = { url: string; alt: string; linkUrl?: string }
export type ClientLogosConfig = { blockType: 'client-logos'; variant?: 'scroll' | 'grid' | 'fade'; headline?: string; logos: LogoItem[] }
export const ClientLogosConfigSchema = BaseBlockSchema.extend({
    blockType: z.literal('client-logos'), variant: z.enum(['scroll', 'grid', 'fade']).default('scroll'),
    headline: z.string().optional(),
    logos: z.array(z.object({ url: z.string(), alt: z.string(), linkUrl: z.string().optional() })).default([]),
})
export const clientLogosMeta = { type: 'client-logos' as const, name: 'Client Logos', description: 'Showcase partner and client brand logos', icon: '🏢', variants: ['scroll', 'grid', 'fade'], defaultVariant: 'scroll', editableFields: ['headline', 'logos'], quickActions: ['Add logo', 'Change layout'], aiVisible: false }

/** Canonical configSchema export for block-schema-registry.ts introspection */
export const configSchema = ClientLogosConfigSchema
