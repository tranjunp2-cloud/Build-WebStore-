'use client'

import { useState, useRef } from 'react'
import { motion } from 'framer-motion'
import type { BlockProps } from '../../types'
import type { HeroConfig } from '../config'
import { AnimatedSection } from '../../shared/animations'
import { GradientBlob, DotGrid, SectionLabel } from '../../shared/decorative'
import { CTAButtons } from '../shared'
import { CSS_VARS } from '@/lib/theme/resolve'
import { RichText } from '../../shared/RichText'

export function SplitVideoHero({ block }: BlockProps<HeroConfig>) {
    const { headline, subheadline, ctaButtons = [], badge, videoUrl } = block
    const primaryColor = CSS_VARS.primary

    const videoRef = useRef<HTMLVideoElement>(null)
    const [isPlaying, setIsPlaying] = useState(true)

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
            <GradientBlob color={primaryColor} className="top-[-10%] right-[-5%]" size={600} opacity={0.12} />
            <GradientBlob color={primaryColor} className="bottom-[-15%] left-[-8%]" size={500} opacity={0.08} />
            <DotGrid color={primaryColor} />

            <div className="container mx-auto px-6 relative z-10">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
                    {/* Left — Content */}
                    <motion.div
                        initial={{ opacity: 0, x: -40 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                    >
                        {badge?.show && (
                            <SectionLabel color={primaryColor}>{badge.text}</SectionLabel>
                        )}
                        <RichText text={headline} as="h1" className="text-5xl lg:text-6xl font-bold font-heading leading-[1.1] mb-6" />
                        {subheadline && (
                            <RichText text={subheadline} as="p" className="text-xl opacity-60 mb-10 max-w-lg leading-relaxed" />
                        )}
                        <CTAButtons buttons={ctaButtons} />
                    </motion.div>

                    {/* Right — Video */}
                    <motion.div
                        initial={{ opacity: 0, x: 40 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.7, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
                        className="relative"
                    >
                        {videoUrl ? (
                            <div className="relative rounded-2xl overflow-hidden"
                                style={{
                                    boxShadow: `0 25px 50px rgba(var(--brand-primary-rgb), 0.082), 0 10px 20px rgba(0,0,0,0.2)`,
                                }}
                            >
                                <video
                                    ref={videoRef}
                                    src={videoUrl}
                                    autoPlay
                                    muted
                                    loop
                                    playsInline
                                    className="w-full h-auto aspect-video object-cover"
                                />
                                {/* Play/Pause toggle */}
                                <button
                                    onClick={togglePlayback}
                                    className="absolute bottom-4 right-4 w-10 h-10 rounded-full flex items-center justify-center transition-all"
                                    style={{
                                        background: 'rgba(0,0,0,0.5)',
                                        backdropFilter: 'blur(8px)',
                                        color: '#fff',
                                        border: '1px solid rgba(255,255,255,0.2)',
                                    }}
                                    aria-label={isPlaying ? 'Pause video' : 'Play video'}
                                >
                                    {isPlaying ? (
                                        <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
                                            <rect x="2" y="1" width="3.5" height="12" rx="1" />
                                            <rect x="8.5" y="1" width="3.5" height="12" rx="1" />
                                        </svg>
                                    ) : (
                                        <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
                                            <path d="M3 1.5v11l9-5.5L3 1.5z" />
                                        </svg>
                                    )}
                                </button>
                            </div>
                        ) : (
                            <div
                                className="w-full aspect-video rounded-2xl flex items-center justify-center"
                                style={{
                                    background: `rgba(var(--brand-primary-rgb), 0.05)`,
                                    border: `2px dashed rgba(var(--brand-primary-rgb), 0.2)`,
                                }}
                            >
                                <p className="opacity-40 text-sm">No video URL provided</p>
                            </div>
                        )}
                    </motion.div>
                </div>
            </div>
        </AnimatedSection>
    )
}
