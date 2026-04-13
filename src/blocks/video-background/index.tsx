'use client'

import type { BlockProps } from '../types'
import type { VideoBackgroundConfig } from './config'
import { CSS_VARS } from '@/lib/theme/resolve'
import { AnimatedSection } from '../shared/animations'
import { RichText } from '../shared/RichText'

export function VideoBackgroundBlock({ block, theme }: BlockProps<VideoBackgroundConfig>) {
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
                <RichText text={headline} as="h2" className="text-4xl md:text-6xl lg:text-7xl font-bold font-heading mb-6 text-white leading-tight max-w-4xl" />
            )}
            {subheadline && (
                <RichText text={subheadline} as="p" className="text-lg md:text-xl text-white/70 mb-10 max-w-2xl leading-relaxed" />
            )}
            {cta && (
                <a
                    href={cta?.url}
                    className="inline-flex items-center gap-2 px-10 py-4 rounded-xl font-semibold text-sm text-white transition-all duration-300 hover:opacity-90"
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
            <AnimatedSection className="py-24">
                <div className="container mx-auto px-6">
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
