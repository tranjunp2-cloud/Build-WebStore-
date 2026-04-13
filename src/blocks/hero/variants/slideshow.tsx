'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import type { BlockProps } from '../../types'
import type { HeroConfig } from '../config'
import { AnimatedSection } from '../../shared/animations'
import { CTAButtons } from '../shared'
import { CSS_VARS } from '@/lib/theme/resolve'
import { getHeroImage } from '@/lib/images/industry-images'
import { RichText } from '../../shared/RichText'

export function SlideshowHero({ block, site }: BlockProps<HeroConfig>) {
    const { headline, subheadline, ctaButtons = [], badge, image, images = [] } = block
    const category = (site?.siteType as string) || 'business'
    const fallbackHeroUrl = getHeroImage(category)

    // Build slides array: use images[] if available, fall back to single image
    const slides = (images && images.length > 0)
        ? images
        : image?.url
            ? [image]
            : [{ url: fallbackHeroUrl, alt: headline }]

    const [currentIndex, setCurrentIndex] = useState(0)

    useEffect(() => {
        if (slides.length <= 1) return
        const timer = setInterval(() => {
            setCurrentIndex((prev) => (prev + 1) % slides.length)
        }, 5000)
        return () => clearInterval(timer)
    }, [slides.length])

    return (
        <AnimatedSection className="relative min-h-[92vh] flex items-center overflow-hidden">
            {/* Image layers with crossfade */}
            {slides.map((slide, i) => (
                <div
                    key={i}
                    className="absolute inset-0 bg-cover bg-center transition-opacity duration-1000"
                    style={{
                        backgroundImage: `url(${slide.url})`,
                        opacity: i === currentIndex ? 1 : 0,
                    }}
                />
            ))}
            {/* Dark overlay */}
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
                    <CTAButtons buttons={ctaButtons} variant="glass" siteId={site?.id ? String(site.id) : undefined} />
                </motion.div>

                {/* Dot indicators */}
                {slides.length > 1 && (
                    <div className="flex gap-2 justify-center mt-10">
                        {slides.map((_, i) => (
                            <button
                                key={i}
                                onClick={() => setCurrentIndex(i)}
                                className="w-2.5 h-2.5 rounded-full transition-all duration-300"
                                style={{
                                    background: i === currentIndex ? '#fff' : 'rgba(255,255,255,0.4)',
                                    transform: i === currentIndex ? 'scale(1.3)' : 'scale(1)',
                                }}
                                aria-label={`Go to slide ${i + 1}`}
                            />
                        ))}
                    </div>
                )}
            </div>
        </AnimatedSection>
    )
}
