import { z } from 'zod'
import { BaseBlockSchema } from '../types'

export type AnnouncementBarConfig = { blockType: 'announcement-bar'; variant?: 'gradient' | 'solid' | 'minimal'; message: string; linkText?: string; linkUrl?: string; linkIsInternal?: boolean; dismissible?: boolean; backgroundColor?: string; backgroundColor2?: string; textColor?: string; paddingY?: number }
export const AnnouncementBarConfigSchema = BaseBlockSchema.extend({
    blockType: z.literal('announcement-bar'), variant: z.enum(['gradient', 'solid', 'minimal']).default('gradient'),
    message: z.string(), linkText: z.string().optional(), linkUrl: z.string().optional(),
    linkIsInternal: z.boolean().optional(),
    dismissible: z.boolean().default(true), backgroundColor: z.string().optional(),
    backgroundColor2: z.string().optional(),
    textColor: z.string().optional(),
    paddingY: z.number().int().min(4).max(32).optional(),
})
export const announcementBarMeta = { type: 'announcement-bar' as const, name: 'Announcement', description: 'Top banner for promotions and announcements', icon: '📢', variants: ['gradient', 'solid', 'minimal'], defaultVariant: 'gradient', editableFields: ['message', 'linkText', 'linkUrl', 'dismissible', 'backgroundColor', 'backgroundColor2', 'textColor', 'paddingY'], quickActions: ['Edit message', 'Add link', 'Toggle dismiss'], aiVisible: true, category: 'layout' as const }

/** Canonical configSchema export for block-schema-registry.ts introspection */
export const configSchema = AnnouncementBarConfigSchema
