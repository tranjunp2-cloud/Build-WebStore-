'use client'

import type { ReactNode } from 'react'
import { motion } from 'framer-motion'
import type { HeroConfig } from './config'
import { RichText } from '../shared/RichText'
import { CONTAINER, INNER_PADDING, TOUCH_TARGET } from '@/lib/design-tokens'
import { BROKEN_URL_PREFIX } from '@/lib/navigation-url'
import { useLocalHref } from '@/lib/hooks/use-local-href'
import { trackEvent } from '@/lib/analytics/track-event'
import { useIsOwner } from '@/components/site-renderer/OwnerContext'
import { BrokenLinkWarning } from '@/blocks/shared/BrokenLinkWarning'
import { SmartLink } from '@/blocks/_shared/smart-link'

const MotionSmartLink = motion.create(SmartLink)

// Token shortcut: hero containers consume CONTAINER.default + INNER_PADDING.
export const HERO_CONTAINER = `${CONTAINER.default} mx-auto ${INNER_PADDING}`

/**
 * Plan 260415 Lỗi E — hero min-h responsive: mobile 75vh (không tràn dưới
 * dải gesture iOS), desktop 92vh giữ cinematic feel. Các variants dùng helper
 * này thay vì hardcode `min-h-[92vh]`.
 */
export const HERO_MIN_HEIGHT = 'min-h-[75vh] md:min-h-[92vh]'

/**
 * Plan 260415 Lỗi D — alt text helper cho hero images. headline có thể là
 * Lexical JSON object (từ RichText editor) → render trực tiếp cho alt sẽ
 * thành "[object Object]". Check type trước khi dùng headline làm fallback.
 * Ưu tiên image.alt, rồi plain string headline, cuối cùng generic "Hero image".
 */
export function safeAltText(imageAlt: string | undefined, headline: unknown): string {
    if (imageAlt && typeof imageAlt === 'string') return imageAlt
    if (typeof headline === 'string' && headline.trim()) return headline
    return 'Hero image'
}

// ── Shared CTA renderer ──────────────────────────────────────────────────────
// CTA button has px-8 py-4 = ~56px effective height (passes WCAG 2.5.5).
// TOUCH_TARGET.min added explicitly as a guarantee in case future restyles
// shrink the padding. siteId prop threads through for click tracking.
export function CTAButtons({ buttons, variant = 'default', siteId }: { buttons: HeroConfig['ctaButtons']; variant?: 'default' | 'glass'; siteId?: string }) {
    const isOwner = useIsOwner()
    const resolveHref = useLocalHref()
    if (!buttons || buttons.length === 0) return null

    return (
        <div className="flex flex-wrap gap-4">
            {buttons.map((btn, i) => {
                const rawUrl = btn?.url
                const isBroken = rawUrl?.startsWith(BROKEN_URL_PREFIX)
                const href = resolveHref(isBroken ? '#' : rawUrl)
                const isExternal = !isBroken && !!rawUrl && (rawUrl.startsWith('http://') || rawUrl.startsWith('https://'))
                return (
                <BrokenLinkWarning key={i} url={rawUrl} rounded="rounded-xl">
                <MotionSmartLink
                    href={href}
                    {...(isExternal ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                    onClick={() => {
                        if (siteId) trackEvent({ siteId, event: 'click', metadata: { label: btn.label, url: btn?.url, variant: 'hero' }, isOwner })
                    }}
                    whileHover={{ scale: 1.03, y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    className={`px-8 py-4 rounded-xl font-semibold text-sm transition-all duration-300 ${TOUCH_TARGET.min} inline-flex items-center justify-center`}
                    style={btn.style === 'outline'
                        ? variant === 'glass'
                            ? {
                                border: '2px solid rgba(255,255,255,0.3)',
                                color: '#fff',
                                background: 'rgba(255,255,255,0.05)',
                                backdropFilter: 'blur(8px)',
                            }
                            : {
                                border: `2px solid rgba(var(--brand-primary-rgb), 0.314)`,
                                color: 'var(--brand-primary)',
                                background: `rgba(var(--brand-primary-rgb), 0.031)`,
                            }
                        : variant === 'glass'
                            ? {
                                background: 'rgba(255,255,255,0.15)',
                                backdropFilter: 'blur(12px)',
                                color: '#fff',
                                border: '1px solid rgba(255,255,255,0.2)',
                                boxShadow: '0 8px 30px rgba(0,0,0,0.2)',
                            }
                            : {
                                background: `linear-gradient(135deg, var(--brand-primary), rgba(var(--brand-primary-rgb), 0.800))`,
                                color: '#fff',
                                boxShadow: `0 8px 30px rgba(var(--brand-primary-rgb), 0.208)`,
                            }}
                >
                    <RichText text={btn.label} as="span" />
                </MotionSmartLink>
                </BrokenLinkWarning>
                )
            })}
        </div>
    )
}

// ── Shared HeroBadge — glass-style pill badge ───────────────────────────────
// Used by 5 hero variants (cards-overlay, gradient, parallax, slideshow,
// video) which render a translucent badge over a dark image/gradient bg.
// Replaces 5 copies of the same 13-line inline div.

type HeroBadgeProps = {
    text: string
    className?: string
}

export function HeroBadge({ text, className = 'mb-6' }: HeroBadgeProps) {
    return (
        <div
            className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold uppercase tracking-widest ${className}`.trim()}
            style={{
                background: 'rgba(255,255,255,0.1)',
                color: '#fff',
                border: '1px solid rgba(255,255,255,0.2)',
            }}
        >
            <span className="w-1.5 h-1.5 rounded-full bg-white" aria-hidden="true" />
            <RichText text={text} />
        </div>
    )
}

// ── Shared VideoControlButton — play/pause toggle ──────────────────────────
// Used by video + split-video hero variants. TOUCH_TARGET.min ensures the
// 40px (w-10 h-10) original size is bumped to 44×44 hit area without
// disturbing the visual — the icon stays at its current size.

type VideoControlButtonProps = {
    isPlaying: boolean
    onClick: () => void
    className?: string
    iconSize?: 14 | 16
}

export function VideoControlButton({ isPlaying, onClick, className = '', iconSize = 14 }: VideoControlButtonProps) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`${TOUCH_TARGET.min} min-w-[44px] rounded-full flex items-center justify-center transition-all ${className}`.trim()}
            style={{
                background: 'rgba(0,0,0,0.5)',
                backdropFilter: 'blur(8px)',
                color: '#fff',
                border: '1px solid rgba(255,255,255,0.2)',
            }}
            aria-label={isPlaying ? 'Pause video' : 'Play video'}
        >
            {isPlaying ? (
                <svg width={iconSize} height={iconSize} viewBox="0 0 14 14" fill="currentColor" aria-hidden="true">
                    <rect x="2" y="1" width="3.5" height="12" rx="1" />
                    <rect x="8.5" y="1" width="3.5" height="12" rx="1" />
                </svg>
            ) : (
                <svg width={iconSize} height={iconSize} viewBox="0 0 14 14" fill="currentColor" aria-hidden="true">
                    <path d="M3 1.5v11l9-5.5L3 1.5z" />
                </svg>
            )}
        </button>
    )
}

// ── Shared SlideshowDot — touch-friendly dot indicator ─────────────────────
// Compact 24px-wide targets keep dots close, with 44px height for tapping.

export { SlideshowDot } from '../shared/slideshow-controls'

// Re-export ReactNode so variants don't need separate imports
export type { ReactNode }
