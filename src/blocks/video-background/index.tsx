'use client'

import type { BlockProps } from '../types'
import type { VideoBackgroundConfig } from './config'

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
    const pc = theme.primaryColor
    const opacity = overlayOpacity / 100

    const content = (
        <div className="relative z-10 flex flex-col items-center justify-center text-center px-6 py-32 md:py-48 min-h-[60vh]">
            {headline && (
                <h2 className="text-4xl md:text-6xl lg:text-7xl font-bold font-heading mb-6 text-white leading-tight max-w-4xl">
                    {headline}
                </h2>
            )}
            {subheadline && (
                <p className="text-lg md:text-xl text-white/70 mb-10 max-w-2xl leading-relaxed">
                    {subheadline}
                </p>
            )}
            {cta && (
                <a
                    href={cta.url}
                    className="inline-flex items-center gap-2 px-10 py-4 rounded-xl font-semibold text-sm text-white transition-all duration-300 hover:opacity-90"
                    style={{ background: `linear-gradient(135deg, ${pc}, ${pc}cc)`, boxShadow: `0 8px 30px ${pc}35` }}
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
            <section className="py-24">
                <div className="container mx-auto px-6">
                    <div className="relative rounded-3xl overflow-hidden" style={{ border: `1px solid ${pc}20` }}>
                        {videoEl}
                        {overlay}
                        {content}
                    </div>
                </div>
            </section>
        )
    }

    // full (default)
    return (
        <section className="relative overflow-hidden">
            {videoEl}
            {overlay}
            {content}
        </section>
    )
}
