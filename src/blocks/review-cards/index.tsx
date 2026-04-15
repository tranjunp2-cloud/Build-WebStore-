'use client'

import { useRef, useMemo } from 'react'
import { motion } from 'framer-motion'
import type { BlockProps } from '../types'
import type { ReviewCardsConfig, ReviewItem } from './config'
import { CSS_VARS as _CSS_VARS } from '@/lib/theme/resolve'
import { AnimatedSection } from '../shared/animations'
import { RichText } from '../shared/RichText'
import { Heading, Body, Caption } from '../shared/Typography'
import { CONTAINER, INNER_PADDING, SECTION_PADDING, TOUCH_TARGET, CARD_PADDING } from '@/lib/design-tokens'

void _CSS_VARS

function StarRating({ rating, size = 'md' }: { rating: number; size?: 'sm' | 'md' | 'lg' }) {
    const sizeClass = size === 'sm' ? 'w-4 h-4' : size === 'lg' ? 'w-6 h-6' : 'w-5 h-5'
    return (
        <div className="flex items-center gap-0.5" aria-label={`${rating} out of 5 stars`}>
            {Array.from({ length: 5 }, (_, i) => (
                <svg
                    key={i}
                    className={sizeClass}
                    viewBox="0 0 20 20"
                    fill={i < Math.round(rating) ? 'var(--brand-primary)' : `rgba(var(--brand-primary-rgb), 0.188)`}
                >
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
            ))}
        </div>
    )
}

function ReviewCard({ review }: { review: ReviewItem }) {
    return (
        <div
            className={`${CARD_PADDING.md} rounded-2xl h-full flex flex-col`}
            style={{ border: `1px solid rgba(var(--brand-primary-rgb), 0.082)` }}
        >
            <StarRating rating={review.rating} size="sm" />
            <Body size="small" className="mt-4 mb-6 flex-1 leading-relaxed opacity-70">&ldquo;{review.text}&rdquo;</Body>
            <div className="flex items-center gap-3">
                {review.avatar ? (
                    <img src={review.avatar} alt={review.name} className="w-10 h-10 rounded-full object-cover" />
                ) : (
                    <div
                        className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white"
                        style={{ background: 'var(--brand-primary)' }}
                    >
                        {review.name.charAt(0).toUpperCase()}
                    </div>
                )}
                <div>
                    <p className="font-bold text-sm font-heading">
                        {review.name}
                        {review.verified && (
                            <svg className="w-4 h-4 inline ml-1" viewBox="0 0 20 20" fill="var(--brand-primary)" aria-label="Verified">
                                <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                        )}
                    </p>
                    <Caption className="opacity-40 block">
                        {review.source && <span>{review.source}</span>}
                        {review.source && review.date && <span> &middot; </span>}
                        {review.date && <span>{review.date}</span>}
                    </Caption>
                </div>
            </div>
        </div>
    )
}

export function ReviewCardsBlock({ block }: BlockProps<ReviewCardsConfig>) {
    const {
        headline,
        subheadline,
        reviews = [],
        variant = 'grid',
        showAverage = true,
        totalReviewCount,
    } = block

    const scrollRef = useRef<HTMLDivElement>(null)

    const averageRating = useMemo(() => {
        if (reviews.length === 0) return 0
        return reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
    }, [reviews])

    const scrollCarousel = (direction: 'left' | 'right') => {
        if (!scrollRef.current) return
        const scrollAmount = scrollRef.current.offsetWidth * 0.8
        scrollRef.current.scrollBy({
            left: direction === 'left' ? -scrollAmount : scrollAmount,
            behavior: 'smooth',
        })
    }

    /* ── Average rating header ───────────────────────────────────────────────── */
    const AverageHeader = () => {
        if (!showAverage || reviews.length === 0) return null
        return (
            <div className="flex flex-col items-center gap-2 mb-12">
                <span className="text-5xl font-bold font-heading" style={{ color: 'var(--brand-primary)' }}>
                    {averageRating.toFixed(1)}
                </span>
                <StarRating rating={averageRating} size="lg" />
                <Body size="small" className="opacity-50">
                    from {totalReviewCount ?? reviews.length} review{(totalReviewCount ?? reviews.length) !== 1 ? 's' : ''}
                </Body>
            </div>
        )
    }

    /* ── Grid ────────────────────────────────────────────────────────────────── */
    const renderGrid = () => (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {reviews.map((review, i) => (
                <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 16 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.05 }}
                >
                    <ReviewCard review={review} />
                </motion.div>
            ))}
        </div>
    )

    /* ── Carousel ────────────────────────────────────────────────────────────── */
    const renderCarousel = () => (
        <div className="relative">
            <div
                ref={scrollRef}
                className="flex gap-6 overflow-x-auto snap-x snap-mandatory scrollbar-hide pb-4 -mx-6 px-6"
            >
                {reviews.map((review, i) => (
                    <div key={i} className="snap-center shrink-0 w-[340px]">
                        <ReviewCard review={review} />
                    </div>
                ))}
            </div>
            {reviews.length > 3 && (
                <div className="flex justify-center gap-3 mt-6">
                    <button
                        type="button"
                        onClick={() => scrollCarousel('left')}
                        className={`${TOUCH_TARGET.min} min-w-[44px] rounded-full flex items-center justify-center transition-opacity hover:opacity-80`}
                        style={{ background: `rgba(var(--brand-primary-rgb), 0.082)` }}
                        aria-label="Previous reviews"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                        </svg>
                    </button>
                    <button
                        type="button"
                        onClick={() => scrollCarousel('right')}
                        className={`${TOUCH_TARGET.min} min-w-[44px] rounded-full flex items-center justify-center transition-opacity hover:opacity-80`}
                        style={{ background: `rgba(var(--brand-primary-rgb), 0.082)` }}
                        aria-label="Next reviews"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                    </button>
                </div>
            )}
        </div>
    )

    /* ── Masonry ─────────────────────────────────────────────────────────────── */
    const renderMasonry = () => (
        <div className="columns-1 md:columns-2 lg:columns-3 gap-6 space-y-6">
            {reviews.map((review, i) => (
                <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 16 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.05 }}
                    className="break-inside-avoid"
                >
                    <ReviewCard review={review} />
                </motion.div>
            ))}
        </div>
    )

    return (
        <AnimatedSection className={SECTION_PADDING.default}>
            <div className={`${CONTAINER.default} mx-auto ${INNER_PADDING}`}>
                <div className="text-center max-w-2xl mx-auto mb-12">
                    <Heading level={2} className="mb-5 leading-tight">
                        <RichText text={headline} as="span" />
                    </Heading>
                    {subheadline && (
                        <Body size="lg" className="opacity-50 leading-relaxed">
                            <RichText text={subheadline} as="span" />
                        </Body>
                    )}
                </div>

                <AverageHeader />

                {variant === 'grid' && renderGrid()}
                {variant === 'carousel' && renderCarousel()}
                {variant === 'masonry' && renderMasonry()}
            </div>
        </AnimatedSection>
    )
}
