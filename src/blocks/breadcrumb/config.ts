import { z } from 'zod'
import { BaseBlockSchema } from '../types'

export type BreadcrumbItem = { label: string; url?: string }
export type BreadcrumbConfig = {
    blockType: 'breadcrumb'
    variant?: 'simple' | 'with-icon'
    items: BreadcrumbItem[]
    homeLabel?: string
    separator?: string
    showIcon?: boolean
    showOnAllPages?: boolean
}
export const BreadcrumbConfigSchema = BaseBlockSchema.extend({
    blockType: z.literal('breadcrumb'),
    variant: z.enum(['simple', 'with-icon']).default('simple'),
    items: z.array(z.object({ label: z.string(), url: z.string().optional() })).default([]),
    homeLabel: z.string().default('Home'),
    separator: z.string().default('/'),
    showIcon: z.boolean().default(false),
    showOnAllPages: z.boolean().default(true),
})
export const breadcrumbMeta = { type: 'breadcrumb' as const, name: 'Breadcrumb', description: 'Navigation breadcrumb trail', icon: '🧭', variants: ['simple', 'with-icon'], defaultVariant: 'simple', editableFields: ['items', 'homeLabel', 'separator', 'showIcon', 'showOnAllPages'], quickActions: ['Reset path'], aiVisible: false }

/** Canonical configSchema export for block-schema-registry.ts introspection */
export const configSchema = BreadcrumbConfigSchema
