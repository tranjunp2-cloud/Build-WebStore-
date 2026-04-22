import { z } from 'zod'
import { BaseBlockSchema } from '../types'

// ── Download CTA Block ──
export type DownloadCTAConfig = { blockType: 'download-cta'; variant?: 'card' | 'banner' | 'minimal'; headline: string; description?: string; fileUrl: string; fileName?: string; fileSize?: string; buttonLabel?: string; requireEmail?: boolean }
export const DownloadCTAConfigSchema = BaseBlockSchema.extend({ blockType: z.literal('download-cta'), variant: z.enum(['card', 'banner', 'minimal']).default('card'), headline: z.string(), description: z.string().optional(), fileUrl: z.string(), fileName: z.string().optional(), fileSize: z.string().optional(), buttonLabel: z.string().default('Download'), requireEmail: z.boolean().default(false) })
export const downloadCTAMeta = { type: 'download-cta' as const, name: 'Download CTA', description: 'File download with optional email capture', icon: '📥', variants: ['card', 'banner', 'minimal'], defaultVariant: 'card', editableFields: ['headline', 'description', 'fileUrl', 'fileName', 'fileSize', 'buttonLabel', 'requireEmail'], quickActions: ['Toggle email gate', 'Change file'], aiVisible: false }

/** Canonical configSchema export for block-schema-registry.ts introspection */
export const configSchema = DownloadCTAConfigSchema
