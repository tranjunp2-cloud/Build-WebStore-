import { z } from 'zod'
import { BaseBlockSchema, CTAButtonSchema, ImageRefSchema } from '../types'
import type { CTAButton, ImageRef } from '../types'

// ── Navigation Config ────────────────────────────────────────────────────────
export type NavLink = {
    label: string
    url: string
    children?: NavLink[]
    /** Runtime-only: injected by SiteRenderer in editor/preview to flag links hidden from visitors */
    _hiddenFromVisitor?: boolean
}

export type NavigationConfig = {
    blockType: 'navigation'
    variant?: 'default' | 'centered' | 'mega' | 'transparent' | 'sidebar' | 'floating'
    logoText?: string
    logo?: ImageRef
    links: NavLink[]
    ctaButton?: { show: boolean; label: string; url: string }
    /** Accessible label for screen readers. Defaults to "Main navigation" at render time. */
    ariaLabel?: string
    /** F26-07: Header switcher render gate — true only when site has ≥2 languages. */
    showLanguageSwitcher?: boolean
    /** F26: Multilingual feature enabled (Quick Language panel visible). Independent
     *  from showLanguageSwitcher, which only turns on once a 2nd language is added. */
    multilingualEnabled?: boolean
    /** F26: Persisted language pair — single source of truth for the panel + header switcher.
     *  primaryLocale defaults to the site's generationLocale; secondaryLocale is the [Add]ed
     *  2nd language. The visitor switcher renders exactly [primaryLocale, secondaryLocale]. */
    primaryLocale?: string
    secondaryLocale?: string
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
    variant: z.enum(['default', 'centered', 'mega', 'transparent', 'sidebar', 'floating']).default('default'),
    logoText: z.string().optional(),
    logo: ImageRefSchema.optional(),
    links: z.array(NavLinkSchema).default([]),
    ctaButton: z.object({
        show: z.boolean(),
        label: z.string(),
        url: z.string(),
    }).optional(),
    ariaLabel: z.string().optional(),
    showLanguageSwitcher: z.boolean().optional(),
    multilingualEnabled: z.boolean().optional(),
    primaryLocale: z.string().max(10).optional(),
    secondaryLocale: z.string().max(10).optional(),
})

export const navigationMeta = {
    type: 'navigation' as const,
    name: 'Navigation',
    description: 'Site navigation bar with logo, links, and optional CTA',
    icon: '🧭',
    variants: ['default', 'centered', 'transparent', 'sidebar', 'floating'],
    defaultVariant: 'default',
    editableFields: ['logoText', 'links', 'ctaButton'],
    quickActions: ['Add link', 'Change logo', 'Toggle CTA'],
    category: 'nav' as const,
    isSystem: true,
    scope: 'global' as const,
    scopeTooltip: 'Thanh điều hướng tự động cho toàn bộ site. Cấu hình 1 lần trong cài đặt site.',
}

/** Canonical configSchema export for block-schema-registry.ts introspection */
export const configSchema = NavigationConfigSchema
