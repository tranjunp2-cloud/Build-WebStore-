'use client'

import { useState, useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import { TOUCH_TARGET } from '@/lib/design-tokens'
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
    const { badge, image, images = [], slides: contentSlides = [] } = block
    const category = (site?.siteType as string) || 'business'
    const fallbackHeroUrl = getHeroImage(category, 0, site?.imageLibraryS3 as Record<string, string> | undefined)

    // Build slides array: use images[] if available, fall back to single image
    const slides = contentSlides.length > 0
        ? contentSlides.map(slide => slide.image)
        : (images && images.length > 0)
        ? images
        : image?.url
            ? [image]
            : [{ url: fallbackHeroUrl, alt: block.headline }]

    const [currentIndex, setCurrentIndex] = useState(0)
    const [autoplayReset, setAutoplayReset] = useState(0)

    const selectSlide = (index: number) => {
        setCurrentIndex(index)
        // Restart even when the user selects the currently active dot.
        setAutoplayReset(value => value + 1)
    }
    const currentSlide = contentSlides[currentIndex % Math.max(contentSlides.length, 1)]
    const { headline, subheadline, ctaButtons = [] } = currentSlide ?? block

    useEffect(() => {
        if (slides.length <= 1) return
        const timer = setTimeout(() => {
            setCurrentIndex((prev) => (prev + 1) % slides.length)
        }, 5000)
        return () => clearTimeout(timer)
    }, [currentIndex, slides.length, autoplayReset])

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
        <AnimatedSection className="relative aspect-[16/9] w-full overflow-hidden">
            {/* Only current + next slide rendered in DOM (preload optimization) */}
            {visibleIndices.map((i) => {
                const slideField = contentSlides.length ? `slides.${i}.image.url` : (images && images.length > 0) ? `images.${i}.url` : 'image.url'
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
                                backgroundImage: slides[i]?.url ? `url(${slides[i]?.url})` : undefined,
                                opacity: i === currentIndex ? 1 : 0,
                            }}
                        />
                    </HeroMediaOverlay>
                )
            })}
            {/* Dark overlay */}
            <div className="absolute inset-0 bg-black" style={{ opacity: block.overlayOpacity ?? 0.5 }} />

            {slides.length > 1 && (
                <>
                    {(['left', 'right'] as const).map(direction => (
                        <button
                            key={direction}
                            type="button"
                            aria-label={direction === 'left' ? 'Previous slide' : 'Next slide'}
                            onClick={() => selectSlide((currentIndex + (direction === 'left' ? -1 : 1) + slides.length) % slides.length)}
                            className={`absolute top-1/2 -translate-y-1/2 ${TOUCH_TARGET.min} min-w-[44px] md:w-12 md:h-12 rounded-full flex items-center justify-center transition-all duration-200 hover:scale-110 z-20 backdrop-blur-sm`}
                            style={{
                                [direction === 'left' ? 'left' : 'right']: '12px',
                                background: 'rgba(var(--brand-primary-rgb), 0.188)',
                                color: '#fff',
                            }}
                        >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                                <path strokeLinecap="round" strokeLinejoin="round" d={direction === 'left' ? 'M15 19l-7-7 7-7' : 'M9 5l7 7-7 7'} />
                            </svg>
                        </button>
                    ))}
                </>
            )}

            <div className={`${HERO_CONTAINER} z-10 text-center max-w-3xl absolute inset-0 flex flex-col justify-center overflow-y-auto px-14 pt-3 pb-12 md:px-16 md:pt-8 md:pb-16`}>
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
                    className="text-xl sm:text-3xl md:text-5xl lg:text-7xl font-bold font-heading leading-[1.05] mb-2 md:mb-6 text-white"
                >
                    <RichText text={headline} as="span" />
                </motion.h1>
                {subheadline && (
                    <motion.p
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6, delay: 0.15 }}
                        className="text-sm md:text-xl text-white/70 mb-3 md:mb-10 max-w-2xl mx-auto leading-relaxed"
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

            </div>

            {/* Dot indicators — compact spacing with tall tap targets */}
            {slides.length > 1 && (
                <div className="absolute bottom-0 md:bottom-3 inset-x-0 z-20 flex justify-center">
                    {slides.map((_, i) => (
                        <SlideshowDot
                            key={i}
                            active={i === currentIndex}
                            onClick={() => selectSlide(i)}
                            label={`Go to slide ${i + 1}`}
                        />
                    ))}
                </div>
            )}
        </AnimatedSection>
    )
}
