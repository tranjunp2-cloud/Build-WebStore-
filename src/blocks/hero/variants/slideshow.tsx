'use client'

import { useState, useEffect, useRef } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { SlideshowArrow } from '../../shared/slideshow-controls'
import type { BlockProps } from '../../types'
import type { HeroConfig } from '../config'
import { AnimatedSection } from '../../shared/animations'
import { CTAButtons, HERO_CONTAINER, HeroBadge, SlideshowDot } from '../shared'
import { HeroMediaOverlay } from '../hero-media-overlay'
import { CSS_VARS as _CSS_VARS } from '@/lib/theme/resolve'

void _CSS_VARS
import { getHeroImage } from '@/lib/images/industry-images'
import { RichText } from '../../shared/RichText'

// Keep slide opacity on Motion's JS renderer. The accelerated WAAPI path in
// our Motion version cancels its effect before the final inline style is painted,
// briefly exposing the old slide again. An onUpdate subscriber disables that path.
const keepSlideAnimationOnMainThread = () => {}

export function SlideshowHero({ block, site }: BlockProps<HeroConfig>) {
    const { badge, image } = block
    const images = block.images ?? []
    const contentSlides = block.slides ?? []
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

    const reduceMotion = useReducedMotion()
    const transition = reduceMotion ? 'none' : (block.sourceLayout?.animation ?? 'fade')
    const [direction, setDirection] = useState(1)
    const rootRef = useRef<HTMLDivElement>(null)
    const [editingSlide, setEditingSlide] = useState<number | null>(null)
    const [inlineEditing, setInlineEditing] = useState(false)
    const [storedIndex, setCurrentIndex] = useState(0)
    const currentIndex = Math.min(editingSlide ?? storedIndex, slides.length - 1)
    useEffect(() => {
        const receive = (event: MessageEvent) => {
            if (window.parent === window || event.source !== window.parent || event.origin !== window.location.origin) return
            const index = Number(rootRef.current?.closest('[data-block-index]')?.getAttribute('data-block-index'))
            if (event.data?.type === 'HERO_INLINE_EDIT') {
                setInlineEditing(event.data.blockIndex === index)
                return
            }
            if (event.data?.type !== 'HERO_SLIDE_PREVIEW') return
            if (event.data.blockIndex !== index) return
            const selected = event.data.slideIndex
            if (selected !== null && (!Number.isInteger(selected) || selected < 0)) return
            setEditingSlide(selected)
            if (selected !== null) setCurrentIndex(Math.min(selected, slides.length - 1))
        }
        window.addEventListener('message', receive)
        if (window.parent !== window) {
            const blockIndex = Number(rootRef.current?.closest('[data-block-index]')?.getAttribute('data-block-index'))
            window.parent.postMessage({ type: 'HERO_SLIDE_READY', blockIndex }, window.location.origin)
        }
        return () => window.removeEventListener('message', receive)
    }, [slides.length])
    const [autoplayReset, setAutoplayReset] = useState(0)

    const selectSlide = (index: number, travel = index >= currentIndex ? 1 : -1) => {
        setDirection(travel)
        setCurrentIndex(index)
        if (editingSlide !== null) {
            const blockIndex = Number(rootRef.current?.closest('[data-block-index]')?.getAttribute('data-block-index'))
            window.parent.postMessage({ type: 'HERO_SLIDE_SELECTED', blockIndex, slideIndex: index }, window.location.origin)
        }
        // Restart even when the user selects the currently active dot.
        setAutoplayReset(value => value + 1)
    }
    const currentSlide = contentSlides[currentIndex % Math.max(contentSlides.length, 1)]
    const { headline, subheadline, ctaButtons = [] } = currentSlide ?? block

    useEffect(() => {
        if (slides.length <= 1 || inlineEditing || editingSlide !== null || block.sourceLayout?.autoplay === false) return
        const timer = setTimeout(() => {
            setDirection(1)
            setCurrentIndex((prev) => (prev + 1) % slides.length)
        }, Math.max(1000, Math.min(30000, block.sourceLayout?.interval ?? 5000)))
        return () => clearTimeout(timer)
    }, [currentIndex, slides.length, autoplayReset, editingSlide, inlineEditing, block.sourceLayout?.autoplay, block.sourceLayout?.interval])

    // Preload next slide image
    useEffect(() => {
        if (slides.length <= 1) return
        const nextUrl = slides[(currentIndex + 1) % slides.length]?.url
        if (nextUrl) {
            const img = new Image()
            img.src = nextUrl
        }
    }, [currentIndex, slides])

    const fit = block.sourceLayout?.imageFit ?? 'cover'
    const currentImage = slides[currentIndex]
    // Upload metadata is authoritative when JSON slides retain legacy/default dimensions.
    const dimensionImage = image?.url === currentImage?.url && image?.width && image?.height ? image : currentImage
    const naturalRatio = dimensionImage?.width && dimensionImage?.height ? dimensionImage.width / dimensionImage.height : undefined
    const aspectRatio = block.sourceLayout?.aspectRatio ?? (fit !== 'cover' ? naturalRatio : undefined) ?? 16 / 9

    const slideField = contentSlides.length ? `slides.${currentIndex}.image.url` : images.length ? `images.${currentIndex}.url` : 'image.url'
    const offset = (travel: number) => transition === 'slide-horizontal'
        ? { x: `${travel * 100}%`, y: '0%', opacity: 1 }
        : transition === 'slide-vertical'
            ? { x: '0%', y: `${travel * 100}%`, opacity: 1 }
            : { x: '0%', y: '0%', opacity: transition === 'none' ? 1 : 0 }

    return (
        <div ref={rootRef} data-hero-variant="slideshow"><AnimatedSection className="relative w-full overflow-hidden" style={{ aspectRatio }}>
            <AnimatePresence initial={false} custom={direction}>
                <motion.div key={currentIndex} className="absolute inset-0" custom={direction}
                    onUpdate={keepSlideAnimationOnMainThread}
                    variants={{ enter: (travel: number) => offset(travel), exit: (travel: number) => offset(-travel) }}
                    initial="enter" animate={{ x: '0%', y: '0%', opacity: 1 }} exit="exit"
                    transition={{ duration: transition === 'none' ? 0 : 0.6, ease: 'easeInOut' }}>
                    <HeroMediaOverlay field={slideField} altText={slides[currentIndex]?.alt ?? ''} positionClass="absolute inset-0">
                        <div className="absolute inset-0 bg-cover bg-center"
                            style={{ backgroundImage: slides[currentIndex]?.url ? `url(${slides[currentIndex]?.url})` : undefined, backgroundSize: fit === 'cover' ? 'cover' : 'contain', backgroundRepeat: 'no-repeat' }} />
                    </HeroMediaOverlay>
                    <div className="absolute inset-0 bg-black" style={{ opacity: block.overlayOpacity ?? (headline?.trim() || subheadline?.trim() || ctaButtons.length || badge?.show ? 0.5 : 0) }} />
                    <div className={`${HERO_CONTAINER} z-10 text-center max-w-3xl absolute inset-0 flex flex-col justify-center overflow-y-auto px-14 pt-3 pb-12 md:px-16 md:pt-8 md:pb-16`}>
                        {badge?.show && (
                            <div>
                                <HeroBadge text={badge.text} />
                            </div>
                        )}
                        {headline && <h1
                            className="text-xl sm:text-3xl md:text-5xl lg:text-7xl font-bold font-heading leading-[1.05] mb-2 md:mb-6 text-white"
                        >
                            <RichText text={headline} as="span" />
                        </h1>}
                        {subheadline && (
                            <p
                                className="text-sm md:text-xl text-white/70 mb-3 md:mb-10 max-w-2xl mx-auto leading-relaxed"
                            >
                                <RichText text={subheadline} as="span" />
                            </p>
                        )}
                        <div
                            className="flex flex-wrap gap-4 justify-center"
                        >
                            <CTAButtons buttons={ctaButtons} variant="glass" siteId={site?.id ? String(site.id) : undefined} />
                        </div>

                    </div>

                </motion.div>
            </AnimatePresence>

            {slides.length > 1 && block.sourceLayout?.showArrows !== false && (
                <>
                    {(['left', 'right'] as const).map(direction => (
                        <SlideshowArrow
                            key={direction}
                            direction={direction}
                            onClick={() => selectSlide((currentIndex + (direction === 'left' ? -1 : 1) + slides.length) % slides.length, direction === 'left' ? -1 : 1)}
                        />
                    ))}
                </>
            )}

            {/* Dot indicators — compact spacing with tall tap targets */}
            {slides.length > 1 && block.sourceLayout?.showDots !== false && (
                <div className="absolute bottom-0 md:bottom-3 inset-x-0 z-20 flex justify-center">
                    {slides.map((_, i) => (
                        <SlideshowDot
                            onImage
                            key={i}
                            active={i === currentIndex}
                            onClick={() => selectSlide(i)}
                            label={`Go to slide ${i + 1}`}
                        />
                    ))}
                </div>
            )}
        </AnimatedSection></div>
    )
}
