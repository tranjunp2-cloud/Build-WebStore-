import { z } from 'zod'
import { BaseBlockSchema, ImageRefSchema } from '../types'

export type FooterColumn = { title: string; links: { label: string; url: string; style?: 'internal' | 'external' }[] }
export type FooterConfig = { blockType: 'footer'; variant?: 'simple' | 'minimal' | 'centered-stack' | 'dark-gradient'; logoText?: string; logo?: { url: string; alt?: string }; tagline?: string; columns: FooterColumn[]; copyrightText?: string; backgroundColor?: string; socials?: { platform: string; url: string }[] }
export const FooterConfigSchema = BaseBlockSchema.extend({
    blockType: z.literal('footer'), variant: z.enum(['simple', 'minimal', 'centered-stack', 'dark-gradient']).default('simple'),
    logoText: z.string().optional(), logo: z.object({ url: z.string(), alt: z.string().optional() }).optional(),
    tagline: z.string().optional(), columns: z.array(z.object({ title: z.string(), links: z.array(z.object({ label: z.string(), url: z.string(), style: z.enum(['internal', 'external']).optional() })) })).default([]),
    copyrightText: z.string().optional(), backgroundColor: z.string().optional(), socials: z.array(z.object({ platform: z.string(), url: z.string() })).optional(),
})
export const footerMeta = { type: 'footer' as const, name: 'Footer', description: 'Site footer with links, social media, and copyright', icon: '🔻', variants: ['simple', 'minimal', 'centered-stack', 'dark-gradient'], defaultVariant: 'simple', editableFields: ['logoText', 'tagline', 'columns', 'copyrightText', 'socials'], quickActions: ['Add column', 'Add social links'], category: 'nav' as const, isSystem: true }

/** Canonical configSchema export for block-schema-registry.ts introspection */
export const configSchema = FooterConfigSchema
