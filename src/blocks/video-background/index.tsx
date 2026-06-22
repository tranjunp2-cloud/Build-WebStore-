'use client'

import type { BlockProps } from '../types'
import type { VideoBackgroundConfig } from './config'
import { CSS_VARS as _CSS_VARS } from '@/lib/theme/resolve'
import { AnimatedSection } from '../shared/animations'
import { RichText } from '../shared/RichText'
import { Heading, Body } from '../shared/Typography'
import { CONTAINER, INNER_PADDING, SECTION_PADDING, TOUCH_TARGET } from '@/lib/design-tokens'
import { useLocalHref } from '@/lib/hooks/use-local-href'

void _CSS_VARS

export function VideoBackgroundBlock({ block, theme: _theme }: BlockProps<VideoBackgroundConfig>) {
    void _theme
    const resolveHref = useLocalHref()
    const {
        variant = 'full',
        headline,
        subheadline,
        videoUrl,
        posterImage,
        overlayOpacity = 50,
        cta,
    } = block
    const opacity = overlayOpacity / 100

    const content = (
        <div className="relative z-10 flex flex-col items-center justify-center text-center px-6 py-32 md:py-48 min-h-[60vh]">
            {headline && (
                <Heading level={1} className="mb-6 text-white leading-tight max-w-4xl">
                    <RichText text={headline} as="span" />
                </Heading>
            )}
            {subheadline && (
                <Body size="lg" className="text-white/70 mb-10 max-w-2xl leading-relaxed">
                    <RichText text={subheadline} as="span" />
                </Body>
            )}
            {cta && (
                <a
                    href={resolveHref(cta?.url)}
                    className={`inline-flex items-center gap-2 px-10 py-4 rounded-xl font-semibold text-sm text-white transition-all duration-300 hover:opacity-90 ${TOUCH_TARGET.min}`}
                    style={{ background: `linear-gradient(135deg, var(--brand-primary), rgba(var(--brand-primary-rgb), 0.800))`, boxShadow: `0 8px 30px rgba(var(--brand-primary-rgb), 0.208)` }}
                >
                    {cta.label}
                </a>
            )}
        </div>
    )

    const videoEl = (
        <video
            className="absolute inset-0 w-full h-full object-cover"
            src={videoUrl}
            poster={posterImage}
            autoPlay
            muted
            loop
            playsInline
        />
    )

    const overlay = (
        <div className="absolute inset-0 bg-black" style={{ opacity }} />
    )

    if (variant === 'contained') {
        return (
            <AnimatedSection className={SECTION_PADDING.default}>
                <div className={`${CONTAINER.default} mx-auto ${INNER_PADDING}`}>
                    <div className="relative rounded-3xl overflow-hidden" style={{ border: `1px solid rgba(var(--brand-primary-rgb), 0.125)` }}>
                        {videoEl}
                        {overlay}
                        {content}
                    </div>
                </div>
            </AnimatedSection>
        )
    }

    // full (default)
    return (
        <AnimatedSection className="relative overflow-hidden">
            {videoEl}
            {overlay}
            {content}
        </AnimatedSection>
    )
}
