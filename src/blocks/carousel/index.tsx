'use client'

import { SlideshowArrow as ArrowButton, SlideshowDot } from '../shared/slideshow-controls'
import { useState, useEffect, useCallback } from 'react'
import Image from 'next/image'
import type { BlockProps } from '../types'
import type { CarouselConfig } from './config'
import { AnimatedSection } from '../shared/animations'
import { RichText } from '../shared/RichText'
import { Heading, Body } from '../shared/Typography'
import { CARD_PADDING } from '@/lib/design-tokens'
import { SectionWrapper } from '@/blocks/shared/SectionWrapper'
import { getGalleryImages } from '@/lib/images/industry-images'
import { MediaUploadOverlay } from '@/blocks/shared/media-upload-overlay'

export function CarouselBlock({ block, theme: _theme, site }: BlockProps<CarouselConfig>) {
    void _theme
    const { headline, items: rawItems = [], variant = 'images', autoplay = true, interval = 5000 } = block
    const category = (site?.siteType as string) || 'business'

    // Per-slot fallback: prefer item.image.url (Payload upload), fallback to imageUrl (AI gen string), then Unsplash
    const fallbackUrls = getGalleryImages(category, 6, site?.imageLibraryS3 as Record<string, string> | undefined)
    const itemCount = rawItems.length > 0 ? rawItems.length : fallbackUrls.length
    const items = Array.from({ length: itemCount }, (_, i) => {
        const item = rawItems[i]
        const imgSrc = (item?.image as { url?: string } | undefined)?.url || item?.imageUrl
        if (imgSrc) return { ...item, imageUrl: imgSrc }
        return { ...item, imageUrl: fallbackUrls[i % fallbackUrls.length] ?? fallbackUrls[0], title: item?.title || '', description: item?.description || '' }
    })
    const [currentIndex, setCurrentIndex] = useState(0)
    const total = items.length
    const [desktop, setDesktop] = useState(false)
    useEffect(() => {
        const media = window.matchMedia('(min-width: 768px)')
        const update = () => setDesktop(media.matches)
        update(); media.addEventListener('change', update)
        return () => media.removeEventListener('change', update)
    }, [])
    const visible = variant === 'testimonials' ? 1 : Math.min(total || 1, desktop ? (block.slidesPerView || 1) : 1)
    const positions = Math.max(1, total - visible + 1)
    const activeIndex = Math.min(currentIndex, positions - 1)
    const fit = block.imageFit || 'cover'
    const imageStyle = { objectFit: fit }
    const frameStyle = { aspectRatio: block.aspectRatio || (variant === 'images' ? 16 / 9 : 16 / 10) }
    const viewportStyle = block.maxImageWidth ? { maxWidth: block.maxImageWidth * visible, marginInline: 'auto' } : undefined

    const goTo = useCallback((index: number) => {
        setCurrentIndex(((index % positions) + positions) % positions)
    }, [positions])

    const prev = useCallback(() => goTo(activeIndex - 1), [goTo, activeIndex])
    const next = useCallback(() => goTo(activeIndex + 1), [goTo, activeIndex])

    useEffect(() => {
        if (!autoplay || positions <= 1) return
        const timer = setInterval(() => {
            setCurrentIndex((prev) => (prev + 1) % positions)
        }, interval)
        return () => clearInterval(timer)
    }, [autoplay, interval, positions])

    if (total === 0) return null

    const Dots = () => (
        <div className="flex justify-center mt-6">
            {items.slice(0, positions).map((_, i) => (
                <SlideshowDot key={i} active={i === activeIndex} onClick={() => goTo(i)} label={`Go to slide ${i + 1}`} />
            ))}
        </div>
    )

    // Images variant
    if (variant === 'images') {
        return (
            <SectionWrapper as={AnimatedSection} padding="default" container="wide" background="transparent">
                {headline && (
                    <div className="text-center mb-12">
                        <Heading level={2}>
                            <RichText text={headline} as="span" />
                        </Heading>
                    </div>
                )}
                <div className="relative overflow-hidden rounded-2xl" style={viewportStyle} data-carousel-viewport>
                    <div
                        className="flex transition-transform duration-500 ease-in-out"
                        style={{ transform: `translateX(-${activeIndex * 100 / visible}%)` }}
                    >
                        {items.map((item, i) => (
                            <div key={i} className="shrink-0" style={{ width: `${100 / visible}%` }}>
                                <div className="relative" style={frameStyle}>
                                    {i < rawItems.length ? (
                                        <MediaUploadOverlay
                                            field={`items.${i}.image`}
                                            altText={item.title || `Slide ${i + 1}`}
                                            valueShape="media"
                                            positionClass="relative"
                                            className="w-full h-full"
                                        >
                                            <img
                                                src={item.imageUrl}
                                                alt={item.title || `Slide ${i + 1}`}
                                                className="w-full h-full" style={imageStyle}
                                                data-image-index={i}
                                            />
                                        </MediaUploadOverlay>
                                    ) : (
                                        <img
                                            src={item.imageUrl}
                                            alt={item.title || `Slide ${i + 1}`}
                                            className="w-full h-full" style={imageStyle}
                                            data-image-index={i}
                                        />
                                    )}
                                    {(item.title || item.description) && (
                                        <div className="absolute bottom-0 left-0 right-0 p-6 md:p-10 bg-gradient-to-t from-black/70 to-transparent">
                                            {item.title && <Heading level={3} className="text-white mb-2">{item.title}</Heading>}
                                            {item.description && <Body size="small" className="text-white/80">{item.description}</Body>}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                    {positions > 1 && (
                        <>
                            <ArrowButton direction="left" onClick={prev} />
                            <ArrowButton direction="right" onClick={next} />
                        </>
                    )}
                </div>
                {positions > 1 && <Dots />}
            </SectionWrapper>
        )
    }

    // Cards variant
    if (variant === 'cards') {
        return (
            <SectionWrapper as={AnimatedSection} padding="default" container="wide" background="transparent">
                {headline && (
                    <div className="text-center mb-12">
                        <Heading level={2}>
                            <RichText text={headline} as="span" />
                        </Heading>
                    </div>
                )}
                <div className="relative overflow-hidden" style={viewportStyle} data-carousel-viewport>
                    <div
                        className="flex transition-transform duration-500 ease-in-out"
                        style={{ transform: `translateX(-${activeIndex * 100 / visible}%)` }}
                    >
                        {items.map((item, i) => {
                            const Wrapper = item.linkUrl ? 'a' : 'div'
                            const linkProps = item.linkUrl ? { href: item.linkUrl, target: '_blank' as const, rel: 'noopener noreferrer' } : {}
                            return (
                                <div key={i} className="shrink-0 px-4" style={{ width: `${100 / visible}%` }}>
                                    <Wrapper
                                        {...linkProps}
                                        className="block rounded-2xl overflow-hidden transition-shadow hover:shadow-lg"
                                        style={{ border: `1px solid rgba(var(--brand-primary-rgb), 0.082)` }}
                                    >
                                        <div className="relative overflow-hidden" style={frameStyle}>
                                            {i < rawItems.length ? (
                                                <MediaUploadOverlay
                                                    field={`items.${i}.image`}
                                                    altText={item.title || `Slide ${i + 1}`}
                                                    valueShape="media"
                                                    positionClass="relative"
                                                    className="w-full h-full"
                                                >
                                                    <Image src={item.imageUrl} alt={item.title || ''} fill style={imageStyle} sizes="(max-width: 768px) 100vw, 1200px" data-image-index={i} />
                                                </MediaUploadOverlay>
                                            ) : (
                                                <Image src={item.imageUrl} alt={item.title || ''} fill style={imageStyle} sizes="(max-width: 768px) 100vw, 1200px" data-image-index={i} />
                                            )}
                                        </div>
                                        {(item.title || item.description) && <div className={CARD_PADDING.md}>
                                            {item.title && <Heading level={4} className="text-lg mb-2">{item.title}</Heading>}
                                            {item.description && <Body size="small" className="opacity-50 leading-relaxed">{item.description}</Body>}
                                        </div>}
                                    </Wrapper>
                                </div>
                            )
                        })}
                    </div>
                    {positions > 1 && (
                        <>
                            <ArrowButton direction="left" onClick={prev} />
                            <ArrowButton direction="right" onClick={next} />
                        </>
                    )}
                </div>
                {positions > 1 && <Dots />}
            </SectionWrapper>
        )
    }

    // Testimonials variant
    if (variant === 'testimonials') return (
        <SectionWrapper as={AnimatedSection} padding="default" container="wide" background="transparent">
            {headline && (
                <div className="text-center mb-12">
                    <Heading level={2}>
                        <RichText text={headline} as="span" />
                    </Heading>
                </div>
            )}
            <div className="relative max-w-3xl mx-auto overflow-hidden">
                <div
                    className="flex transition-transform duration-500 ease-in-out"
                    style={{ transform: `translateX(-${activeIndex * 100 / visible}%)` }}
                >
                    {items.map((item, i) => (
                        <div key={i} className="shrink-0 px-4" style={{ width: `${100 / visible}%` }}>
                            <div
                                className="p-8 md:p-12 rounded-2xl text-center"
                                style={{ background: `rgba(var(--brand-primary-rgb), 0.024)`, border: `1px solid rgba(var(--brand-primary-rgb), 0.071)` }}
                            >
                                {item.imageUrl && (
                                    i < rawItems.length ? (
                                        <MediaUploadOverlay
                                            field={`items.${i}.image`}
                                            altText={item.title || `Slide ${i + 1}`}
                                            valueShape="media"
                                            positionClass="relative"
                                            className="w-16 h-16 rounded-full mx-auto mb-6 overflow-hidden"
                                        >
                                            <img
                                                src={item.imageUrl}
                                                alt={item.title || ''}
                                                className="w-full h-full object-cover"
                                                style={{ border: `2px solid rgba(var(--brand-primary-rgb), 0.188)` }}
                                                data-image-index={i}
                                            />
                                        </MediaUploadOverlay>
                                    ) : (
                                        <img
                                            src={item.imageUrl}
                                            alt={item.title || ''}
                                            className="w-16 h-16 rounded-full mx-auto mb-6 object-cover"
                                            style={{ border: `2px solid rgba(var(--brand-primary-rgb), 0.188)` }}
                                            data-image-index={i}
                                        />
                                    )
                                )}
                                {item.description && (
                                    <blockquote className="text-lg md:text-xl leading-relaxed opacity-80 mb-6 italic">
                                        &ldquo;{item.description}&rdquo;
                                    </blockquote>
                                )}
                                {item.title && (
                                    <RichText text={item.title} as="p" className="font-bold font-heading" style={{ color: 'var(--brand-primary)' }} />
                                )}
                            </div>
                        </div>
                    ))}
                </div>
                {positions > 1 && (
                    <>
                        <ArrowButton direction="left" onClick={prev} />
                        <ArrowButton direction="right" onClick={next} />
                    </>
                )}
            </div>
            {positions > 1 && <Dots />}
        </SectionWrapper>
    )

    // Default: images
    return null
}
