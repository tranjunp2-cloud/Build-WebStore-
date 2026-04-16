'use client'

import { useCallback, useEffect, useState } from 'react'
import { X } from 'lucide-react'
import type { BlockProps } from '../types'
import type { CTAConfig } from './config'
import { AnimatedSection } from '../shared/animations'
import { motion, useReducedMotion } from 'framer-motion'
import { CSS_VARS } from '@/lib/theme/resolve'
import { RichText } from '../shared/RichText'
import { Heading, Body } from '../shared/Typography'
import { CONTAINER, INNER_PADDING, TOUCH_TARGET } from '@/lib/design-tokens'
import { trackEvent } from '@/lib/analytics/track-event'
import { useIsOwner } from '@/components/site-renderer/OwnerContext'

const CTA_CONTAINER = `${CONTAINER.default} mx-auto ${INNER_PADDING}`
const FLOATING_STORAGE_PREFIX = 'cta-floating-dismissed-'
const FLOATING_DISMISS_DURATION_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Plan 260415 Lỗi 3C + 7C — determine target + rel attrs correctly.
 * External http(s) → target=_blank + rel noopener
 * Internal /path or #anchor → same tab
 */
function getLinkAttrs(url: string): { target?: string; rel?: string } {
    if (!url) return {}
    if (url.startsWith('http://') || url.startsWith('https://')) {
        return { target: '_blank', rel: 'noopener noreferrer' }
    }
    return {}
}

type CTAButtonProps = {
    label: string
    url: string
    style: 'primary' | 'outline'
    variant: string
    siteId?: string
    onInverseBg?: boolean
}

/**
 * Plan 260415 Lỗi A + 9C + 10C — CTA button với:
 * - Cả motion + reduce-motion branches dùng RichText consistent (Lỗi A)
 * - Trên inverse bg (banner gradient), outline style dùng white border/text
 *   thay vì brand-primary (tránh invisible, Lỗi 10C)
 * - Banner primary button dùng white bg + primary text (contrast guaranteed)
 */
function CTAButton({ label, url, style, variant, siteId, onInverseBg = false }: CTAButtonProps) {
    const shouldReduce = useReducedMotion()
    const isOwner = useIsOwner()
    const isPrimary = style === 'primary'
    const linkAttrs = getLinkAttrs(url)

    const buttonStyle: React.CSSProperties = isPrimary
        ? onInverseBg
            ? { background: '#ffffff', color: 'var(--brand-primary)', borderRadius: CSS_VARS.radiusMd }
            : {
                  background: CSS_VARS.primary,
                  color: '#ffffff',
                  borderRadius: CSS_VARS.radiusMd,
                  boxShadow: '0 4px 20px rgba(var(--brand-primary-rgb), 0.25)',
              }
        : onInverseBg
          ? {
                border: '2px solid rgba(255,255,255,0.7)',
                color: '#ffffff',
                background: 'transparent',
                borderRadius: CSS_VARS.radiusMd,
            }
          : {
                border: '2px solid rgba(var(--brand-primary-rgb), 0.3)',
                color: CSS_VARS.primary,
                background: 'transparent',
                borderRadius: CSS_VARS.radiusMd,
            }

    const btnCls = `inline-flex items-center justify-center px-8 py-3.5 font-semibold text-sm transition-colors ${TOUCH_TARGET.min} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(var(--brand-primary-rgb),0.4)]`

    const handleClick = () => {
        if (siteId) trackEvent({ siteId, event: 'click', metadata: { label, url, variant }, isOwner })
    }

    // Plan 260415 Lỗi A — cả 2 branches đều render RichText consistent
    const labelNode = <RichText text={label} as="span" />

    if (shouldReduce) {
        return (
            <a
                href={url}
                {...linkAttrs}
                onClick={handleClick}
                className={`${btnCls} hover:opacity-90`}
                style={buttonStyle}
            >
                {labelNode}
            </a>
        )
    }

    return (
        <motion.a
            href={url}
            {...linkAttrs}
            onClick={handleClick}
            whileHover={{ scale: 1.03, y: -2 }}
            whileTap={{ scale: 0.97 }}
            className={btnCls}
            style={buttonStyle}
        >
            {labelNode}
        </motion.a>
    )
}

/**
 * Plan 260415 Lỗi 6C — Secondary CTA button. Ghost style trên mọi bg.
 */
function SecondaryCTAButton({ label, url, siteId, onInverseBg }: { label: string; url: string; siteId?: string; onInverseBg?: boolean }) {
    const shouldReduce = useReducedMotion()
    const isOwner = useIsOwner()
    const linkAttrs = getLinkAttrs(url)

    const handleClick = () => {
        if (siteId) trackEvent({ siteId, event: 'click', metadata: { label, url, role: 'secondary' }, isOwner })
    }

    const cls = `inline-flex items-center justify-center px-6 py-3.5 font-medium text-sm transition-opacity ${TOUCH_TARGET.min} hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(var(--brand-primary-rgb),0.4)] rounded-md`
    const style: React.CSSProperties = {
        color: onInverseBg ? '#ffffff' : 'var(--brand-primary)',
    }

    if (shouldReduce) {
        return (
            <a href={url} {...linkAttrs} onClick={handleClick} className={cls} style={style}>
                <RichText text={label} as="span" />
            </a>
        )
    }
    return (
        <motion.a
            href={url}
            {...linkAttrs}
            onClick={handleClick}
            whileHover={{ x: 3 }}
            className={cls}
            style={style}
        >
            <RichText text={label} as="span" />
        </motion.a>
    )
}

// ── Banner variant ───────────────────────────────────────────────────────────
// Plan 260415 Lỗi 8C + 9C — banner giờ có `onInverseBg=true` cho CTA buttons,
// đảm bảo primary button dùng white bg + primary text (không white-on-white).
// Gradient từ brand-primary → brand-secondary vẫn ok vì primary + secondary
// trong theme resolver luôn là 2 màu khác nhau (secondary fallback `#d946ef`).

function BannerVariant({ block, siteId }: { block: CTAConfig; siteId?: string }) {
    const { headline, subheadline, ctaLabel, ctaUrl, ctaStyle = 'primary', secondaryCtaLabel, secondaryCtaUrl } = block
    return (
        <AnimatedSection
            className="py-20 md:py-28"
            style={{
                background: 'linear-gradient(135deg, var(--brand-primary), var(--brand-secondary))',
                color: '#ffffff',
            }}
        >
            <div className={`${CTA_CONTAINER} text-center max-w-3xl`}>
                <Heading level={2} className="mb-4 leading-tight">
                    <RichText text={headline} as="span" />
                </Heading>
                {subheadline && (
                    <Body size="lg" className="opacity-85 mb-8 max-w-xl mx-auto">
                        <RichText text={subheadline} as="span" />
                    </Body>
                )}
                <div className="flex flex-wrap items-center justify-center gap-4">
                    <CTAButton label={ctaLabel} url={ctaUrl} style={ctaStyle} variant="banner" siteId={siteId} onInverseBg />
                    {secondaryCtaLabel && secondaryCtaUrl && (
                        <SecondaryCTAButton label={secondaryCtaLabel} url={secondaryCtaUrl} siteId={siteId} onInverseBg />
                    )}
                </div>
            </div>
        </AnimatedSection>
    )
}

// ── Inline variant ───────────────────────────────────────────────────────────
// Plan 260415 Lỗi 5C — text container có max-width để headline dài không vỡ
// layout flex-row (button vẫn flex-shrink-0).

function InlineVariant({ block, siteId }: { block: CTAConfig; siteId?: string }) {
    const { headline, subheadline, ctaLabel, ctaUrl, ctaStyle = 'primary', secondaryCtaLabel, secondaryCtaUrl } = block
    return (
        <AnimatedSection className="py-12 md:py-16" style={{ color: CSS_VARS.text, background: CSS_VARS.surface }}>
            <div className={CTA_CONTAINER}>
                <div className="flex flex-col md:flex-row items-center justify-between gap-6 max-w-5xl mx-auto">
                    <div className="flex-1 max-w-2xl text-center md:text-left">
                        <Heading level={3} className="mb-2">
                            <RichText text={headline} as="span" />
                        </Heading>
                        {subheadline && (
                            <Body style={{ color: CSS_VARS.muted }}>
                                <RichText text={subheadline} as="span" />
                            </Body>
                        )}
                    </div>
                    <div className="flex-shrink-0 flex flex-wrap items-center gap-3 justify-center">
                        <CTAButton label={ctaLabel} url={ctaUrl} style={ctaStyle} variant="inline" siteId={siteId} />
                        {secondaryCtaLabel && secondaryCtaUrl && (
                            <SecondaryCTAButton label={secondaryCtaLabel} url={secondaryCtaUrl} siteId={siteId} />
                        )}
                    </div>
                </div>
            </div>
        </AnimatedSection>
    )
}

// ── Card variant (renamed from "floating") ───────────────────────────────────
// Plan 260415 Decision 5 — variant `floating` cũ là card center with shadow
// (không thực sự floating). Rename thành `card`. Migration SQL:
// UPDATE cta SET variant='card' WHERE variant='floating' (xem db-setup.js).

function CardVariant({ block, siteId }: { block: CTAConfig; siteId?: string }) {
    const { headline, subheadline, ctaLabel, ctaUrl, ctaStyle = 'primary', secondaryCtaLabel, secondaryCtaUrl } = block
    return (
        <AnimatedSection className="py-16 md:py-20" style={{ color: CSS_VARS.text, background: CSS_VARS.background }}>
            <div className={CTA_CONTAINER}>
                <div
                    className="max-w-xl mx-auto text-center p-10 md:p-12"
                    style={{
                        background: CSS_VARS.surface,
                        borderRadius: CSS_VARS.radiusLg,
                        boxShadow: CSS_VARS.shadowLg,
                        border: '1px solid rgba(var(--brand-primary-rgb), 0.1)',
                    }}
                >
                    <Heading level={3} className="mb-3">
                        <RichText text={headline} as="span" />
                    </Heading>
                    {subheadline && (
                        <Body className="mb-8" style={{ color: CSS_VARS.muted }}>
                            <RichText text={subheadline} as="span" />
                        </Body>
                    )}
                    <div className="flex flex-wrap items-center justify-center gap-3">
                        <CTAButton label={ctaLabel} url={ctaUrl} style={ctaStyle} variant="card" siteId={siteId} />
                        {secondaryCtaLabel && secondaryCtaUrl && (
                            <SecondaryCTAButton label={secondaryCtaLabel} url={secondaryCtaUrl} siteId={siteId} />
                        )}
                    </div>
                </div>
            </div>
        </AnimatedSection>
    )
}

// ── Floating Sticky variant (REAL fixed bottom-right CTA) ────────────────────
// Plan 260415 Decision 5 + Lỗi E — real floating CTA với:
// - position: fixed bottom-right (desktop) / bottom full-width (mobile)
// - Scroll trigger: hiện sau 30% page scroll
// - Dismissible X button + localStorage 7-day memory
// - Respect prefers-reduced-motion

function FloatingStickyVariant({ block, siteId }: { block: CTAConfig; siteId?: string }) {
    const { headline, ctaLabel, ctaUrl, ctaStyle = 'primary' } = block
    const [visible, setVisible] = useState(false)
    const [dismissed, setDismissed] = useState(false)
    const shouldReduce = useReducedMotion()
    const storageKey = FLOATING_STORAGE_PREFIX + (siteId || 'default')

    // Check localStorage dismiss memory on mount
    useEffect(() => {
        if (typeof window === 'undefined') return
        try {
            const dismissedAt = localStorage.getItem(storageKey)
            if (dismissedAt) {
                const elapsed = Date.now() - parseInt(dismissedAt, 10)
                if (elapsed < FLOATING_DISMISS_DURATION_MS) {
                    setDismissed(true)
                    return
                }
            }
        } catch {
            // Ignore storage errors
        }
    }, [storageKey])

    // Scroll trigger — show after user scrolls 30% of page
    useEffect(() => {
        if (dismissed || typeof window === 'undefined') return

        const handleScroll = () => {
            const scrollTop = window.scrollY
            const pageHeight = document.documentElement.scrollHeight - window.innerHeight
            if (pageHeight > 0 && scrollTop / pageHeight > 0.3) {
                setVisible(true)
            }
        }

        handleScroll()
        window.addEventListener('scroll', handleScroll, { passive: true })
        return () => window.removeEventListener('scroll', handleScroll)
    }, [dismissed])

    const handleDismiss = useCallback(() => {
        setDismissed(true)
        setVisible(false)
        try {
            localStorage.setItem(storageKey, String(Date.now()))
        } catch {
            // Ignore
        }
    }, [storageKey])

    if (dismissed || !visible) return null

    const content = (
        <div
            className="fixed bottom-4 inset-x-4 md:inset-x-auto md:right-6 md:bottom-6 md:max-w-sm z-50 rounded-2xl p-5 pr-12 shadow-2xl"
            style={{
                background: CSS_VARS.surface,
                border: '1px solid rgba(var(--brand-primary-rgb), 0.15)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
            }}
            role="complementary"
            aria-label="Call to action"
        >
            <button
                type="button"
                onClick={handleDismiss}
                className={`absolute top-2 right-2 p-2 rounded-full opacity-60 hover:opacity-100 transition-opacity ${TOUCH_TARGET.min} flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(var(--brand-primary-rgb),0.4)]`}
                aria-label="Dismiss call to action"
            >
                <X size={16} />
            </button>
            <Heading level={4} className="mb-2 pr-2">
                <RichText text={headline} as="span" />
            </Heading>
            <CTAButton label={ctaLabel} url={ctaUrl} style={ctaStyle} variant="floating-sticky" siteId={siteId} />
        </div>
    )

    if (shouldReduce) return content

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        >
            {content}
        </motion.div>
    )
}

export function CTABlock({ block, site }: BlockProps<CTAConfig>) {
    // Plan 260415 Lỗi 13C — safer String cast
    const siteId = site?.id != null ? String(site.id) : undefined

    // Plan 260415 Decision 5 — legacy 'floating' (old name) → render card variant
    // để existing sites chưa migrate vẫn render đúng layout card center.
    // Sau migration SQL, mọi row sẽ có variant='card' hoặc 'floating-sticky'.
    const variant = block.variant as string
    const normalizedVariant = variant === 'floating' ? 'card' : variant

    switch (normalizedVariant) {
        case 'inline':
            return <InlineVariant block={block} siteId={siteId} />
        case 'card':
            return <CardVariant block={block} siteId={siteId} />
        case 'floating-sticky':
            return <FloatingStickyVariant block={block} siteId={siteId} />
        case 'banner':
        default:
            return <BannerVariant block={block} siteId={siteId} />
    }
}
