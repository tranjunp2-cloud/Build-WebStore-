import { z } from 'zod'
import { BaseBlockSchema } from '../types'

export type AnnouncementBarConfig = { blockType: 'announcement-bar'; variant?: 'gradient' | 'solid' | 'minimal'; message: string; linkText?: string; linkUrl?: string; dismissible?: boolean; backgroundColor?: string }
export const AnnouncementBarConfigSchema = BaseBlockSchema.extend({
    blockType: z.literal('announcement-bar'), variant: z.enum(['gradient', 'solid', 'minimal']).default('gradient'),
    message: z.string(), linkText: z.string().optional(), linkUrl: z.string().optional(),
    dismissible: z.boolean().default(true), backgroundColor: z.string().optional(),
})
export const announcementBarMeta = { type: 'announcement-bar' as const, name: 'Announcement Bar', description: 'Top banner for promotions and announcements', icon: '📢', variants: ['gradient', 'solid', 'minimal'], defaultVariant: 'gradient', editableFields: ['message', 'linkText', 'linkUrl', 'dismissible'], quickActions: ['Edit message', 'Add link', 'Toggle dismiss'], aiVisible: false }
