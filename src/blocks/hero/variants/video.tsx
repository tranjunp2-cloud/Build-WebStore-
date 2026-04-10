'use client'

import { useState, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import type { BlockProps } from '../../types'
import type { HeroConfig } from '../config'
import { AnimatedSection } from '../../shared/animations'
import { CTAButtons } from '../shared'
import { CSS_VARS } from '@/lib/theme/resolve'
import { getHeroImage } from '@/lib/images/industry-images'
import { RichText } from '../../shared/RichText'

export function VideoHero({ block, site }: BlockProps<HeroConfig>) {
    const { headline, subheadline, ctaButtons = [], badge, videoUrl, image } = block
    const category = (site?.siteType as string) || 'business'
    const fallbackHeroUrl = getHeroImage(category)

    const videoRef = useRef<HTMLVideoElement>(null)
    const [isPlaying, setIsPlaying] = useState(true)

    // Respect prefers-reduced-motion
    useEffect(() => {
        const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
        const handler = (e: MediaQueryListEvent | MediaQueryList) => {
            if (e.matches && videoRef.current) {
                videoRef.current.pause()
                setIsPlaying(false)
            }
        }
        handler(mq)
        mq.addEventListener('change', handler)
        return () => mq.removeEventListener('change', handler)
    }, [])

    const togglePlayback = () => {
        if (!videoRef.current) return
        if (isPlaying) {
            videoRef.current.pause()
        } else {
            videoRef.current.play()
        }
        setIsPlaying(!isPlaying)
    }

    return (
        <AnimatedSection className="relative min-h-[92vh] flex items-center overflow-hidden">
            {/* Full-bleed background video */}
            {videoUrl ? (
                <video
                    ref={videoRef}
                    src={videoUrl}
                    autoPlay
                    muted
                    loop
                    playsInline
                    poster={image?.url || fallbackHeroUrl}
                    className="absolute inset-0 w-full h-full object-cover"
                />
            ) : (
                /* Poster image fallback when no video */
                <div
                    className="absolute inset-0 bg-cover bg-center"
                    style={{
                        backgroundImage: `url(${image?.url || fallbackHeroUrl})`,
                    }}
                />
            )}

            {/* Dark overlay for text readability */}
            <div className="absolute inset-0 bg-black/50" />

            <div className="container mx-auto px-6 relative z-10 text-center max-w-3xl">
                {badge?.show && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.4 }}
                    >
                        <div
                            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold uppercase tracking-widest mb-6"
                            style={{
                                background: 'rgba(255,255,255,0.1)',
                                color: '#fff',
                                border: '1px solid rgba(255,255,255,0.2)',
                            }}
                        >
                            <span className="w-1.5 h-1.5 rounded-full bg-white" />
                            {badge.text}
                        </div>
                    </motion.div>
                )}
                <motion.h1
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                    className="text-5xl md:text-7xl font-bold font-heading leading-[1.05] mb-6 text-white"
                >
                    <RichText text={headline} as="span" />
                </motion.h1>
                {subheadline && (
                    <motion.p
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6, delay: 0.15 }}
                        className="text-xl text-white/70 mb-10 max-w-2xl mx-auto leading-relaxed"
                    >
                        <RichText text={subheadline} as="span" />
                    </motion.p>
                )}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: 0.25 }}
                    className="flex flex-wrap gap-4 justify-center"
                >
                    <CTAButtons buttons={ctaButtons} variant="glass" />
                </motion.div>
            </div>

            {/* Play/Pause button in corner */}
            {videoUrl && (
                <button
                    onClick={togglePlayback}
                    className="absolute bottom-6 right-6 z-20 w-12 h-12 rounded-full flex items-center justify-center transition-all"
                    style={{
                        background: 'rgba(0,0,0,0.5)',
                        backdropFilter: 'blur(8px)',
                        color: '#fff',
                        border: '1px solid rgba(255,255,255,0.2)',
                    }}
                    aria-label={isPlaying ? 'Pause video' : 'Play video'}
                >
                    {isPlaying ? (
                        <svg width="16" height="16" viewBox="0 0 14 14" fill="currentColor">
                            <rect x="2" y="1" width="3.5" height="12" rx="1" />
                            <rect x="8.5" y="1" width="3.5" height="12" rx="1" />
                        </svg>
                    ) : (
                        <svg width="16" height="16" viewBox="0 0 14 14" fill="currentColor">
                            <path d="M3 1.5v11l9-5.5L3 1.5z" />
                        </svg>
                    )}
                </button>
            )}
        </AnimatedSection>
    )
}
