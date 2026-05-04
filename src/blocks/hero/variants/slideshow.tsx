'use client'

import { useState, useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import type { BlockProps } from '../../types'
import type { HeroConfig } from '../config'
import { AnimatedSection } from '../../shared/animations'
import { CTAButtons, HERO_CONTAINER, HeroBadge, SlideshowDot } from '../shared'
import { HeroMediaOverlay } from '../hero-media-overlay'
import { CSS_VARS as _CSS_VARS } from '@/lib/theme/resolve'

void _CSS_VARS
import { getHeroImage } from '@/lib/images/industry-images'
import { RichText } from '../../shared/RichText'

export function SlideshowHero({ block, site }: BlockProps<HeroConfig>) {
    const { headline, subheadline, ctaButtons = [], badge, image, images = [] } = block
    const category = (site?.siteType as string) || 'business'
    const fallbackHeroUrl = getHeroImage(category, 0, site?.imageLibraryS3 as Record<string, string> | undefined)

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

    // Preload next slide image
    useEffect(() => {
        if (slides.length <= 1) return
        const nextUrl = slides[(currentIndex + 1) % slides.length]?.url
        if (nextUrl) {
            const img = new Image()
            img.src = nextUrl
        }
    }, [currentIndex, slides])

    // Only render current + next slide in DOM
    const visibleIndices = useMemo(() => {
        if (slides.length <= 1) return [0]
        const next = (currentIndex + 1) % slides.length
        return Array.from(new Set([currentIndex, next]))
    }, [currentIndex, slides.length])

    return (
        <AnimatedSection className="relative min-h-[75vh] md:min-h-[92vh] flex items-center overflow-hidden">
            {/* Only current + next slide rendered in DOM (preload optimization) */}
            {visibleIndices.map((i) => {
                const slideField = (images && images.length > 0) ? `images.${i}.url` : 'image.url'
                const slideAlt = (slides[i]?.alt as string | undefined) ?? ''
                return (
                    <HeroMediaOverlay
                        key={i}
                        field={slideField}
                        altText={slideAlt}
                        positionClass="absolute inset-0"
                    >
                        <div
                            className="absolute inset-0 bg-cover bg-center transition-opacity duration-1000"
                            style={{
                                backgroundImage: `url(${slides[i]?.url})`,
                                opacity: i === currentIndex ? 1 : 0,
                            }}
                        />
                    </HeroMediaOverlay>
                )
            })}
            {/* Dark overlay */}
            <div className="absolute inset-0 bg-black/50" />

            <div className={`${HERO_CONTAINER} relative z-10 text-center max-w-3xl`}>
                {badge?.show && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.4 }}
                    >
                        <HeroBadge text={badge.text} />
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

                {/* Dot indicators — 10px visual dot in 44px hit area (WCAG 2.5.5) */}
                {slides.length > 1 && (
                    <div className="flex gap-2 justify-center mt-10">
                        {slides.map((_, i) => (
                            <SlideshowDot
                                key={i}
                                active={i === currentIndex}
                                onClick={() => setCurrentIndex(i)}
                                label={`Go to slide ${i + 1}`}
                            />
                        ))}
                    </div>
                )}
            </div>
        </AnimatedSection>
    )
}
