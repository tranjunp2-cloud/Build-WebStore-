'use client'

import type { ReactNode } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import type { BlockProps } from '../types'
import type { FooterConfig } from './config'
import { GradientLine } from '../shared/decorative'
import { getSocialIcon } from '../shared/social-icons'
import { FooterNewsletterForm } from './FooterNewsletterForm'
import { mergeFooterSocialsWithSite } from '@/lib/site-settings'
import { CSS_VARS } from '@/lib/theme/resolve'
import { Heading, Body, Caption } from '../shared/Typography'
import {
    SECTION_PADDING,
    CONTAINER,
    INNER_PADDING,
} from '@/lib/design-tokens'

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

// Shared opacity + brand-tint tokens — dedupe magic numbers across 6 variants.
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
// Tailwind JIT-safe lookup — dynamic class strings are not detected at build time.
// md:grid-cols-1 md:grid-cols-2 md:grid-cols-3 md:grid-cols-4 md:grid-cols-5 md:grid-cols-6
const FOOTER_MD_COLS: Record<number, string> = { 1: 'md:grid-cols-1', 2: 'md:grid-cols-2', 3: 'md:grid-cols-3', 4: 'md:grid-cols-4', 5: 'md:grid-cols-5', 6: 'md:grid-cols-6' }

type FooterSectionProps = {
    paddingClass: string
    showGradientLine?: boolean
    style?: React.CSSProperties
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
/**
 * Plan 260415 Lỗi C — wrap footer trong motion.footer để scroll reveal.
 * Fade-in y: 30 → 0 khi scroll vào viewport. Respect prefers-reduced-motion →
 * skip animation entirely (render static <footer>).
 */
const FOOTER_VARIANTS = {
    hidden: { opacity: 0, y: 30 },
    visible: {
        opacity: 1,
        y: 0,
        transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
    },
}

function FooterSection({ paddingClass, showGradientLine = true, style, children }: FooterSectionProps) {
    const shouldReduce = useReducedMotion()

    const innerContent = (
        <>
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
        </>
    )

    if (shouldReduce) {
        return <footer className={`${paddingClass} relative`} style={style}>{innerContent}</footer>
    }

    return (
        <motion.footer
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-80px' }}
            variants={FOOTER_VARIANTS}
            className={`${paddingClass} relative`}
            style={style}
        >
            {innerContent}
        </motion.footer>
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
    links: { label?: string; url?: string }[]
    spacing?: 'tight' | 'default'
}

/**
 * Plan 260415 Lỗi 12F — opacity-40 fail WCAG contrast. Đổi sang opacity-70
 * (≥4.5:1 ratio trên bg thường). Hover vẫn tăng lên 100%.
 */
function LinkColumn({ title, links, spacing = 'default' }: LinkColumnProps) {
    const ulSpacing = spacing === 'tight' ? 'space-y-2.5' : 'space-y-3'
    return (
        <div>
            <FooterSectionTitle>{title}</FooterSectionTitle>
            <ul className={ulSpacing}>
                {(links || []).map((link, j) => (
                    <li key={`${link?.label || 'link'}-${j}`}>
                        <a
                            href={link?.url}
                            className="opacity-70 hover:opacity-100 transition-all duration-200 hover:translate-x-1 inline-block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(var(--brand-primary-rgb),0.35)] rounded"
                        >
                            <Body size="small" as="span">{link.label}</Body>
                        </a>
                    </li>
                ))}
            </ul>
        </div>
    )
}

const FOOTER_DIVIDER_STYLE = { borderTop: `1px solid rgba(var(--brand-primary-rgb), ${FOOTER_DIVIDER_OPACITY})` }

export function FooterBlock({ block, theme: _theme, site }: BlockProps<FooterConfig>) {
    void _theme
    const mergedBlock = mergeFooterSocialsWithSite(block, site)
    const { logoText, tagline, columns = [], copyrightText, backgroundColor, variant = 'simple' } = mergedBlock
    const footerStyle: React.CSSProperties = backgroundColor ? { backgroundColor } : {}
    // Plan 260415 Lỗi G-pattern — safe String cast cho siteId (dùng trong newsletter form POST)
    const siteId = site?.id != null ? String(site.id) : undefined

    /**
     * Plan 260415 Lỗi F — legal links (privacy/terms/cookies). Config optional,
     * fallback về /privacy /terms (default site pages). Admin có thể override
     * qua `block.legalLinks.privacy` nếu có.
     */
    const legalLinks = {
        privacy: (block as unknown as { legalLinks?: { privacy?: string } })?.legalLinks?.privacy || '/privacy',
        terms: (block as unknown as { legalLinks?: { terms?: string } })?.legalLinks?.terms || '/terms',
    }

    const copyrightLine = copyrightText
        ? copyrightText.replace(/\d{4}/, String(new Date().getFullYear()))
        : `\u00A9 ${new Date().getFullYear()} ${logoText || 'All rights reserved'}`

    const socialsArr = (mergedBlock.socials && Array.isArray(mergedBlock.socials) ? mergedBlock.socials : []) as { url?: string; platform?: string; label?: string }[]

    // ── Centered Stack variant ────────────────────────────────────────────
    if (variant === 'centered-stack') {
        return (
            <FooterSection paddingClass={SECTION_PADDING.compact} style={footerStyle}>
                <div className="text-center">
                    <BrandLogo logoText={logoText} logo={mergedBlock.logo} size="lg" className="mb-4 mx-auto" />
                    {tagline && (
                        <Body size="small" className="opacity-70 mb-8 max-w-md mx-auto">{tagline}</Body>
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
                                        {(col.links || []).map((link, j) => (
                                            <a
                                                key={`${link?.label || 'link'}-${j}`}
                                                href={link?.url}
                                                className="opacity-70 hover:opacity-100 transition-opacity duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(var(--brand-primary-rgb),0.35)] rounded"
                                            >
                                                <Body size="small" as="span">{link.label}</Body>
                                            </a>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    <SocialIconList socials={socialsArr} className="justify-center mb-8" />

                    <Caption className="opacity-60">{copyrightLine}</Caption>
                </div>
            </FooterSection>
        )
    }

    // ── Mega Footer variant ───────────────────────────────────────────────
    // Special: 2-band layout (top accent band + main body). Outer <footer> has
    // no GradientLine; the top band serves as the visual divider. Cannot use
    // FooterSection helper because of the dual-band structure.
    if ((variant as string) === 'mega-footer') {
        return (
            <footer className="relative" style={footerStyle}>
                {/* Top band */}
                <div className="py-10" style={{ background: `var(--brand-primary)` }}>
                    <div className={`${CONTAINER.default} mx-auto ${INNER_PADDING} text-center`}>
                        <Heading level={3} className="text-white mb-2">Stay Connected</Heading>
                        <Body size="small" className="text-white/70 mb-4">
                            Subscribe for the latest updates and news.
                        </Body>
                        {/* Plan 260415 Lỗi A — wire vào FooterNewsletterForm, không còn inert */}
                        <FooterNewsletterForm
                            siteId={siteId}
                            variant="mega-footer"
                            placeholder="Enter your email"
                            buttonLabel="Subscribe"
                        />
                    </div>
                </div>

                {/* Main footer content */}
                <div className="pt-14 pb-8">
                    <div className={`${CONTAINER.default} mx-auto ${INNER_PADDING}`}>
                        {/* Plan 260415 — grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5
                            với gap-6 mobile → gap-8 sm+ (Lỗi E — giảm gap mobile). */}
                        <div className={`grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 ${FOOTER_RESPONSIVE_GAP} mb-12`}>
                            {/* Brand column */}
                            <div className="sm:col-span-2 md:col-span-1">
                                <BrandLogo logoText={logoText} logo={mergedBlock.logo} size="md" className="mb-3" />
                                {tagline && (
                                    <Body size="small" className="opacity-70 leading-relaxed max-w-xs">{tagline}</Body>
                                )}
                            </div>

                            {/* Link columns */}
                            {columns.map((col, i) => (
                                <LinkColumn key={`${col.title}-${i}`} title={col.title} links={col.links || []} spacing="tight" />
                            ))}
                        </div>

                        {/* Bottom bar */}
                        <div
                            className="pt-6 flex flex-col md:flex-row items-center justify-between gap-4"
                            style={FOOTER_DIVIDER_STYLE}
                        >
                            <Caption className="opacity-60">{copyrightLine}</Caption>
                            <div className="flex items-center gap-4 flex-wrap justify-center">
                                <SocialIconList socials={socialsArr} iconSize="sm" />
                                <div className="flex gap-4">
                                    <a href={legalLinks.privacy} className="opacity-60 hover:opacity-100 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(var(--brand-primary-rgb),0.35)] rounded">
                                        <Caption>Privacy</Caption>
                                    </a>
                                    <a href={legalLinks.terms} className="opacity-60 hover:opacity-100 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(var(--brand-primary-rgb),0.35)] rounded">
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
    if ((variant as string) === 'expanded') {
        return (
            <FooterSection paddingClass="pt-16 md:pt-20 pb-8" style={footerStyle}>
                {/* 4-column links section */}
                <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 ${FOOTER_RESPONSIVE_GAP} mb-12`}>
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

                {/* Plan 260415 Lỗi A — wire newsletter form, không còn inert. */}
                <div className="py-8 flex flex-col md:flex-row items-center justify-between gap-6">
                    <div>
                        <Heading level={4} className="mb-1">Subscribe to our newsletter</Heading>
                        <Body size="small" className="opacity-70">
                            Get the latest updates delivered to your inbox.
                        </Body>
                    </div>
                    <div className="w-full md:w-auto md:max-w-md">
                        <FooterNewsletterForm
                            siteId={siteId}
                            variant="expanded"
                            placeholder="Enter your email"
                            buttonLabel="Subscribe"
                        />
                    </div>
                </div>

                {/* Copyright bar */}
                <div className="pt-6 text-center" style={FOOTER_DIVIDER_STYLE}>
                    <Caption className="opacity-60">{copyrightLine}</Caption>
                </div>
            </FooterSection>
        )
    }

    // ── Minimal variant ──────────────────────────────────────────────────
    // Plan 260415 Lỗi 14F — minimal variant không show GradientLine (visual noise unnecessary).
    if (variant === 'minimal') {
        // All flat links from all columns
        const allLinks = columns.flatMap(col => col.links || [])

        return (
            <FooterSection paddingClass="py-6" showGradientLine={false} style={footerStyle}>
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
                                    key={`${link?.label || 'link'}-${i}`}
                                    href={link?.url}
                                    className="opacity-70 hover:opacity-100 transition-opacity duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(var(--brand-primary-rgb),0.35)] rounded"
                                >
                                    <Body size="small" as="span">{link.label}</Body>
                                </a>
                            ))}
                        </div>
                    )}

                    {/* Copyright — right */}
                    <Caption className="opacity-60 flex-shrink-0">{copyrightLine}</Caption>
                </div>
            </FooterSection>
        )
    }

    // ── Default: simple ──────────────────────────────────────────────────
    const mdColsCls = FOOTER_MD_COLS[Math.min(Math.max(columns.length + 1, 1), 6)] ?? 'md:grid-cols-1'
    return (
        <FooterSection paddingClass="pt-16 md:pt-20 pb-8" style={footerStyle}>
            <div className={`grid grid-cols-1 sm:grid-cols-2 ${mdColsCls} ${FOOTER_RESPONSIVE_GAP} mb-16`}>
                {/* Brand Column */}
                <div>
                    <BrandLogo logoText={logoText} logo={mergedBlock.logo} size="lg" className="mb-4" />
                    {tagline && (
                        <Body size="small" className="opacity-70 leading-relaxed max-w-xs">{tagline}</Body>
                    )}
                    <SocialIconList socials={socialsArr} className="mt-6" />
                </div>

                {/* Link Columns */}
                {columns.map((col, i) => (
                    <LinkColumn key={`${col.title}-${i}`} title={col.title} links={col.links || []} />
                ))}
            </div>

            {/* Bottom bar */}
            <div className="pt-8 text-center" style={FOOTER_DIVIDER_STYLE}>
                <Caption className="opacity-60">{copyrightLine}</Caption>
            </div>
        </FooterSection>
    )
}
