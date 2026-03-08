import { z } from 'zod'
import { BaseBlockSchema, CTAButtonSchema, ImageRefSchema } from '../types'
import type { CTAButton, ImageRef } from '../types'

// ── Navigation Config ────────────────────────────────────────────────────────
export type NavigationConfig = {
    blockType: 'navigation'
    variant?: 'simple' | 'centered' | 'mega-menu'
    logoText?: string
    logo?: ImageRef
    links: { label: string; url: string }[]
    ctaButton?: { show: boolean; label: string; url: string }
}

export const NavigationConfigSchema = BaseBlockSchema.extend({
    blockType: z.literal('navigation'),
    variant: z.enum(['simple', 'centered', 'mega-menu']).default('simple'),
    logoText: z.string().optional(),
    logo: ImageRefSchema.optional(),
    links: z.array(z.object({ label: z.string(), url: z.string() })).default([]),
    ctaButton: z.object({
        show: z.boolean(),
        label: z.string(),
        url: z.string(),
    }).optional(),
})

export const navigationMeta = {
    type: 'navigation' as const,
    name: 'Navigation',
    description: 'Site navigation bar with logo, links, and optional CTA',
    icon: '🧭',
    variants: ['simple', 'centered', 'mega-menu'],
    defaultVariant: 'simple',
    editableFields: ['logoText', 'links', 'ctaButton'],
    quickActions: ['Add link', 'Change logo', 'Toggle CTA'],
}
