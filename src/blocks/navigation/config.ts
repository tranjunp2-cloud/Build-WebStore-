import { z } from 'zod'
import { BaseBlockSchema, CTAButtonSchema, ImageRefSchema } from '../types'
import type { CTAButton, ImageRef } from '../types'

// ── Navigation Config ────────────────────────────────────────────────────────
export type NavLink = {
    label: string
    url: string
    children?: NavLink[]
}

export type NavigationConfig = {
    blockType: 'navigation'
    variant?: 'simple' | 'centered' | 'mega-menu' | 'transparent' | 'sidebar' | 'pill'
    logoText?: string
    logo?: ImageRef
    links: NavLink[]
    ctaButton?: { show: boolean; label: string; url: string }
    /** Accessible label for screen readers. Defaults to "Main navigation" at render time. */
    ariaLabel?: string
}

const NavLinkSchema: z.ZodType<NavLink> = z.lazy(() =>
    z.object({
        label: z.string(),
        url: z.string(),
        children: z.array(NavLinkSchema).optional(),
    }),
)

export const NavigationConfigSchema = BaseBlockSchema.extend({
    blockType: z.literal('navigation'),
    variant: z.enum(['simple', 'centered', 'mega-menu', 'transparent', 'sidebar', 'pill']).default('simple'),
    logoText: z.string().optional(),
    logo: ImageRefSchema.optional(),
    links: z.array(NavLinkSchema).default([]),
    ctaButton: z.object({
        show: z.boolean(),
        label: z.string(),
        url: z.string(),
    }).optional(),
    ariaLabel: z.string().optional(),
})

export const navigationMeta = {
    type: 'navigation' as const,
    name: 'Navigation',
    description: 'Site navigation bar with logo, links, and optional CTA',
    icon: '🧭',
    variants: ['simple', 'centered', 'mega-menu', 'transparent', 'sidebar', 'pill'],
    defaultVariant: 'simple',
    editableFields: ['logoText', 'links', 'ctaButton'],
    quickActions: ['Add link', 'Change logo', 'Toggle CTA'],
    category: 'nav' as const,
    isSystem: true,
}

/** Canonical configSchema export for block-schema-registry.ts introspection */
export const configSchema = NavigationConfigSchema
