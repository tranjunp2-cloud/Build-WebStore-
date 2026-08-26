'use client'

import Image from 'next/image'
import type { BlockProps } from '../types'
import type { SocialProofConfig, SocialProofReview } from './config'
import { CSS_VARS } from '@/lib/theme/resolve'
import { AnimatedSection } from '../shared/animations'
import { RichText } from '../shared/RichText'
import { Heading, Body, Caption } from '../shared/Typography'
import { CARD_PADDING } from '@/lib/design-tokens'
import { SectionWrapper } from '../shared/SectionWrapper'
import { getTeamAvatar } from '@/lib/images/industry-images'
import { MediaUploadOverlay } from '@/blocks/shared/media-upload-overlay'

function StarRating({ rating, color }: { rating: number; color: string }) {
    return (
        <div className="flex gap-0.5">
            {Array.from({ length: 5 }, (_, i) => (
                <svg
                    key={i}
                    className="w-4 h-4"
                    viewBox="0 0 20 20"
                    fill={i < rating ? color : 'currentColor'}
                    style={{ opacity: i < rating ? 1 : 0.15 }}
                >
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
            ))}
        </div>
    )
}

function Avatar({ src, name, color, imageIndex }: { src?: string; name: string; color: string; imageIndex?: number }) {
    const initials = name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    const fieldPath = imageIndex !== undefined ? `reviews.${imageIndex}.avatar` : undefined

    const inner = src ? (
        <Image src={src} alt={name} width={40} height={40} className="rounded-full object-cover" data-image-index={imageIndex} />
    ) : (
        <div
            className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white"
            style={{ backgroundColor: color }}
        >
            {initials}
        </div>
    )

    if (!fieldPath) return inner

    return (
        <MediaUploadOverlay
            field={fieldPath}
            altText={name}
            valueShape="media"
            buttonPosition="top-center"
            positionClass="relative inline-block"
        >
            {inner}
        </MediaUploadOverlay>
    )
}

function ReviewCard({ review, color, variant, reviewIndex }: { review: SocialProofReview; color: string; variant: string; reviewIndex?: number }) {
    const authorBlock = (
        <div className="flex items-center gap-3">
            <Avatar src={review.avatar?.url} name={review.author} color={color} imageIndex={reviewIndex} />
            <div>
                <Body size="small" className="font-semibold">{review.author}</Body>
                {review.role && <Caption className="opacity-50 block">{review.role}</Caption>}
            </div>
        </div>
    )

    if (variant === 'minimal') {
        return (
            <div className="py-6 border-b last:border-b-0" style={{ borderColor: `rgba(var(--brand-primary-rgb), 0.082)` }}>
                <StarRating rating={review.rating} color={color} />
                <Body size="small" className="mt-3 leading-relaxed opacity-80">{review.content}</Body>
                <div className="mt-4">{authorBlock}</div>
            </div>
        )
    }

    return (
        <div
            className={`${CARD_PADDING.md} rounded-2xl border shadow-sm hover:shadow-md transition-shadow duration-200`}
            style={{ borderColor: `rgba(var(--brand-primary-rgb), 0.125)` }}
        >
            <StarRating rating={review.rating} color={color} />
            <Body size="small" className="mt-4 leading-relaxed opacity-80">{review.content}</Body>
            <div className="mt-6 pt-4 border-t" style={{ borderColor: `rgba(var(--brand-primary-rgb), 0.063)` }}>
                {authorBlock}
            </div>
        </div>
    )
}

export function SocialProofBlock({ block, theme: _theme, site }: BlockProps<SocialProofConfig>) {
    void _theme
    const { variant = 'cards', headline, reviews: rawReviews = [] } = block
    const category = (site?.siteType as string) || 'business'

    const s3Map = site?.imageLibraryS3 as Record<string, string> | undefined
    // Fallback: add avatar from industry images for reviews missing avatars (per-item)
    const reviews = rawReviews.map((review, i) => ({
        ...review,
        avatar: review.avatar?.url ? review.avatar : { url: getTeamAvatar(category, i, s3Map) },
    }))

    return (
        <AnimatedSection>
            <SectionWrapper as="div" padding="default" container="default" background="transparent">
                {headline && (
                    <div className="text-center mb-14">
                        <Heading level={2}>
                            <RichText text={headline} as="span" />
                        </Heading>
                    </div>
                )}

                {variant === 'minimal' ? (
                    <div className="max-w-2xl mx-auto">
                        {reviews.map((review, i) => (
                            <ReviewCard key={i} review={review} color={CSS_VARS.primary} variant={variant} reviewIndex={i} />
                        ))}
                    </div>
                ) : (
                    <div className={`grid grid-cols-1 md:grid-cols-2 ${variant === 'grid' ? 'lg:grid-cols-3' : 'lg:grid-cols-3'} gap-6 max-w-6xl mx-auto`}>
                        {reviews.map((review, i) => (
                            <ReviewCard key={i} review={review} color={CSS_VARS.primary} variant={variant} reviewIndex={i} />
                        ))}
                    </div>
                )}
            </SectionWrapper>
        </AnimatedSection>
    )
}
