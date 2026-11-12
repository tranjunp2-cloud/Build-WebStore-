'use client'

import { useState, useEffect, useCallback, useRef, type ReactNode } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { BlockProps } from '../types'
import { TESTIMONIAL_INVITE_TITLE, type TestimonialsConfig, type TestimonialItem } from './config'
import { AnimatedSection, StaggerGrid, StaggerItem, HoverCard } from '../shared/animations'
import {
    AvatarRing,
    GradientBlob,
    LayeredShapes,
    NoiseTexture,
    TypographicMark,
} from '../shared/decorative'
import { getTeamAvatar } from '@/lib/images/industry-images'
import { CSS_VARS } from '@/lib/theme/resolve'
import { RichText } from '../shared/RichText'
import { Heading, Body, Caption } from '../shared/Typography'
import { CONTAINER, INNER_PADDING, SECTION_PADDING, TOUCH_TARGET, CARD_PADDING } from '@/lib/design-tokens'
import { MediaUploadOverlay } from '@/blocks/shared/media-upload-overlay'


// ── Local helpers (Phase 05 refactor) ───────────────────────────────────────
// Extract structural duplication across 8 variants. Brand identity vars
// (--brand-primary, --brand-primary-rgb) preserved per Option C additive.

const TESTIMONIALS_CONTAINER = `${CONTAINER.default} mx-auto ${INNER_PADDING}`
const TESTIMONIALS_DEFAULT_HEADLINE = 'What Our Clients Say'

type TestimonialsSectionProps = {
    showBlob?: boolean
    className?: string
    children: ReactNode
    decorative?: ReactNode
}

/**
 * Outer wrapper used by all 8 variants. Phase A4 (260417) — `decorative` slot
 * lets each variant pin its own visual vocabulary; falls back to GradientBlob.
 * `showBlob={false}` still suppresses any decoration (used by simple variant).
 */
function TestimonialsSection({ showBlob = true, className = '', children, decorative }: TestimonialsSectionProps) {
    return (
        <AnimatedSection className={`${SECTION_PADDING.default} relative overflow-hidden ${className}`.trim()}>
            {showBlob && (decorative ?? (
                <GradientBlob color={CSS_VARS.primary} className="bottom-[0%] left-[-5%]" size={400} opacity={0.06} />
            ))}
            <div className={`${TESTIMONIALS_CONTAINER} relative z-10`}>
                {children}
            </div>
        </AnimatedSection>
    )
}

type TestimonialsHeaderProps = {
    headline?: string
    subtitle?: string
    showSubtitle?: boolean
    className?: string
}

/** Section header used by all 8 variants — h2 + optional subtitle. */
function TestimonialsHeader({
    headline,
    subtitle,
    showSubtitle = false,
    className = 'text-center max-w-2xl mx-auto mb-16',
}: TestimonialsHeaderProps) {
    return (
        <div className={className}>
            <Heading level={2} className="mb-4">
                {headline || TESTIMONIALS_DEFAULT_HEADLINE}
            </Heading>
            {showSubtitle && subtitle && (
                <Body size="lg" className="opacity-40">{subtitle}</Body>
            )}
        </div>
    )
}

type StarRatingProps = {
    count?: number
    size?: 'sm' | 'lg'
    className?: string
}

/** Star rating row — used in 6 variants. */
function StarRating({ count = 5, size = 'sm', className = 'flex gap-0.5 mb-4' }: StarRatingProps) {
    const cls = size === 'lg' ? 'text-lg' : 'text-sm'
    return (
        <div className={className}>
            {Array.from({ length: count }).map((_, j) => (
                <span key={j} className={cls} style={{ color: 'var(--brand-primary)' }} aria-hidden="true">&#9733;</span>
            ))}
        </div>
    )
}

type AuthorMetaProps = {
    name: string
    title?: string
    company?: string
    avatar?: { url?: string }
    fallbackSrc?: string
    avatarSize?: number
    layout?: 'inline' | 'stacked'
    nameWeight?: 'semibold' | 'bold'
    showAvatar?: boolean
    imageIndex?: number
    className?: string
}

/** Avatar + name + title — used 8+ times across variants. */
function AuthorMeta({
    name,
    title,
    company,
    avatar,
    fallbackSrc,
    avatarSize = 44,
    layout = 'inline',
    nameWeight = 'semibold',
    showAvatar = true,
    imageIndex,
    className = '',
}: AuthorMetaProps) {
    const subtitle = (title || company) ? [title, company].filter(Boolean).join(' \u2022 ') : undefined
    const nameClass = nameWeight === 'bold' ? 'font-bold' : 'font-semibold text-sm'

    if (layout === 'stacked') {
        return (
            <div className={className}>
                <RichText text={name} as="p" className={nameClass} />
                {subtitle && (
                    <Caption className="opacity-45 mt-1">{subtitle}</Caption>
                )}
            </div>
        )
    }

    return (
        <div className={`flex items-center gap-3 ${className}`.trim()}>
            {showAvatar && (
                imageIndex !== undefined ? (
                    <MediaUploadOverlay
                        field={`testimonials.${imageIndex}.avatar`}
                        altText={name}
                        valueShape="media"
                        buttonPosition="top-center"
                        positionClass="relative inline-block"
                    >
                        <AvatarRing color={CSS_VARS.primary} src={avatar?.url || fallbackSrc} name={name} size={avatarSize} imageIndex={imageIndex} />
                    </MediaUploadOverlay>
                ) : (
                    <AvatarRing color={CSS_VARS.primary} src={avatar?.url || fallbackSrc} name={name} size={avatarSize} imageIndex={imageIndex} />
                )
            )}
            <div>
                <RichText text={name} as="p" className={nameClass} />
                {subtitle && (
                    <Caption className="opacity-45 block">{subtitle}</Caption>
                )}
            </div>
        </div>
    )
}

type DotIndicatorProps = {
    count: number
    activeIndex: number
    onSelect: (i: number) => void
    label?: (i: number) => string
    className?: string
}

/**
 * Touch-friendly dot indicator. Visual dot is 10px but clickable area is
 * 44×44px (WCAG 2.5.5) via padding. Used by 4 variants (spotlight mobile,
 * minimal-quote, carousel, avatar-row indirectly).
 */
function DotIndicator({ count, activeIndex, onSelect, label = (i) => `View item ${i + 1}`, className = 'flex justify-center gap-2' }: DotIndicatorProps) {
    return (
        <div className={className}>
            {Array.from({ length: count }).map((_, i) => (
                <button
                    key={`dot-${i}`}
                    type="button"
                    onClick={() => onSelect(i)}
                    className={`${TOUCH_TARGET.min} min-w-[44px] flex items-center justify-center rounded-full transition-all duration-200`}
                    aria-label={label(i)}
                    aria-current={i === activeIndex}
                >
                    <span
                        className="w-2.5 h-2.5 rounded-full transition-all duration-200"
                        style={{
                            background: i === activeIndex ? 'var(--brand-primary)' : 'rgba(var(--brand-primary-rgb), 0.2)',
                        }}
                    />
                </button>
            ))}
        </div>
    )
}

type CarouselArrowProps = {
    direction: 'prev' | 'next'
    onClick: () => void
    className?: string
}

/** Carousel arrow with TOUCH_TARGET.min (was w-10 h-10 = 40px ❌). */
function CarouselArrow({ direction, onClick, className = '' }: CarouselArrowProps) {
    const positionCls = direction === 'prev' ? '-left-4 md:-left-10' : '-right-4 md:-right-10'
    return (
        <button
            type="button"
            onClick={onClick}
            className={`absolute ${positionCls} top-1/2 -translate-y-1/2 z-20 ${TOUCH_TARGET.min} min-w-[44px] flex items-center justify-center rounded-full border transition-opacity duration-200 hover:opacity-80 ${className}`.trim()}
            style={{
                background: 'rgba(var(--brand-primary-rgb), 0.06)',
                borderColor: 'rgba(var(--brand-primary-rgb), 0.15)',
                color: 'var(--brand-primary)',
            }}
            aria-label={direction === 'prev' ? 'Previous testimonial' : 'Next testimonial'}
        >
            {direction === 'prev' ? '\u2190' : '\u2192'}
        </button>
    )
}

/** Drops the generated invitation card whenever at least one real review exists. */
export function withoutInviteWhenReal(items: TestimonialItem[]): TestimonialItem[] {
    const real = items.filter((t) => t?.title !== TESTIMONIAL_INVITE_TITLE)
    return real.length > 0 ? real : items
}

export function TestimonialsBlock({ block, theme, site }: BlockProps<TestimonialsConfig>) {
    const { headline, subheadline, testimonials: rawTestimonials = [] } = block
    // The invitation card only stands in for missing reviews: once a real one exists it must never be
    // printed as a review (every variant), so it is dropped here before any variant renders.
    const testimonials = withoutInviteWhenReal(rawTestimonials)
    const variant = block.variant || 'cards'
    const category = (site?.siteType as string) || 'business'
    const s3Map = site?.imageLibraryS3 as Record<string, string> | undefined

    /* Plan 260415 Lỗi G — empty state dev console.warn + early return */
    if (!testimonials.length) {
        if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
            console.warn('[testimonials] testimonials array empty — block rendered nothing')
        }
        return null
    }

    // #2103 A1: the generated invitation card is not a review — no stars, name or avatar.
    if (testimonials.length === 1 && testimonials[0]?.title === TESTIMONIAL_INVITE_TITLE) {
        return (
            <TestimonialsSection showBlob={false}>
                <TestimonialsHeader headline={headline} />
                <div
                    className="mx-auto max-w-xl rounded-2xl p-8 text-center"
                    style={{
                        border: '1px solid rgba(var(--brand-primary-rgb), 0.2)',
                        background: 'rgba(var(--brand-primary-rgb), 0.04)',
                    }}
                >
                    <Body size="lg">{testimonials[0].quote}</Body>
                </div>
            </TestimonialsSection>
        )
    }

    // ── masonry variant ───────────────────────────────────────────────────
    if (variant === 'masonry') {
        return (
            <TestimonialsSection decorative={<NoiseTexture opacity={0.06} />}>
                <TestimonialsHeader headline={headline} subtitle={subheadline} showSubtitle />
                <div className="columns-1 md:columns-2 lg:columns-3 gap-6 space-y-6">
                    {testimonials.map((t, i) => (
                        <motion.div
                            key={`${t.name || 'testimonial'}-${i}`}
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: i * 0.08, duration: 0.4 }}
                            className={`break-inside-avoid ${CARD_PADDING.md} rounded-2xl transition-shadow duration-300 hover:shadow-xl`}
                            style={{
                                background: 'linear-gradient(160deg, rgba(var(--brand-primary-rgb), 0.031), transparent 60%)',
                                border: '1px solid rgba(var(--brand-primary-rgb), 0.063)',
                            }}
                        >
                            <StarRating count={t.rating || 5} />
                            <Body className="opacity-70 mb-6 italic">
                                &ldquo;{t.quote}&rdquo;
                            </Body>
                            <AuthorMeta
                                name={t.name}
                                title={t.title}
                                company={t.company}
                                avatar={t.avatar}
                                fallbackSrc={getTeamAvatar(category, i, s3Map)}
                                avatarSize={40}
                                imageIndex={i}
                            />
                        </motion.div>
                    ))}
                </div>
            </TestimonialsSection>
        )
    }

    // ── spotlight variant ─────────────────────────────────────────────────
    if (variant === 'spotlight') {
        return <TestimonialsSpotlight headline={headline} testimonials={testimonials} theme={theme} category={category} s3Map={s3Map} />
    }

    // ── minimal-quote variant ─────────────────────────────────────────────
    if (variant === 'minimal-quote') {
        return <TestimonialsMinimalQuote headline={headline} testimonials={testimonials} theme={theme} category={category} s3Map={s3Map} />
    }

    // ── avatar-row variant ────────────────────────────────────────────────
    if (variant === 'avatar-row') {
        return <TestimonialsAvatarRow headline={headline} testimonials={testimonials} theme={theme} category={category} s3Map={s3Map} />
    }

    // ── video-text variant ────────────────────────────────────────────────
    if (variant === 'video-text') {
        return (
            <TestimonialsSection>
                <TestimonialsHeader headline={headline} />
                <StaggerGrid className="flex flex-col gap-12 max-w-5xl mx-auto">
                    {testimonials.map((t, i) => {
                        const videoUrl = (t as TestimonialItem & { videoUrl?: string }).videoUrl
                        return (
                            <StaggerItem key={`${t.name || 'testimonial'}-${i}`}>
                                <div className={`grid grid-cols-1 md:grid-cols-2 gap-8 items-center ${i % 2 === 1 ? 'md:direction-rtl' : ''}`}>
                                    {/* Video / avatar side */}
                                    <div
                                        className={`aspect-video rounded-2xl overflow-hidden flex items-center justify-center relative ${i % 2 === 1 ? 'md:order-2' : ''}`}
                                        style={{
                                            background: 'rgba(var(--brand-primary-rgb), 0.05)',
                                            border: '1px solid rgba(var(--brand-primary-rgb), 0.1)',
                                        }}
                                    >
                                        {videoUrl ? (
                                            <>
                                                <div className="absolute inset-0 bg-black/20" />
                                                <div
                                                    className="relative z-10 w-16 h-16 rounded-full flex items-center justify-center cursor-pointer transition-transform hover:scale-110"
                                                    style={{ background: 'var(--brand-primary)', color: '#fff' }}
                                                >
                                                    <span className="text-2xl ml-1">&#9654;</span>
                                                </div>
                                            </>
                                        ) : (
                                            <MediaUploadOverlay
                                                field={`testimonials.${i}.avatar`}
                                                altText={t.name}
                                                valueShape="media"
                                                buttonPosition="top-center"
                                                positionClass="relative inline-block"
                                            >
                                                <AvatarRing color={CSS_VARS.primary} src={t.avatar?.url || getTeamAvatar(category, i, s3Map)} name={t.name} size={120} imageIndex={i} />
                                            </MediaUploadOverlay>
                                        )}
                                    </div>
                                    {/* Text side */}
                                    <div className={i % 2 === 1 ? 'md:order-1' : ''}>
                                        <StarRating count={t.rating || 5} />
                                        <Body size="lg" className="opacity-70 mb-6 italic">
                                            &ldquo;{t.quote}&rdquo;
                                        </Body>
                                        <AuthorMeta
                                            name={t.name}
                                            title={t.title}
                                            company={t.company}
                                            avatar={t.avatar}
                                            fallbackSrc={getTeamAvatar(category, i, s3Map)}
                                            avatarSize={44}
                                            imageIndex={i}
                                        />
                                    </div>
                                </div>
                            </StaggerItem>
                        )
                    })}
                </StaggerGrid>
            </TestimonialsSection>
        )
    }

    // ── carousel variant ───────────────────────────────────────────────
    if (variant === 'carousel') {
        return <TestimonialsCarousel headline={headline} subheadline={subheadline} testimonials={testimonials} theme={theme} category={category} s3Map={s3Map} />
    }

    // ── simple variant ───────────────────────────────────────────────────
    if (variant === 'simple') {
        return (
            <TestimonialsSection showBlob={false}>
                <TestimonialsHeader headline={headline} />
                <div className="max-w-3xl mx-auto flex flex-col gap-10">
                    {testimonials.map((t, i) => (
                        <motion.div
                            key={`${t.name || 'testimonial'}-${i}`}
                            initial={{ opacity: 0, y: 16 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: i * 0.08, duration: 0.4 }}
                        >
                            <blockquote
                                className="text-lg md:text-xl italic leading-relaxed opacity-70 mb-3"
                                style={{ borderLeft: `3px solid rgba(var(--brand-primary-rgb), 0.3)`, paddingLeft: '1.25rem' }}
                            >
                                {t.quote}
                            </blockquote>
                            <Body size="small" className="font-medium opacity-60 pl-5">
                                &mdash; {t.name}{(t.title || t.company) ? `, ${[t.title, t.company].filter(Boolean).join(' at ')}` : ''}
                            </Body>
                        </motion.div>
                    ))}
                </div>
            </TestimonialsSection>
        )
    }

    // ── grid variant ──────────────────────────────────────────────────────
    if (variant === 'grid') {
        return (
            <TestimonialsSection decorative={<GradientBlob color={CSS_VARS.primary} className="top-[10%] right-[-5%]" size={350} opacity={0.05} />}>
                <TestimonialsHeader headline={headline} subtitle={subheadline} showSubtitle />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {testimonials.map((t, i) => (
                        <motion.div
                            key={`${t.name || 'testimonial'}-${i}`}
                            initial={{ opacity: 0, y: 16 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: i * 0.06, duration: 0.4 }}
                            className="flex gap-4 p-5 rounded-xl"
                            style={{
                                background: 'rgba(var(--brand-primary-rgb), 0.025)',
                                border: '1px solid rgba(var(--brand-primary-rgb), 0.063)',
                                borderLeft: '3px solid rgba(var(--brand-primary-rgb), 0.3)',
                            }}
                        >
                            <div className="shrink-0 mt-1">
                                <MediaUploadOverlay
                                    field={`testimonials.${i}.avatar`}
                                    altText={t.name}
                                    valueShape="media"
                                    buttonPosition="top-center"
                                    positionClass="relative inline-block"
                                >
                                    <AvatarRing
                                        color={CSS_VARS.primary}
                                        src={t.avatar?.url || getTeamAvatar(category, i, s3Map)}
                                        name={t.name}
                                        size={40}
                                        imageIndex={i}
                                    />
                                </MediaUploadOverlay>
                            </div>
                            <div className="flex-1 min-w-0">
                                <StarRating count={t.rating || 5} className="flex gap-0.5 mb-2" />
                                <Body size="small" className="opacity-70 italic mb-3 line-clamp-4">
                                    &ldquo;{t.quote}&rdquo;
                                </Body>
                                <AuthorMeta
                                    name={t.name}
                                    title={t.title}
                                    company={t.company}
                                    showAvatar={false}
                                    layout="stacked"
                                />
                            </div>
                        </motion.div>
                    ))}
                </div>
            </TestimonialsSection>
        )
    }

    // ── single variant ────────────────────────────────────────────────────
    if (variant === 'single') {
        return <TestimonialsSingle headline={headline} testimonials={testimonials} category={category} s3Map={s3Map} />
    }

    // ── Default: cards variant ────────────────────────────────────────────
    return (
        <TestimonialsSection decorative={<LayeredShapes color={CSS_VARS.primary} opacity={0.1} />}>
            <TestimonialsHeader headline={headline} subtitle={subheadline} showSubtitle />
            <StaggerGrid className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {testimonials.map((t, i) => (
                    <StaggerItem key={`${t.name || 'testimonial'}-${i}`}>
                        <HoverCard
                            className={`${CARD_PADDING.lg} rounded-2xl h-full relative group transition-shadow duration-300 hover:shadow-xl`}
                            style={{
                                background: `linear-gradient(160deg, rgba(var(--brand-primary-rgb), 0.031), transparent 60%)`,
                                border: `1px solid rgba(var(--brand-primary-rgb), 0.063)`,
                            }}
                        >
                            {/* Decorative quote mark */}
                            <div
                                className="absolute top-4 right-6 text-6xl font-serif leading-none opacity-[0.06] select-none"
                                style={{ color: 'var(--brand-primary)' }}
                                aria-hidden="true"
                            >
                                &ldquo;
                            </div>

                            <StarRating count={t.rating || 5} className="flex gap-0.5 mb-5" />

                            <Body className="opacity-70 mb-8 italic relative z-10">
                                &ldquo;{t.quote}&rdquo;
                            </Body>

                            <AuthorMeta
                                name={t.name}
                                title={t.title}
                                company={t.company}
                                avatar={t.avatar}
                                fallbackSrc={getTeamAvatar(category, i, s3Map)}
                                avatarSize={44}
                                imageIndex={i}
                                className="mt-auto"
                            />
                        </HoverCard>
                    </StaggerItem>
                ))}
            </StaggerGrid>
        </TestimonialsSection>
    )
}

// ── Spotlight sub-component ───────────────────────────────────────────────
function TestimonialsSpotlight({
    headline,
    testimonials,
    category,
    s3Map,
}: {
    headline?: string
    testimonials: TestimonialItem[]
    theme: BlockProps<TestimonialsConfig>['theme']
    category: string
    s3Map?: Record<string, string>
}) {
    const [centerIdx, setCenterIdx] = useState(0)

    if (testimonials.length === 0) return null
    const center = testimonials[centerIdx]
    const sides = testimonials.filter((_, i) => i !== centerIdx)

    const renderSideCard = (t: TestimonialItem) => {
        const origIdx = testimonials.indexOf(t)
        return (
            <motion.button
                key={origIdx}
                type="button"
                layoutId={`testimonial-${origIdx}`}
                onClick={() => setCenterIdx(origIdx)}
                className={`text-left ${CARD_PADDING.sm} rounded-xl cursor-pointer transition-shadow duration-200 hover:shadow-lg ${TOUCH_TARGET.min}`}
                style={{
                    background: 'rgba(var(--brand-primary-rgb), 0.02)',
                    border: '1px solid rgba(var(--brand-primary-rgb), 0.06)',
                }}
                aria-label={`View ${t.name}'s testimonial`}
            >
                <Body size="small" className="opacity-60 italic line-clamp-3">&ldquo;{t.quote}&rdquo;</Body>
                <Caption className="font-semibold mt-2 opacity-70 block">{t.name}</Caption>
            </motion.button>
        )
    }

    return (
        <TestimonialsSection decorative={<TypographicMark text="“" color={CSS_VARS.primary} opacity={0.05} size="xl" />}>
            <TestimonialsHeader headline={headline} />
            <div className="flex flex-col lg:flex-row items-center gap-8 max-w-5xl mx-auto">
                {/* Flanking — left */}
                <div className="hidden lg:flex flex-col gap-4 flex-1">
                    {sides.filter((_, i) => i % 2 === 0).map(renderSideCard)}
                </div>

                {/* Center spotlight */}
                <AnimatePresence mode="wait">
                    <motion.div
                        key={centerIdx}
                        layoutId={`testimonial-${centerIdx}`}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.3 }}
                        className="p-10 rounded-2xl text-center flex-shrink-0 w-full lg:w-[400px]"
                        style={{
                            background: 'linear-gradient(160deg, rgba(var(--brand-primary-rgb), 0.05), transparent 60%)',
                            border: '1px solid rgba(var(--brand-primary-rgb), 0.12)',
                            boxShadow: '0 8px 32px rgba(var(--brand-primary-rgb), 0.08)',
                        }}
                    >
                        <div className="flex justify-center mb-6">
                            <MediaUploadOverlay
                                field={`testimonials.${centerIdx}.avatar`}
                                altText={center.name}
                                valueShape="media"
                                buttonPosition="top-center"
                                positionClass="relative inline-block"
                            >
                                <AvatarRing color={CSS_VARS.primary} src={center.avatar?.url || getTeamAvatar(category, centerIdx, s3Map)} name={center.name} size={72} imageIndex={centerIdx} />
                            </MediaUploadOverlay>
                        </div>
                        <StarRating count={center.rating || 5} size="lg" className="flex justify-center gap-0.5 mb-4" />
                        <Body size="lg" className="opacity-70 mb-6 italic">
                            &ldquo;{center.quote}&rdquo;
                        </Body>
                        <RichText text={center.name} as="p" className="font-bold" />
                        {(center.title || center.company) && (
                            <Body size="small" className="opacity-45 mt-1">{[center.title, center.company].filter(Boolean).join(' \u2022 ')}</Body>
                        )}
                    </motion.div>
                </AnimatePresence>

                {/* Flanking — right */}
                <div className="hidden lg:flex flex-col gap-4 flex-1">
                    {sides.filter((_, i) => i % 2 === 1).map(renderSideCard)}
                </div>

                {/* Mobile: dot indicators */}
                <div className="lg:hidden">
                    <DotIndicator
                        count={testimonials.length}
                        activeIndex={centerIdx}
                        onSelect={setCenterIdx}
                        label={(i) => `View testimonial ${i + 1}`}
                        className="flex gap-2 mt-4"
                    />
                </div>
            </div>
        </TestimonialsSection>
    )
}

// ── Minimal Quote sub-component (auto-rotate) ────────────────────────────
function TestimonialsMinimalQuote({
    headline,
    testimonials,
    category,
    s3Map,
}: {
    headline?: string
    testimonials: TestimonialItem[]
    theme: BlockProps<TestimonialsConfig>['theme']
    category: string
    s3Map?: Record<string, string>
}) {
    const [currentIndex, setCurrentIndex] = useState(0)
    /* Plan 260415 Lỗi E — pause on hover/focus */
    const [isPaused, setIsPaused] = useState(false)

    useEffect(() => {
        if (testimonials.length <= 1 || isPaused) return
        // Respect prefers-reduced-motion
        const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
        if (mq.matches) return

        const timer = setInterval(() => {
            setCurrentIndex(prev => (prev + 1) % testimonials.length)
        }, 6000)
        return () => clearInterval(timer)
    }, [testimonials.length, isPaused])

    if (testimonials.length === 0) return null
    const t = testimonials[currentIndex]

    return (
        <TestimonialsSection>
            <TestimonialsHeader headline={headline} />
            <div
                className="max-w-3xl mx-auto text-center relative"
                onMouseEnter={() => setIsPaused(true)}
                onMouseLeave={() => setIsPaused(false)}
                onFocus={() => setIsPaused(true)}
                onBlur={() => setIsPaused(false)}
                role="region"
                aria-roledescription="carousel"
                aria-label="Customer testimonial"
            >
                {/* Large decorative quote mark */}
                <div
                    className="text-[12rem] font-serif leading-none select-none absolute -top-16 left-1/2 -translate-x-1/2 pointer-events-none"
                    style={{ color: 'rgba(var(--brand-primary-rgb), 0.08)' }}
                    aria-hidden="true"
                >
                    &ldquo;
                </div>

                <AnimatePresence mode="wait">
                    <motion.div
                        key={currentIndex}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.5 }}
                        className="relative z-10"
                        aria-live="polite"
                        aria-atomic="true"
                    >
                        {/* Plan 260415 Lỗi I — blockquote semantic */}
                        <blockquote className="text-2xl md:text-3xl italic opacity-70 leading-relaxed mb-8">
                            &ldquo;{t.quote}&rdquo;
                        </blockquote>
                        <div className="flex items-center justify-center gap-3">
                            <MediaUploadOverlay
                                field={`testimonials.${currentIndex}.avatar`}
                                altText={t.name}
                                valueShape="media"
                                buttonPosition="top-center"
                                positionClass="relative inline-block"
                            >
                                <AvatarRing color={CSS_VARS.primary} src={t.avatar?.url || getTeamAvatar(category, currentIndex, s3Map)} name={t.name} size={48} imageIndex={currentIndex} />
                            </MediaUploadOverlay>
                            <AuthorMeta
                                name={t.name}
                                title={t.title}
                                company={t.company}
                                showAvatar={false}
                                nameWeight="bold"
                                layout="stacked"
                                className="text-left"
                            />
                        </div>
                    </motion.div>
                </AnimatePresence>

                {testimonials.length > 1 && (
                    <DotIndicator
                        count={testimonials.length}
                        activeIndex={currentIndex}
                        onSelect={setCurrentIndex}
                        label={(i) => `View testimonial ${i + 1}`}
                        className="flex justify-center gap-2 mt-10"
                    />
                )}
            </div>
        </TestimonialsSection>
    )
}

// ── Carousel sub-component (auto-rotate, arrows, dots, fade) ────────────
function TestimonialsCarousel({
    headline,
    subheadline,
    testimonials,
    category,
    s3Map,
}: {
    headline?: string
    subheadline?: string
    testimonials: TestimonialItem[]
    theme: BlockProps<TestimonialsConfig>['theme']
    category: string
    s3Map?: Record<string, string>
}) {
    const [currentIndex, setCurrentIndex] = useState(0)
    /* Plan 260415 Lỗi E — pause on hover: state paused, clear timer khi hover */
    const [isPaused, setIsPaused] = useState(false)
    const touchStartX = useRef<number | null>(null)
    const touchStartY = useRef<number | null>(null)
    const touchDirectionLock = useRef<'horizontal' | 'vertical' | null>(null)
    const carouselRef = useRef<HTMLDivElement>(null)
    const resumeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
    // Ref keeps currentIndex readable inside the touch effect without forcing re-registration
    const currentIndexRef = useRef(currentIndex)
    currentIndexRef.current = currentIndex

    // BUG-TEST-019: pause auto-rotate on manual nav, resume after 5s
    const goTo = useCallback((idx: number) => {
        setIsPaused(true)
        if (resumeTimer.current) clearTimeout(resumeTimer.current)
        resumeTimer.current = setTimeout(() => setIsPaused(false), 5000)
        if (idx < 0) setCurrentIndex(testimonials.length - 1)
        else if (idx >= testimonials.length) setCurrentIndex(0)
        else setCurrentIndex(idx)
    }, [testimonials.length])

    useEffect(() => {
        if (testimonials.length <= 1 || isPaused) return
        const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
        if (mq.matches) return

        const timer = setInterval(() => {
            setCurrentIndex(prev => (prev + 1) % testimonials.length)
        }, 5000)
        return () => clearInterval(timer)
    }, [testimonials.length, isPaused])

    // Non-passive touch listeners so we can preventDefault() on horizontal swipe
    // to stop the page from scrolling while the user navigates the carousel.
    useEffect(() => {
        const el = carouselRef.current
        if (!el) return

        const onStart = (e: TouchEvent) => {
            touchStartX.current = e.touches[0]!.clientX
            touchStartY.current = e.touches[0]!.clientY
            touchDirectionLock.current = null
        }
        const onMove = (e: TouchEvent) => {
            if (touchStartX.current === null || touchStartY.current === null) return
            // Lock direction once at 10px threshold — prevents diagonal swipe from
            // triggering both page scroll and carousel navigation simultaneously.
            if (!touchDirectionLock.current) {
                const dx = Math.abs(e.touches[0]!.clientX - touchStartX.current)
                const dy = Math.abs(e.touches[0]!.clientY - touchStartY.current)
                if (dx > 10 || dy > 10)
                    touchDirectionLock.current = dx >= dy ? 'horizontal' : 'vertical'
            }
            if (touchDirectionLock.current === 'horizontal') e.preventDefault()
        }
        const onEnd = (e: TouchEvent) => {
            if (touchStartX.current === null) return
            const delta = e.changedTouches[0]!.clientX - touchStartX.current
            touchStartX.current = null
            touchStartY.current = null
            touchDirectionLock.current = null
            // Use ref so this closure stays correct across slide changes without re-registering
            if (Math.abs(delta) > 50) goTo(delta > 0 ? currentIndexRef.current - 1 : currentIndexRef.current + 1)
        }

        el.addEventListener('touchstart', onStart, { passive: true })
        el.addEventListener('touchmove', onMove, { passive: false })
        el.addEventListener('touchend', onEnd, { passive: true })
        return () => {
            el.removeEventListener('touchstart', onStart)
            el.removeEventListener('touchmove', onMove)
            el.removeEventListener('touchend', onEnd)
        }
    }, [goTo])  // goTo changes only when testimonials.length changes — no churn on slide transitions

    useEffect(() => {
        return () => { if (resumeTimer.current) clearTimeout(resumeTimer.current) }
    }, [])

    if (testimonials.length === 0) return null
    const t = testimonials[currentIndex]

    return (
        <TestimonialsSection>
            <TestimonialsHeader headline={headline} subtitle={subheadline} showSubtitle />
            {/* Plan 260415 Lỗi D + E — aria-live="polite" announce slide changes + pause on hover/focus */}
            {/* BUG-TEST-019 — non-passive touch listeners on carouselRef prevent page scroll on horizontal swipe */}
            <div
                ref={carouselRef}
                className="relative max-w-2xl mx-auto"
                onMouseEnter={() => setIsPaused(true)}
                onMouseLeave={() => setIsPaused(false)}
                onFocus={() => setIsPaused(true)}
                onBlur={() => setIsPaused(false)}
                role="region"
                aria-roledescription="carousel"
                aria-label="Customer testimonials"
            >
                {testimonials.length > 1 && (
                    <>
                        <CarouselArrow direction="prev" onClick={() => goTo(currentIndex - 1)} />
                        <CarouselArrow direction="next" onClick={() => goTo(currentIndex + 1)} />
                    </>
                )}

                {/* Single testimonial with fade transition */}
                <AnimatePresence mode="wait">
                    <motion.div
                        key={currentIndex}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.5 }}
                        className={`${CARD_PADDING.lg} md:p-10 rounded-2xl text-center`}
                        style={{
                            background: 'linear-gradient(160deg, rgba(var(--brand-primary-rgb), 0.031), transparent 60%)',
                            border: '1px solid rgba(var(--brand-primary-rgb), 0.063)',
                        }}
                        aria-live="polite"
                        aria-atomic="true"
                    >
                        <div className="flex justify-center mb-6">
                            <MediaUploadOverlay
                                field={`testimonials.${currentIndex}.avatar`}
                                altText={t.name}
                                valueShape="media"
                                buttonPosition="top-center"
                                positionClass="relative inline-block"
                            >
                                <AvatarRing color={CSS_VARS.primary} src={t.avatar?.url || getTeamAvatar(category, currentIndex, s3Map)} name={t.name} size={72} imageIndex={currentIndex} />
                            </MediaUploadOverlay>
                        </div>
                        <StarRating count={t.rating || 5} size="lg" className="flex justify-center gap-0.5 mb-5" />
                        <Body size="lg" className="italic opacity-70 mb-6">
                            &ldquo;{t.quote}&rdquo;
                        </Body>
                        <RichText text={t.name} as="p" className="font-bold" />
                        {(t.title || t.company) && (
                            <Body size="small" className="opacity-45 mt-1">{[t.title, t.company].filter(Boolean).join(' \u2022 ')}</Body>
                        )}
                    </motion.div>
                </AnimatePresence>

                {testimonials.length > 1 && (
                    <DotIndicator
                        count={testimonials.length}
                        activeIndex={currentIndex}
                        onSelect={setCurrentIndex}
                        label={(i) => `View testimonial ${i + 1}`}
                        className="flex justify-center gap-2 mt-8"
                    />
                )}
            </div>
        </TestimonialsSection>
    )
}

// ── Avatar Row sub-component ──────────────────────────────────────────────
function TestimonialsAvatarRow({
    headline,
    testimonials,
    category,
    s3Map,
}: {
    headline?: string
    testimonials: TestimonialItem[]
    theme: BlockProps<TestimonialsConfig>['theme']
    category: string
    s3Map?: Record<string, string>
}) {
    const [selectedIndex, setSelectedIndex] = useState(0)

    if (testimonials.length === 0) return null
    const selected = testimonials[selectedIndex]

    return (
        <TestimonialsSection>
            <TestimonialsHeader headline={headline} />

            {/* Avatar row — buttons are 56px (>44px touch target ✅) */}
            <div className="flex justify-center gap-4 mb-10 flex-wrap">
                {testimonials.map((t, i) => (
                    <button
                        key={`${t.name || 'testimonial'}-${i}`}
                        type="button"
                        onClick={() => setSelectedIndex(i)}
                        className={`rounded-full transition-all duration-200 focus:outline-none ${TOUCH_TARGET.min}`}
                        style={{
                            boxShadow: i === selectedIndex
                                ? `0 0 0 3px var(--brand-primary)`
                                : '0 0 0 2px rgba(var(--brand-primary-rgb), 0.15)',
                            transform: i === selectedIndex ? 'scale(1.1)' : 'scale(1)',
                        }}
                        aria-label={`View ${t.name}'s testimonial`}
                        aria-current={i === selectedIndex}
                    >
                        <MediaUploadOverlay
                            field={`testimonials.${i}.avatar`}
                            altText={t.name}
                            valueShape="media"
                            buttonPosition="top-center"
                            positionClass="relative inline-block"
                        >
                            <AvatarRing
                                color={CSS_VARS.primary}
                                src={t.avatar?.url || getTeamAvatar(category, i, s3Map)}
                                name={t.name}
                                size={56}
                                imageIndex={i}
                            />
                        </MediaUploadOverlay>
                    </button>
                ))}
            </div>

            {/* Selected testimonial */}
            <AnimatePresence mode="wait">
                <motion.div
                    key={selectedIndex}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -16 }}
                    transition={{ duration: 0.3 }}
                    className={`max-w-2xl mx-auto text-center ${CARD_PADDING.lg} rounded-2xl`}
                    style={{
                        background: 'linear-gradient(160deg, rgba(var(--brand-primary-rgb), 0.031), transparent 60%)',
                        border: '1px solid rgba(var(--brand-primary-rgb), 0.063)',
                    }}
                >
                    <StarRating count={selected.rating || 5} size="lg" className="flex justify-center gap-0.5 mb-4" />
                    <Body size="lg" className="opacity-70 mb-6 italic">
                        &ldquo;{selected.quote}&rdquo;
                    </Body>
                    <RichText text={selected.name} as="p" className="font-bold" />
                    {(selected.title || selected.company) && (
                        <Body size="small" className="opacity-45 mt-1">{[selected.title, selected.company].filter(Boolean).join(' \u2022 ')}</Body>
                    )}
                </motion.div>
            </AnimatePresence>
        </TestimonialsSection>
    )
}

// \u2500\u2500 Single sub-component \u2014 1 large testimonial, manual prev/next \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
function TestimonialsSingle({
    headline,
    testimonials,
    category,
    s3Map,
}: {
    headline?: string
    testimonials: TestimonialItem[]
    category: string
    s3Map?: Record<string, string>
}) {
    const [currentIndex, setCurrentIndex] = useState(0)

    if (testimonials.length === 0) return null
    // Clamp index in case testimonials array shrinks (e.g. CMS live preview deletes items)
    const safeIndex = Math.min(currentIndex, testimonials.length - 1)
    const t = testimonials[safeIndex]

    const goPrev = () => setCurrentIndex(i => (i - 1 + testimonials.length) % testimonials.length)
    const goNext = () => setCurrentIndex(i => (i + 1) % testimonials.length)

    return (
        <TestimonialsSection decorative={<TypographicMark text="\u201c" color={CSS_VARS.primary} opacity={0.05} size="xl" />}>
            <TestimonialsHeader headline={headline} />
            {/* aria-live on the stable container, not the AnimatePresence child that unmounts */}
            <div
                className="relative max-w-3xl mx-auto"
                role="region"
                aria-roledescription="carousel"
                aria-label="Customer testimonial"
                aria-live="polite"
                aria-atomic="true"
            >
                {testimonials.length > 1 && (
                    <>
                        <CarouselArrow direction="prev" onClick={goPrev} />
                        <CarouselArrow direction="next" onClick={goNext} />
                    </>
                )}

                <AnimatePresence mode="wait">
                    <motion.div
                        key={safeIndex}
                        initial={{ opacity: 0, scale: 0.97 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.97 }}
                        transition={{ duration: 0.35 }}
                        className="p-10 md:p-14 rounded-2xl text-center"
                        style={{
                            background: 'linear-gradient(160deg, rgba(var(--brand-primary-rgb), 0.05), transparent 60%)',
                            border: '1px solid rgba(var(--brand-primary-rgb), 0.12)',
                            boxShadow: '0 12px 48px rgba(var(--brand-primary-rgb), 0.08)',
                        }}
                    >
                        <div className="flex justify-center mb-8">
                            <MediaUploadOverlay
                                field={`testimonials.${safeIndex}.avatar`}
                                altText={t.name}
                                valueShape="media"
                                buttonPosition="top-center"
                                positionClass="relative inline-block"
                            >
                                <AvatarRing color={CSS_VARS.primary} src={t.avatar?.url || getTeamAvatar(category, safeIndex, s3Map)} name={t.name} size={88} imageIndex={safeIndex} />
                            </MediaUploadOverlay>
                        </div>
                        <StarRating count={t.rating || 5} size="lg" className="flex justify-center gap-1 mb-6" />
                        <blockquote className="text-xl md:text-2xl italic opacity-70 leading-relaxed mb-8">
                            &ldquo;{t.quote}&rdquo;
                        </blockquote>
                        <RichText text={t.name} as="p" className="font-bold text-lg" />
                        {(t.title || t.company) && (
                            <Body size="small" className="opacity-45 mt-1">{[t.title, t.company].filter(Boolean).join(' \u2022 ')}</Body>
                        )}
                    </motion.div>
                </AnimatePresence>

                {testimonials.length > 1 && (
                    <DotIndicator
                        count={testimonials.length}
                        activeIndex={safeIndex}
                        onSelect={setCurrentIndex}
                        label={(i) => `View testimonial ${i + 1}`}
                        className="flex justify-center gap-2 mt-8"
                    />
                )}
            </div>
        </TestimonialsSection>
    )
}
