'use client'

import { useState, useEffect, useCallback, type ReactNode } from 'react'
import type { BlockProps } from '../types'
import type { GalleryConfig } from './config'
import { CSS_VARS } from '@/lib/theme/resolve'
import { AnimatedSection, StaggerGrid, StaggerItem } from '../shared/animations'
import { SectionLabel } from '../shared/decorative'
import { motion, AnimatePresence } from 'framer-motion'
import { X, ChevronLeft, ChevronRight } from 'lucide-react'
import { RichText } from '../shared/RichText'
import { Heading, Body } from '../shared/Typography'
import { CONTAINER, INNER_PADDING, SECTION_PADDING, TOUCH_TARGET } from '@/lib/design-tokens'

// ── Local helpers (Phase 05 refactor) ───────────────────────────────────────
// Brand identity vars preserved per Option C additive strategy.

const GALLERY_CONTAINER = `${CONTAINER.default} mx-auto ${INNER_PADDING}`

type GallerySectionProps = {
    children: ReactNode
}

/** Outer wrapper for all 6 variants. AnimatedSection + token container. */
function GallerySection({ children }: GallerySectionProps) {
    return (
        <AnimatedSection className={SECTION_PADDING.default}>
            <div className={GALLERY_CONTAINER}>
                {children}
            </div>
        </AnimatedSection>
    )
}

/** Section header used by all 6 variants. SectionLabel + Heading. */
function GalleryHeader({ headline }: { headline?: string }) {
    if (!headline) return null
    return (
        <div className="text-center mb-14">
            <SectionLabel color={CSS_VARS.primary}>Gallery</SectionLabel>
            <Heading level={2}>
                <RichText text={headline} as="span" />
            </Heading>
        </div>
    )
}

type ImageItem = GalleryConfig['images'][number]

type GalleryImageCardProps = {
    item: ImageItem
    aspect?: 'square' | '4/3' | 'video' | 'auto'
    className?: string
    overlayClickable?: boolean
}

const ASPECT_CLASS = {
    square: 'aspect-square',
    '4/3': 'aspect-[4/3]',
    video: 'aspect-video',
    auto: '',
} as const

/**
 * Image card with hover-overlay caption + decorative placeholder fallback.
 * Used 4+ times across grid/masonry/carousel/lightbox variants.
 */
function GalleryImageCard({ item, aspect = 'square', className = '', overlayClickable = false }: GalleryImageCardProps) {
    const aspectCls = ASPECT_CLASS[aspect]

    if (item.image?.url) {
        return (
            <div className={`relative overflow-hidden rounded-2xl ${aspectCls} ${className}`.trim()}>
                <img
                    src={item.image.url}
                    alt={item.caption || item.image.alt || ''}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
                {item.caption && (
                    <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        <Body size="small" className="text-white font-medium">{item.caption}</Body>
                    </div>
                )}
                {overlayClickable && (
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-300 flex items-center justify-center">
                        <span className="opacity-0 group-hover:opacity-100 text-white text-2xl transition-opacity duration-300" aria-hidden="true">⊕</span>
                    </div>
                )}
            </div>
        )
    }

    return (
        <div
            className={`${aspectCls} rounded-2xl flex items-center justify-center ${className}`.trim()}
            style={{
                background: `linear-gradient(135deg, rgba(var(--brand-primary-rgb), 0.06), rgba(var(--brand-primary-rgb), 0.02))`,
                border: `1px solid rgba(var(--brand-primary-rgb), 0.063)`,
            }}
            aria-hidden="true"
        >
            <span className="text-2xl opacity-20">📷</span>
        </div>
    )
}

export function GalleryBlock({ block, theme }: BlockProps<GalleryConfig>) {
    const { headline, images = [], variant = 'grid' } = block

    // ── Lightbox variant ──────────────────────────────────────────────────
    if (variant === 'lightbox') {
        return <LightboxGallery headline={headline} images={images} theme={theme} />
    }

    // ── Filmstrip variant ─────────────────────────────────────────────────
    if (variant === 'filmstrip') {
        return <FilmstripGallery headline={headline} images={images} theme={theme} />
    }

    // ── Justified variant ─────────────────────────────────────────────────
    if (variant === 'justified') {
        return <JustifiedGallery headline={headline} images={images} theme={theme} />
    }

    // ── Masonry variant ────────────────────────────────────────────────────
    if (variant === 'masonry') {
        return <MasonryGallery headline={headline} images={images} theme={theme} />
    }

    // ── Carousel variant ─────────────────────────────────────────────────
    if (variant === 'carousel') {
        return <CarouselGallery headline={headline} images={images} theme={theme} />
    }

    // ── Default: grid ────────────────────────────────────────────────────
    return (
        <GallerySection>
            <GalleryHeader headline={headline} />
            <StaggerGrid className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {images.map((item, i) => (
                    <StaggerItem key={i} className="group">
                        <GalleryImageCard item={item} aspect="square" />
                    </StaggerItem>
                ))}
            </StaggerGrid>
        </GallerySection>
    )
}

// ── Masonry Gallery ─────────────────────────────────────────────────────────

function MasonryGallery({ headline, images, theme: _theme }: { headline?: string; images: GalleryConfig['images']; theme: { primaryColor: string } }) {
    void _theme
    return (
        <GallerySection>
            <GalleryHeader headline={headline} />
            <StaggerGrid className="columns-2 md:columns-3 lg:columns-4 gap-4 space-y-4">
                {images.map((item, i) => (
                    <StaggerItem key={i} className="break-inside-avoid group">
                        <GalleryImageCard item={item} aspect={item.image?.url ? 'auto' : 'video'} />
                    </StaggerItem>
                ))}
            </StaggerGrid>
        </GallerySection>
    )
}

// ── Carousel Gallery ────────────────────────────────────────────────────────

function CarouselGallery({ headline, images, theme: _theme }: { headline?: string; images: GalleryConfig['images']; theme: { primaryColor: string } }) {
    void _theme
    const [currentIndex, setCurrentIndex] = useState(0)
    const [isAutoPlaying, setIsAutoPlaying] = useState(true)
    const totalImages = images.length

    // Auto-scroll every 4 seconds
    useEffect(() => {
        if (!isAutoPlaying || totalImages <= 1) return
        const timer = setInterval(() => {
            setCurrentIndex(prev => (prev + 1) % totalImages)
        }, 4000)
        return () => clearInterval(timer)
    }, [isAutoPlaying, totalImages])

    const handlePrev = useCallback(() => {
        setIsAutoPlaying(false)
        setCurrentIndex(prev => (prev - 1 + totalImages) % totalImages)
    }, [totalImages])

    const handleNext = useCallback(() => {
        setIsAutoPlaying(false)
        setCurrentIndex(prev => (prev + 1) % totalImages)
    }, [totalImages])

    const handleDot = useCallback((index: number) => {
        setIsAutoPlaying(false)
        setCurrentIndex(index)
    }, [])

    return (
        <GallerySection>
            <GalleryHeader headline={headline} />

            <div className="relative max-w-6xl mx-auto">
                {/* Carousel track */}
                <div className="overflow-hidden rounded-2xl">
                    <motion.div
                        className="flex"
                        animate={{ x: `-${currentIndex * 100}%` }}
                        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                    >
                        {images.map((item, i) => (
                            <div
                                key={i}
                                className="w-full flex-shrink-0 md:w-1/2 lg:w-1/3 px-2 group"
                            >
                                <GalleryImageCard item={item} aspect="4/3" />
                            </div>
                        ))}
                    </motion.div>
                </div>

                {/* Prev/Next arrows — was w-10 h-10 (40px ❌), now 44px ✅ */}
                {totalImages > 1 && (
                    <>
                        <button
                            type="button"
                            onClick={handlePrev}
                            className={`absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 ${TOUCH_TARGET.min} min-w-[44px] rounded-full bg-white/90 shadow-lg flex items-center justify-center hover:bg-white transition-colors z-10`}
                            aria-label="Previous image"
                        >
                            <ChevronLeft size={20} className="text-gray-700" />
                        </button>
                        <button
                            type="button"
                            onClick={handleNext}
                            className={`absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 ${TOUCH_TARGET.min} min-w-[44px] rounded-full bg-white/90 shadow-lg flex items-center justify-center hover:bg-white transition-colors z-10`}
                            aria-label="Next image"
                        >
                            <ChevronRight size={20} className="text-gray-700" />
                        </button>
                    </>
                )}

                {/* Dot indicators — 10px visual in 44px hit area */}
                {totalImages > 1 && (
                    <div className="flex justify-center gap-2 mt-6">
                        {images.map((_, i) => (
                            <button
                                key={i}
                                type="button"
                                onClick={() => handleDot(i)}
                                className={`${TOUCH_TARGET.min} min-w-[44px] flex items-center justify-center rounded-full transition-all duration-300`}
                                aria-label={`Go to image ${i + 1}`}
                                aria-current={i === currentIndex}
                            >
                                <span
                                    className="w-2.5 h-2.5 rounded-full transition-all duration-300"
                                    style={{
                                        background: i === currentIndex
                                            ? 'var(--brand-primary)'
                                            : 'rgba(var(--brand-primary-rgb), 0.2)',
                                        transform: i === currentIndex ? 'scale(1.3)' : 'scale(1)',
                                    }}
                                />
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </GallerySection>
    )
}

// ── Lightbox Gallery ─────────────────────────────────────────────────────────

function LightboxGallery({ headline, images, theme: _theme }: { headline?: string; images: GalleryConfig['images']; theme: { primaryColor: string } }) {
    void _theme
    const [selectedIndex, setSelectedIndex] = useState<number | null>(null)

    const handlePrev = useCallback(() => {
        setSelectedIndex(prev => (prev !== null && prev > 0 ? prev - 1 : images.length - 1))
    }, [images.length])

    const handleNext = useCallback(() => {
        setSelectedIndex(prev => (prev !== null && prev < images.length - 1 ? prev + 1 : 0))
    }, [images.length])

    const handleClose = useCallback(() => {
        setSelectedIndex(null)
    }, [])

    useEffect(() => {
        if (selectedIndex === null) return
        const handleKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') handleClose()
            if (e.key === 'ArrowLeft') handlePrev()
            if (e.key === 'ArrowRight') handleNext()
        }
        document.addEventListener('keydown', handleKey)
        return () => document.removeEventListener('keydown', handleKey)
    }, [selectedIndex, handleClose, handlePrev, handleNext])

    return (
        <>
            <GallerySection>
                <GalleryHeader headline={headline} />
                <StaggerGrid className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {images.map((item, i) => (
                        <StaggerItem key={i} className="group cursor-pointer" onClick={() => setSelectedIndex(i)}>
                            <GalleryImageCard item={item} aspect="square" overlayClickable />
                        </StaggerItem>
                    ))}
                </StaggerGrid>
            </GallerySection>

            {/* Lightbox Overlay */}
            <AnimatePresence>
                {selectedIndex !== null && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center"
                        onClick={handleClose}
                    >
                        {/* Close button — 44px touch target */}
                        <button
                            type="button"
                            className={`absolute top-4 right-4 text-white/70 hover:text-white transition-colors z-10 ${TOUCH_TARGET.min} min-w-[44px] flex items-center justify-center`}
                            onClick={handleClose}
                            aria-label="Close lightbox"
                        >
                            <X size={28} />
                        </button>

                        {/* Prev button — 44px touch target */}
                        <button
                            type="button"
                            className={`absolute left-4 top-1/2 -translate-y-1/2 text-white/50 hover:text-white transition-colors z-10 ${TOUCH_TARGET.min} min-w-[44px] flex items-center justify-center`}
                            onClick={(e) => { e.stopPropagation(); handlePrev() }}
                            aria-label="Previous image"
                        >
                            <ChevronLeft size={36} />
                        </button>

                        {/* Next button — 44px touch target */}
                        <button
                            type="button"
                            className={`absolute right-4 top-1/2 -translate-y-1/2 text-white/50 hover:text-white transition-colors z-10 ${TOUCH_TARGET.min} min-w-[44px] flex items-center justify-center`}
                            onClick={(e) => { e.stopPropagation(); handleNext() }}
                            aria-label="Next image"
                        >
                            <ChevronRight size={36} />
                        </button>

                        {/* Image */}
                        <motion.div
                            key={selectedIndex}
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            transition={{ duration: 0.2 }}
                            className="max-w-[90vw] max-h-[85vh] flex flex-col items-center"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {images[selectedIndex]?.image?.url && (
                                <img
                                    src={images[selectedIndex]?.image?.url}
                                    alt={images[selectedIndex].caption || images[selectedIndex].image.alt || ''}
                                    className="max-w-full max-h-[80vh] object-contain rounded-lg"
                                />
                            )}
                            {images[selectedIndex]?.caption && (
                                <Body size="small" className="text-white/70 mt-4 text-center">{images[selectedIndex].caption}</Body>
                            )}
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    )
}

// ── Filmstrip Gallery ────────────────────────────────────────────────────────

function FilmstripGallery({ headline, images, theme: _theme }: { headline?: string; images: GalleryConfig['images']; theme: { primaryColor: string } }) {
    void _theme
    const [activeIndex, setActiveIndex] = useState(0)

    return (
        <GallerySection>
            <GalleryHeader headline={headline} />

            {/* Main image */}
            <div className="relative aspect-video rounded-xl overflow-hidden mb-4 max-w-4xl mx-auto">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={activeIndex}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        className="absolute inset-0"
                    >
                        {images[activeIndex]?.image?.url ? (
                            <img
                                src={images[activeIndex].image.url}
                                alt={images[activeIndex].caption || images[activeIndex].image.alt || ''}
                                className="w-full h-full object-cover"
                            />
                        ) : (
                            <div
                                className="w-full h-full flex items-center justify-center"
                                style={{
                                    background: `linear-gradient(135deg, rgba(var(--brand-primary-rgb), 0.06), rgba(var(--brand-primary-rgb), 0.02))`,
                                }}
                                aria-hidden="true"
                            >
                                <span className="text-4xl opacity-20">📷</span>
                            </div>
                        )}
                    </motion.div>
                </AnimatePresence>
                {images[activeIndex]?.caption && (
                    <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/60 to-transparent">
                        <Body size="small" className="text-white font-medium">{images[activeIndex].caption}</Body>
                    </div>
                )}
            </div>

            {/* Thumbnail strip — 80px buttons (>44px ✅) */}
            <div className="max-w-4xl mx-auto overflow-x-auto">
                <div className="flex gap-2 pb-2">
                    {images.map((item, i) => (
                        <button
                            key={i}
                            type="button"
                            onClick={() => setActiveIndex(i)}
                            className="flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden transition-all duration-200"
                            style={{
                                outline: i === activeIndex ? `2px solid var(--brand-primary)` : '2px solid transparent',
                                outlineOffset: '2px',
                                opacity: i === activeIndex ? 1 : 0.6,
                            }}
                            aria-label={`View image ${i + 1}`}
                            aria-current={i === activeIndex}
                        >
                            {item.image?.url ? (
                                <img
                                    src={item.image?.url}
                                    alt={item.caption || item.image.alt || ''}
                                    className="w-full h-full object-cover"
                                />
                            ) : (
                                <div
                                    className="w-full h-full flex items-center justify-center"
                                    style={{
                                        background: `rgba(var(--brand-primary-rgb), 0.06)`,
                                    }}
                                    aria-hidden="true"
                                >
                                    <span className="text-sm opacity-30">📷</span>
                                </div>
                            )}
                        </button>
                    ))}
                </div>
            </div>
        </GallerySection>
    )
}

// ── Justified Gallery ────────────────────────────────────────────────────────

function JustifiedGallery({ headline, images, theme: _theme }: { headline?: string; images: GalleryConfig['images']; theme: { primaryColor: string } }) {
    void _theme
    return (
        <GallerySection>
            <GalleryHeader headline={headline} />
            <StaggerGrid className="flex flex-wrap gap-[2px]">
                {images.map((item, i) => {
                    // Vary aspect ratios for visual interest
                    const flexGrow = [1.2, 0.8, 1, 1.5, 0.9, 1.3][i % 6]
                    return (
                        <StaggerItem
                            key={i}
                            className="group relative overflow-hidden"
                            style={{
                                flexGrow,
                                flexBasis: `${150 * flexGrow}px`,
                                height: '220px',
                            }}
                        >
                            {item.image?.url ? (
                                <>
                                    <img
                                        src={item.image?.url}
                                        alt={item.caption || item.image.alt || ''}
                                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                                    />
                                    <div
                                        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                                        style={{ background: `rgba(var(--brand-primary-rgb), 0.15)` }}
                                    />
                                    {item.caption && (
                                        <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                            <p className="text-white text-xs font-medium">{item.caption}</p>
                                        </div>
                                    )}
                                </>
                            ) : (
                                <div
                                    className="w-full h-full flex items-center justify-center"
                                    style={{
                                        background: `linear-gradient(135deg, rgba(var(--brand-primary-rgb), 0.06), rgba(var(--brand-primary-rgb), 0.02))`,
                                        border: `1px solid rgba(var(--brand-primary-rgb), 0.063)`,
                                    }}
                                    aria-hidden="true"
                                >
                                    <span className="text-2xl opacity-20">📷</span>
                                </div>
                            )}
                        </StaggerItem>
                    )
                })}
            </StaggerGrid>
        </GallerySection>
    )
}
