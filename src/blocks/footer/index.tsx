'use client'

import type { ReactNode } from 'react'
import { EyeOff } from 'lucide-react'

import type { BlockProps } from '../types'
import type { FooterConfig } from './config'
import { GradientLine } from '../shared/decorative'
import { getSocialIcon } from '../shared/social-icons'
import { mergeFooterSocialsWithSite } from '@/lib/site-settings'
import { useLocalHref } from '@/lib/hooks/use-local-href'
import { CSS_VARS } from '@/lib/theme/resolve'
import { Heading, Body, Caption } from '../shared/Typography'
import {
    SECTION_PADDING,
    CONTAINER,
    INNER_PADDING,
} from '@/lib/design-tokens'

// ── Link style helpers ────────────────────────────────────────────────────────
function isExternal(url: string): boolean {
    return url.startsWith('http://') || url.startsWith('https://')
}

const resolveStyle = (link: { style?: 'internal' | 'external'; url?: string }): 'internal' | 'external' =>
    link.style ?? (isExternal(link.url ?? '') ? 'external' : 'internal')

/**
 * Plan 260415 Lỗi B + 7F — SocialIcon giờ dùng shared SOCIAL_ICONS map
 * (src/blocks/shared/social-icons.tsx) với real TikTok/Threads/X/Discord/WhatsApp
 * inline SVG + Link fallback cho unknown platforms (thay vì chữ cái đầu legacy).
 */
function SocialIcon({ platform }: { platform: string }) {
    const Icon = getSocialIcon(platform)
    return <Icon size={16} />
}

// ── Local helpers (Phase 05 refactor) ───────────────────────────────────────
// Extract repeated structural elements without altering variant logic. All
// helpers consume Phase 01 (tokens), Phase 02 (Typography), Phase 03 (CSS
// vars). Brand identity vars (`--brand-primary`, `--brand-primary-rgb`) stay
// untouched per Option C additive strategy.

// Shared opacity + brand-tint tokens — dedupe magic numbers across variants.
const FOOTER_OPACITY = {
    title: 0.9,
    body: 0.7,
    caption: 0.5,
} as const

const FOOTER_BORDER_OPACITY = 0.082
const FOOTER_DIVIDER_OPACITY = 0.063
const FOOTER_BRAND_GRADIENT_STOP = 0.502

// Progressive gap: tight mobile → comfortable desktop. Applied to all grid variants.
const FOOTER_RESPONSIVE_GAP = 'gap-6 sm:gap-8 md:gap-10'

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
                /* Plan 260415 Lỗi 8F — alt fallback tốt hơn cho WCAG 1.1.1 */
                <img src={logo.url} alt={logoText ? `${logoText} logo` : 'Company logo'} className={`${imgCls} w-auto`} />
            ) : (
                <span style={{
                    background: `linear-gradient(135deg, var(--brand-primary), rgba(var(--brand-primary-rgb), ${FOOTER_BRAND_GRADIENT_STOP}))`,
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

// Intentionally smaller than WCAG 2.5.5 44px minimum — brand aesthetic trade-off.
// Touch target is NOT WCAG AA compliant (sm=28px, md=32px). Accepted for footer context.
const SOCIAL_BUTTON_SIZE = {
    sm: 'w-7 h-7',
    md: 'w-8 h-8',
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
            {socials.map((social, i) => {
                const platform = social.platform || ''
                const aria = social.label || (platform ? `Visit ${platform}` : 'social link')
                return (
                    <a
                        key={`${platform}-${i}`}
                        href={social.url || '#'}
                        aria-label={aria}
                        target={social.url?.startsWith('http') ? '_blank' : undefined}
                        rel={social.url?.startsWith('http') ? 'noopener noreferrer' : undefined}
                        className={`${sizeCls} aspect-square shrink-0 rounded-full flex items-center justify-center transition-all duration-200 hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(var(--brand-primary-rgb),0.35)]`}
                        style={{
                            background: `rgba(var(--brand-primary-rgb), ${FOOTER_DIVIDER_OPACITY})`,
                            border: `1px solid rgba(var(--brand-primary-rgb), ${FOOTER_BORDER_OPACITY})`,
                            color: 'var(--brand-primary)',
                        }}
                    >
                        <SocialIcon platform={platform} />
                    </a>
                )
            })}
        </div>
    )
}

/**
 * Shared section title — unifies `<Heading level={4} opacity-90>` pattern
 * across simple/expanded/mega-footer/dark-gradient variants (via LinkColumn).
 */
function FooterSectionTitle({ children, className = '' }: { children: ReactNode; className?: string }) {
    return (
        <Heading level={4} className={`mb-4 ${className}`.trim()} style={{ opacity: FOOTER_OPACITY.title }}>
            {children}
        </Heading>
    )
}

type LinkColumnProps = {
    title: string
    links: { label?: string; url?: string; style?: 'internal' | 'external'; _hiddenFromVisitor?: boolean }[]
    spacing?: 'tight' | 'default'
}

/**
 * Plan 260415 Lỗi 12F — opacity-40 fail WCAG contrast. Đổi sang opacity-70
 * (≥4.5:1 ratio trên bg thường). Hover vẫn tăng lên 100%.
 */
function LinkColumn({ title, links, spacing = 'default' }: LinkColumnProps) {
    const resolveHref = useLocalHref()
    const ulSpacing = spacing === 'tight' ? 'space-y-2.5' : 'space-y-3'
    return (
        <div>
            <FooterSectionTitle>{title}</FooterSectionTitle>
            <ul className={ulSpacing}>
                {(links || []).map((link, j) => {
                    const ext = resolveStyle(link) === 'external'
                    return (
                        <li key={`${link?.label || 'link'}-${j}`}>
                            <a
                                href={resolveHref(link?.url)}
                                target={ext ? '_blank' : undefined}
                                rel={ext ? 'noopener noreferrer' : undefined}
                                className="opacity-70 hover:opacity-100 transition-all duration-200 hover:translate-x-1 inline-flex items-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(var(--brand-primary-rgb),0.35)] rounded"
                            >
                                <Body size="small" as="span">{link.label}</Body>
                                {link._hiddenFromVisitor && <EyeOff size={11} className="text-amber-400 shrink-0" aria-label="Hidden from visitors" />}
                            </a>
                        </li>
                    )
                })}
            </ul>
        </div>
    )
}

const FOOTER_DIVIDER_STYLE = { borderTop: `1px solid rgba(var(--brand-primary-rgb), ${FOOTER_DIVIDER_OPACITY})` }

export function FooterBlock({ block, theme: _theme, site }: BlockProps<FooterConfig>) {
    void _theme
    const resolveHref = useLocalHref()
    const mergedBlock = mergeFooterSocialsWithSite(block, site)
    const { logoText, tagline, columns = [], copyrightText, backgroundColor, variant = 'simple' } = mergedBlock
    const footerStyle: React.CSSProperties = backgroundColor ? { backgroundColor } : {}

    const copyrightLine = copyrightText
        ? copyrightText.replace(/\d{4}/, String(new Date().getFullYear()))
        : `\u00A9 ${new Date().getFullYear()} ${logoText || 'All rights reserved'}`

    const socialsArr = (mergedBlock.socials && Array.isArray(mergedBlock.socials) ? mergedBlock.socials : []) as { url?: string; platform?: string; label?: string }[]

    // ── Centered Stack variant ────────────────────────────────────────────
    // BUG-F05-792: plain <footer> — same fix as simple/minimal to avoid motion.footer
    // staying invisible when already in viewport inside the editor iframe.
    if (variant === 'centered-stack') {
        return (
            <footer className={`${SECTION_PADDING.compact} relative`} style={footerStyle}>
                <GradientLine
                    from={CSS_VARS.primary}
                    to={`rgba(var(--brand-primary-rgb), 0)`}
                    className="absolute top-0 left-0"
                    height={1}
                />
                <div className={`${CONTAINER.default} mx-auto ${INNER_PADDING}`}>
                    <div className="text-center">
                        <BrandLogo logoText={logoText} logo={mergedBlock.logo} size="lg" className="mb-4 flex justify-center" />
                        {tagline && (
                            <Body size="small" data-footer-field="tagline" className="opacity-70 mb-8 max-w-md mx-auto">{tagline}</Body>
                        )}

                        {/* Link columns as horizontal lists */}
                        {columns.length > 0 && (
                            <div className="mb-8 space-y-4">
                                {columns.map((col, i) => (
                                    <div key={`${col.title}-${i}`}>
                                        <Heading
                                            level={4}
                                            className="text-xs font-semibold uppercase tracking-widest opacity-80 mb-2"
                                        >
                                            {col.title}
                                        </Heading>
                                        <div className="flex flex-wrap justify-center gap-x-6 gap-y-1">
                                            {(col.links || []).map((link, j) => {
                                                const ext = resolveStyle(link) === 'external'
                                                return (
                                                    <a
                                                        key={`${link?.label || 'link'}-${j}`}
                                                        href={resolveHref(link?.url)}
                                                        target={ext ? '_blank' : undefined}
                                                        rel={ext ? 'noopener noreferrer' : undefined}
                                                        className="opacity-70 hover:opacity-100 transition-opacity duration-200 inline-flex items-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(var(--brand-primary-rgb),0.35)] rounded"
                                                    >
                                                        <Body size="small" as="span">{link.label}</Body>
                                                        {(link as { _hiddenFromVisitor?: boolean })._hiddenFromVisitor && <EyeOff size={11} className="text-amber-400 shrink-0" aria-label="Hidden from visitors" />}
                                                    </a>
                                                )
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        <SocialIconList socials={socialsArr} className="justify-center mb-8" />

                        <Caption data-footer-field="copyrightText" className="opacity-60">{copyrightLine}</Caption>
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
                    /* Plan 260415 Lỗi 16F — theme-adaptive gradient thay vì hardcode đen.
                       color-mix var(--background) với 94% độ đục → hiện cả light + dark themes. */
                    background: backgroundColor || `linear-gradient(to bottom, transparent, color-mix(in srgb, var(--background, #000000) 92%, black))`,
                }}
            >
                <GradientLine
                    from={CSS_VARS.primary}
                    to={`rgba(var(--brand-primary-rgb), 0)`}
                    className="absolute top-0 left-0"
                    height={1}
                />
                <div className={`${CONTAINER.default} mx-auto ${INNER_PADDING}`}>
                    <div className={`flex flex-col lg:flex-row lg:justify-between lg:items-start ${FOOTER_RESPONSIVE_GAP}`}>
                        {/* Logo + tagline */}
                        <div className="lg:max-w-xs">
                            <BrandLogo logoText={logoText} logo={mergedBlock.logo} size="lg" className="mb-3" />
                            {tagline && (
                                <Body size="small" data-footer-field="tagline" className="opacity-40 leading-relaxed">{tagline}</Body>
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
                        <Caption data-footer-field="copyrightText" className="opacity-30">{copyrightLine}</Caption>
                    </div>
                </div>
            </footer>
        )
    }


    // ── Minimal variant ──────────────────────────────────────────────────
    // BUG-F05-792: plain <footer> — no motion.footer/whileInView to avoid
    // staying invisible when already in viewport (e.g. short iframe preview).
    // Mirror nav header links so minimal footer stays in sync with navigation.
    // Falls back to columns[0] if no header links configured.
    if (variant === 'minimal') {
        // Prefer _filteredNavLinks (injected by SiteRenderer/SiteLayoutShell with hidden pages filtered/marked)
        // over raw site.headerBlock.links to prevent hidden-page links leaking to visitors.
        const filteredNavLinks = (block as Record<string, unknown>)._filteredNavLinks as { label?: string; url?: string; _hiddenFromVisitor?: boolean }[] | undefined
        const navHeaderLinks = (filteredNavLinks ?? (site?.headerBlock as Record<string, unknown> | undefined)?.links as { label?: string; url?: string }[] | undefined)?.filter(l => l?.url)
        const firstColLinks = (navHeaderLinks?.length ? navHeaderLinks : columns[0]?.links) || []

        return (
            <footer className="py-6 relative" style={footerStyle}>
                <div className={`${CONTAINER.default} mx-auto ${INNER_PADDING}`}>
                    <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                        {/* Logo / brand text — left */}
                        <div className="flex items-center gap-2 flex-shrink-0">
                            <BrandLogo logoText={logoText} logo={mergedBlock.logo} size="sm" />
                        </div>

                        {/* First-column links — center */}
                        {firstColLinks.length > 0 && (
                            <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1">
                                {firstColLinks.slice(0, 6).map((link, i) => {
                                    const ext = resolveStyle(link) === 'external'
                                    return (
                                    <a
                                        key={`${link?.label || 'link'}-${i}`}
                                        href={resolveHref(link?.url)}
                                        target={ext ? '_blank' : undefined}
                                        rel={ext ? 'noopener noreferrer' : undefined}
                                        className="opacity-70 hover:opacity-100 transition-opacity duration-200 inline-flex items-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(var(--brand-primary-rgb),0.35)] rounded"
                                    >
                                        <Body size="small" as="span">{link.label}</Body>
                                        {(link as { _hiddenFromVisitor?: boolean })._hiddenFromVisitor && <EyeOff size={11} className="text-amber-400 shrink-0" aria-label="Hidden from visitors" />}
                                    </a>
                                    )
                                })}
                            </div>
                        )}

                        {/* Copyright — right */}
                        <Caption data-footer-field="copyrightText" className="opacity-60 flex-shrink-0">{copyrightLine}</Caption>
                    </div>
                </div>
            </footer>
        )
    }

    // ── Default: simple ──────────────────────────────────────────────────
    // BUG-F05-792: single-line bar — plain <footer> (no motion/whileInView) so it never
    // stays invisible when already in viewport (same fix as minimal above).
    return (
        <footer className="py-5 relative" style={footerStyle}>
            <div className={`${CONTAINER.default} mx-auto ${INNER_PADDING}`}>
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                    <BrandLogo logoText={logoText} logo={mergedBlock.logo} size="sm" />
                    {socialsArr.length > 0 && (
                        <SocialIconList socials={socialsArr} iconSize="sm" />
                    )}
                    <Caption data-footer-field="copyrightText" className="opacity-60 flex-shrink-0">{copyrightLine}</Caption>
                </div>
            </div>
        </footer>
    )
}
