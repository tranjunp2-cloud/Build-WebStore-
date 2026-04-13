'use client'

import type { ReactNode } from 'react'
import type { BlockProps } from '../types'
import type { FooterConfig } from './config'
import { GradientLine } from '../shared/decorative'
import { mergeFooterSocialsWithSite } from '@/lib/site-settings'
import { Facebook, Instagram, Twitter, Linkedin, Youtube, Globe } from 'lucide-react'
import { CSS_VARS } from '@/lib/theme/resolve'
import { Heading, Body, Caption } from '../shared/Typography'
import {
    SECTION_PADDING,
    CONTAINER,
    INNER_PADDING,
    TOUCH_TARGET,
} from '@/lib/design-tokens'

const SOCIAL_ICONS: Record<string, React.ComponentType<{ size?: number }>> = {
    facebook: Facebook,
    instagram: Instagram,
    twitter: Twitter,
    x: Twitter,
    linkedin: Linkedin,
    youtube: Youtube,
    tiktok: Globe,
}

function SocialIcon({ platform }: { platform: string }) {
    const Icon = SOCIAL_ICONS[platform.toLowerCase()]
    return Icon ? <Icon size={16} /> : <span>{(platform || '').charAt(0).toUpperCase()}</span>
}

// ── Local helpers (Phase 05 refactor) ───────────────────────────────────────
// Extract repeated structural elements without altering variant logic. All
// helpers consume Phase 01 (tokens), Phase 02 (Typography), Phase 03 (CSS
// vars). Brand identity vars (`--brand-primary`, `--brand-primary-rgb`) stay
// untouched per Option C additive strategy.

type FooterSectionProps = {
    paddingClass: string
    showGradientLine?: boolean
    children: ReactNode
}

/**
 * Wrapper: <footer> + relative + GradientLine + token container.
 * Replaces inline `container mx-auto px-6` (used in 6 variants).
 *
 * Note: SectionWrapper not used here — footer GradientLine needs absolute
 * positioning relative to the OUTER footer (full width), not the inner
 * max-w-6xl container. Local wrapper keeps `relative` on the footer tag.
 */
function FooterSection({ paddingClass, showGradientLine = true, children }: FooterSectionProps) {
    return (
        <footer className={`${paddingClass} relative`}>
            {showGradientLine && (
                <GradientLine
                    from={CSS_VARS.primary}
                    to={`rgba(var(--brand-primary-rgb), 0)`}
                    className="absolute top-0 left-0"
                    height={1}
                />
            )}
            <div className={`${CONTAINER.default} mx-auto ${INNER_PADDING}`}>
                {children}
            </div>
        </footer>
    )
}

type BrandLogoProps = {
    logoText?: string
    logo?: { url?: string; alt?: string }
    size?: 'sm' | 'md' | 'lg'
    className?: string
}

const BRAND_LOGO_TEXT_SIZE = {
    sm: 'text-lg',
    md: 'text-xl',
    lg: 'text-2xl',
} as const

const BRAND_LOGO_IMG_SIZE = {
    sm: 'h-6',
    md: 'h-8',
    lg: 'h-8',
} as const

function BrandLogo({ logoText, logo, size = 'lg', className = '' }: BrandLogoProps) {
    const textCls = BRAND_LOGO_TEXT_SIZE[size]
    const imgCls = BRAND_LOGO_IMG_SIZE[size]
    return (
        <div className={`font-bold ${textCls} font-heading ${className}`.trim()}>
            {logo?.url ? (
                <img src={logo.url} alt={logoText || ''} className={`${imgCls} w-auto`} />
            ) : (
                <span style={{
                    background: `linear-gradient(135deg, var(--brand-primary), rgba(var(--brand-primary-rgb), 0.502))`,
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                }}>
                    {logoText}
                </span>
            )}
        </div>
    )
}

type SocialIconListProps = {
    socials: { url?: string; platform?: string; label?: string }[]
    iconSize?: 'sm' | 'md'
    className?: string
}

const SOCIAL_BUTTON_SIZE = {
    sm: 'w-8 h-8',
    md: 'w-9 h-9',
} as const

/**
 * Social icon row. Used by 5 variants. Bordered=true adds the brand-tinted
 * 1px outline used by centered-stack/dark-gradient/expanded/simple.
 */
function SocialIconList({ socials, iconSize = 'md', className = '' }: SocialIconListProps) {
    if (socials.length === 0) return null
    const sizeCls = SOCIAL_BUTTON_SIZE[iconSize]
    return (
        <div className={`flex gap-3 ${className}`.trim()}>
            {socials.map((social, i) => (
                <a
                    key={i}
                    href={social.url || '#'}
                    aria-label={social.label || social.platform || 'social link'}
                    className={`${sizeCls} rounded-lg flex items-center justify-center transition-all duration-200 hover:scale-110`}
                    style={{
                        background: `rgba(var(--brand-primary-rgb), 0.063)`,
                        border: `1px solid rgba(var(--brand-primary-rgb), 0.082)`,
                        color: 'var(--brand-primary)',
                    }}
                >
                    <SocialIcon platform={social.platform || ''} />
                </a>
            ))}
        </div>
    )
}

type LinkColumnProps = {
    title: string
    links: { label?: string; url?: string }[]
    spacing?: 'tight' | 'default'
}

/** Link column: <h4> column title + <ul> of links. */
function LinkColumn({ title, links, spacing = 'default' }: LinkColumnProps) {
    const ulSpacing = spacing === 'tight' ? 'space-y-2.5' : 'space-y-3'
    return (
        <div>
            <Heading level={4} className="mb-4 opacity-80">{title}</Heading>
            <ul className={ulSpacing}>
                {(links || []).map((link, j) => (
                    <li key={j}>
                        <a
                            href={link?.url}
                            className="opacity-40 hover:opacity-80 transition-all duration-200 hover:translate-x-1 inline-block"
                        >
                            <Body size="small" as="span">{link.label}</Body>
                        </a>
                    </li>
                ))}
            </ul>
        </div>
    )
}

const FOOTER_DIVIDER_STYLE = { borderTop: `1px solid rgba(var(--brand-primary-rgb), 0.063)` }

export function FooterBlock({ block, theme: _theme, site }: BlockProps<FooterConfig>) {
    void _theme
    const mergedBlock = mergeFooterSocialsWithSite(block, site)
    const { logoText, tagline, columns = [], copyrightText, variant = 'simple' } = mergedBlock

    const copyrightLine = copyrightText
        ? copyrightText.replace(/\d{4}/, String(new Date().getFullYear()))
        : `\u00A9 ${new Date().getFullYear()} ${logoText || 'All rights reserved'}`

    const socialsArr = (mergedBlock.socials && Array.isArray(mergedBlock.socials) ? mergedBlock.socials : []) as { url?: string; platform?: string; label?: string }[]

    // ── Centered Stack variant ────────────────────────────────────────────
    if (variant === 'centered-stack') {
        return (
            <FooterSection paddingClass={SECTION_PADDING.compact}>
                <div className="text-center">
                    <BrandLogo logoText={logoText} logo={mergedBlock.logo} size="lg" className="mb-4 mx-auto" />
                    {tagline && (
                        <Body size="small" className="opacity-40 mb-8 max-w-md mx-auto">{tagline}</Body>
                    )}

                    {/* Link columns as horizontal lists */}
                    {columns.length > 0 && (
                        <div className="mb-8 space-y-4">
                            {columns.map((col, i) => (
                                <div key={i}>
                                    <Heading
                                        level={4}
                                        className="text-xs font-semibold uppercase tracking-widest opacity-50 mb-2"
                                    >
                                        {col.title}
                                    </Heading>
                                    <div className="flex flex-wrap justify-center gap-x-6 gap-y-1">
                                        {(col.links || []).map((link, j) => (
                                            <a key={j} href={link?.url} className="opacity-40 hover:opacity-80 transition-opacity duration-200">
                                                <Body size="small" as="span">{link.label}</Body>
                                            </a>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    <SocialIconList socials={socialsArr} className="justify-center mb-8" />

                    <Caption className="opacity-30">{copyrightLine}</Caption>
                </div>
            </FooterSection>
        )
    }

    // ── Mega Footer variant ───────────────────────────────────────────────
    // Special: 2-band layout (top accent band + main body). Outer <footer> has
    // no GradientLine; the top band serves as the visual divider. Cannot use
    // FooterSection helper because of the dual-band structure.
    if (variant === 'mega-footer') {
        return (
            <footer className="relative">
                {/* Top band */}
                <div className="py-10" style={{ background: `var(--brand-primary)` }}>
                    <div className={`${CONTAINER.default} mx-auto ${INNER_PADDING} text-center`}>
                        <Heading level={3} className="text-white mb-2">Stay Connected</Heading>
                        <Body size="small" className="text-white/70 mb-4">
                            Subscribe for the latest updates and news.
                        </Body>
                        <div className="flex gap-2 max-w-md mx-auto">
                            <input
                                type="email"
                                placeholder="Enter your email"
                                aria-label="Email address"
                                className="flex-1 px-4 py-2.5 rounded-lg text-base bg-white/20 text-white placeholder-white/50 border border-white/20 outline-none focus:border-white/40 transition-colors"
                            />
                            <button
                                className={`px-5 py-2.5 rounded-lg text-sm font-semibold bg-white transition-opacity hover:opacity-90 ${TOUCH_TARGET.min}`}
                                style={{ color: 'var(--brand-primary)' }}
                            >
                                Subscribe
                            </button>
                        </div>
                    </div>
                </div>

                {/* Main footer content */}
                <div className="pt-14 pb-8">
                    <div className={`${CONTAINER.default} mx-auto ${INNER_PADDING}`}>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-8 mb-12">
                            {/* Brand column */}
                            <div className="col-span-2 md:col-span-1">
                                <BrandLogo logoText={logoText} logo={mergedBlock.logo} size="md" className="mb-3" />
                                {tagline && (
                                    <Body size="small" className="opacity-40 leading-relaxed max-w-xs">{tagline}</Body>
                                )}
                            </div>

                            {/* Link columns */}
                            {columns.map((col, i) => (
                                <LinkColumn key={i} title={col.title} links={col.links || []} spacing="tight" />
                            ))}
                        </div>

                        {/* Bottom bar */}
                        <div
                            className="pt-6 flex flex-col md:flex-row items-center justify-between gap-4"
                            style={FOOTER_DIVIDER_STYLE}
                        >
                            <Caption className="opacity-30">{copyrightLine}</Caption>
                            <div className="flex items-center gap-4">
                                <SocialIconList socials={socialsArr} iconSize="sm" />
                                <div className="flex gap-4">
                                    <a href="#" className="opacity-30 hover:opacity-80 transition-opacity">
                                        <Caption>Privacy</Caption>
                                    </a>
                                    <a href="#" className="opacity-30 hover:opacity-80 transition-opacity">
                                        <Caption>Terms</Caption>
                                    </a>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </footer>
        )
    }

    // ── Dark Gradient variant ─────────────────────────────────────────────
    if (variant === 'dark-gradient') {
        return (
            <footer
                className={`${SECTION_PADDING.compact} relative`}
                style={{
                    background: `linear-gradient(to bottom, transparent, rgba(0,0,0,0.08))`,
                }}
            >
                <GradientLine
                    from={CSS_VARS.primary}
                    to={`rgba(var(--brand-primary-rgb), 0)`}
                    className="absolute top-0 left-0"
                    height={1}
                />
                <div className={`${CONTAINER.default} mx-auto ${INNER_PADDING}`}>
                    <div className="flex flex-col lg:flex-row lg:justify-between lg:items-start gap-10">
                        {/* Logo + tagline */}
                        <div className="lg:max-w-xs">
                            <BrandLogo logoText={logoText} logo={mergedBlock.logo} size="lg" className="mb-3" />
                            {tagline && (
                                <Body size="small" className="opacity-40 leading-relaxed">{tagline}</Body>
                            )}
                        </div>

                        {/* Link columns center */}
                        {columns.length > 0 && (
                            <div className="flex flex-wrap gap-10">
                                {columns.map((col, i) => (
                                    <LinkColumn key={i} title={col.title} links={col.links || []} spacing="tight" />
                                ))}
                            </div>
                        )}

                        {/* Socials right */}
                        <SocialIconList socials={socialsArr} className="lg:flex-col" />
                    </div>

                    {/* Copyright */}
                    <div className="mt-10 pt-6 text-center" style={FOOTER_DIVIDER_STYLE}>
                        <Caption className="opacity-30">{copyrightLine}</Caption>
                    </div>
                </div>
            </footer>
        )
    }

    // ── Expanded variant ────────────────────────────────────────────────
    // Custom asymmetric padding (pt-16 md:pt-20 pb-8) — outside SECTION_PADDING
    // tokens which only cover symmetric py-* values. Kept inline.
    if (variant === 'expanded') {
        return (
            <FooterSection paddingClass="pt-16 md:pt-20 pb-8">
                {/* 4-column links section */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10 mb-12">
                    {/* Brand column as first of 4 */}
                    <div>
                        <BrandLogo logoText={logoText} logo={mergedBlock.logo} size="lg" className="mb-4" />
                        {tagline && (
                            <Body size="small" className="opacity-40 leading-relaxed max-w-xs">{tagline}</Body>
                        )}
                        <SocialIconList socials={socialsArr} className="mt-6" />
                    </div>

                    {/* Link columns (up to 3) */}
                    {columns.slice(0, 3).map((col, i) => (
                        <LinkColumn key={i} title={col.title} links={col.links || []} />
                    ))}
                </div>

                {/* Divider */}
                <div style={FOOTER_DIVIDER_STYLE} />

                {/* Newsletter row */}
                <div className="py-8 flex flex-col md:flex-row items-center justify-between gap-6">
                    <div>
                        <Heading level={4} className="mb-1">Subscribe to our newsletter</Heading>
                        <Body size="small" className="opacity-40">
                            Get the latest updates delivered to your inbox.
                        </Body>
                    </div>
                    <div className="flex gap-2 w-full md:w-auto">
                        <input
                            type="email"
                            placeholder="Enter your email"
                            aria-label="Email address"
                            className="flex-1 md:w-64 px-4 py-2.5 rounded-lg text-base outline-none transition-colors"
                            style={{
                                background: 'rgba(var(--brand-primary-rgb), 0.04)',
                                border: '1px solid rgba(var(--brand-primary-rgb), 0.1)',
                                color: 'inherit',
                            }}
                        />
                        <button
                            className={`px-5 py-2.5 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-90 flex-shrink-0 ${TOUCH_TARGET.min}`}
                            style={{ background: 'var(--brand-primary)' }}
                        >
                            Subscribe
                        </button>
                    </div>
                </div>

                {/* Copyright bar */}
                <div className="pt-6 text-center" style={FOOTER_DIVIDER_STYLE}>
                    <Caption className="opacity-30">{copyrightLine}</Caption>
                </div>
            </FooterSection>
        )
    }

    // ── Minimal variant ──────────────────────────────────────────────────
    // Custom thin padding (py-6) — smaller than SECTION_PADDING.compact (py-12+).
    // A "thin bar" footer doesn't fit the standard token range; kept inline.
    if (variant === 'minimal') {
        // All flat links from all columns
        const allLinks = columns.flatMap(col => col.links || [])

        return (
            <FooterSection paddingClass="py-6">
                <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                    {/* Logo / brand text — left */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                        <BrandLogo logoText={logoText} logo={mergedBlock.logo} size="sm" />
                    </div>

                    {/* Links — center */}
                    {allLinks.length > 0 && (
                        <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1">
                            {allLinks.slice(0, 6).map((link, i) => (
                                <a
                                    key={i}
                                    href={link?.url}
                                    className="opacity-40 hover:opacity-80 transition-opacity duration-200"
                                >
                                    <Body size="small" as="span">{link.label}</Body>
                                </a>
                            ))}
                        </div>
                    )}

                    {/* Copyright — right */}
                    <Caption className="opacity-30 flex-shrink-0">{copyrightLine}</Caption>
                </div>
            </FooterSection>
        )
    }

    // ── Default: simple ──────────────────────────────────────────────────
    // Custom asymmetric padding — same reason as expanded variant.
    return (
        <FooterSection paddingClass="pt-16 md:pt-20 pb-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 mb-16">
                {/* Brand Column */}
                <div className="md:col-span-1">
                    <BrandLogo logoText={logoText} logo={mergedBlock.logo} size="lg" className="mb-4" />
                    {tagline && (
                        <Body size="small" className="opacity-40 leading-relaxed max-w-xs">{tagline}</Body>
                    )}
                    <SocialIconList socials={socialsArr} className="mt-6" />
                </div>

                {/* Link Columns */}
                {columns.map((col, i) => (
                    <LinkColumn key={i} title={col.title} links={col.links || []} />
                ))}
            </div>

            {/* Bottom bar */}
            <div className="pt-8 text-center" style={FOOTER_DIVIDER_STYLE}>
                <Caption className="opacity-30">{copyrightLine}</Caption>
            </div>
        </FooterSection>
    )
}
