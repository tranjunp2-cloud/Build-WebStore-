'use client'

import { useState, useEffect, useCallback } from 'react'
import type { BlockProps } from '../types'
import type { CarouselConfig } from './config'
import { CSS_VARS } from '@/lib/theme/resolve'
import { AnimatedSection } from '../shared/animations'
import { RichText } from '../shared/RichText'
import { Heading, Body } from '../shared/Typography'
import { TOUCH_TARGET, CARD_PADDING } from '@/lib/design-tokens'
import { SectionWrapper } from '@/blocks/shared/SectionWrapper'
import { getGalleryImages } from '@/lib/images/industry-images'

export function CarouselBlock({ block, theme: _theme, site }: BlockProps<CarouselConfig>) {
    void _theme
    const { headline, items: rawItems = [], variant = 'images', autoplay = true, interval = 5000 } = block
    const category = (site?.siteType as string) || 'business'

    // Per-slot fallback: prefer item.image.url (Payload upload), fallback to imageUrl (AI gen string), then Unsplash
    const fallbackUrls = getGalleryImages(category, 6)
    const items = Array.from({ length: Math.max(rawItems.length, fallbackUrls.length) }, (_, i) => {
        const item = rawItems[i]
        const imgSrc = (item?.image as { url?: string } | undefined)?.url || item?.imageUrl
        if (imgSrc) return { ...item, imageUrl: imgSrc }
        return { ...item, imageUrl: fallbackUrls[i % fallbackUrls.length] ?? fallbackUrls[0], title: item?.title || '', description: item?.description || '' }
    })
    const [currentIndex, setCurrentIndex] = useState(0)
    const total = items.length

    const goTo = useCallback((index: number) => {
        setCurrentIndex(((index % total) + total) % total)
    }, [total])

    const prev = useCallback(() => goTo(currentIndex - 1), [goTo, currentIndex])
    const next = useCallback(() => goTo(currentIndex + 1), [goTo, currentIndex])

    useEffect(() => {
        if (!autoplay || total <= 1) return
        const timer = setInterval(() => {
            setCurrentIndex((prev) => (prev + 1) % total)
        }, interval)
        return () => clearInterval(timer)
    }, [autoplay, interval, total])

    if (total === 0) return null

    const ArrowButton = ({ direction, onClick }: { direction: 'left' | 'right'; onClick: () => void }) => (
        <button
            type="button"
            onClick={onClick}
            className={`absolute top-1/2 -translate-y-1/2 ${TOUCH_TARGET.min} min-w-[44px] md:w-12 md:h-12 rounded-full flex items-center justify-center transition-all duration-200 hover:scale-110 z-20 backdrop-blur-sm`}
            style={{
                [direction === 'left' ? 'left' : 'right']: '12px',
                background: `rgba(var(--brand-primary-rgb), 0.188)`,
                color: '#fff',
            }}
            aria-label={direction === 'left' ? 'Previous slide' : 'Next slide'}
        >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d={direction === 'left' ? 'M15 19l-7-7 7-7' : 'M9 5l7 7-7 7'} />
            </svg>
        </button>
    )

    const Dots = () => (
        <div className="flex justify-center gap-2 mt-6">
            {items.map((_, i) => (
                <button
                    key={i}
                    type="button"
                    onClick={() => goTo(i)}
                    className={`${TOUCH_TARGET.min} min-w-[44px] flex items-center justify-center rounded-full transition-all duration-300`}
                    aria-label={`Go to slide ${i + 1}`}
                    aria-current={i === currentIndex}
                >
                    <span
                        className="w-2.5 h-2.5 rounded-full transition-all duration-300"
                        style={{
                            background: i === currentIndex ? CSS_VARS.primary : `rgba(var(--brand-primary-rgb), 0.188)`,
                            transform: i === currentIndex ? 'scale(1.3)' : 'scale(1)',
                        }}
                    />
                </button>
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
                <div className="relative overflow-hidden rounded-2xl">
                    <div
                        className="flex transition-transform duration-500 ease-in-out"
                        style={{ transform: `translateX(-${currentIndex * 100}%)` }}
                    >
                        {items.map((item, i) => (
                            <div key={i} className="w-full shrink-0">
                                <div className="aspect-[16/9] relative">
                                    <img
                                        src={item.imageUrl}
                                        alt={item.title || `Slide ${i + 1}`}
                                        className="w-full h-full object-cover"
                                        data-image-index={i}
                                    />
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
                    {total > 1 && (
                        <>
                            <ArrowButton direction="left" onClick={prev} />
                            <ArrowButton direction="right" onClick={next} />
                        </>
                    )}
                </div>
                {total > 1 && <Dots />}
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
                <div className="relative overflow-hidden">
                    <div
                        className="flex transition-transform duration-500 ease-in-out"
                        style={{ transform: `translateX(-${currentIndex * 100}%)` }}
                    >
                        {items.map((item, i) => {
                            const Wrapper = item.linkUrl ? 'a' : 'div'
                            const linkProps = item.linkUrl ? { href: item.linkUrl, target: '_blank' as const, rel: 'noopener noreferrer' } : {}
                            return (
                                <div key={i} className="w-full shrink-0 px-4">
                                    <Wrapper
                                        {...linkProps}
                                        className="block rounded-2xl overflow-hidden transition-shadow hover:shadow-lg"
                                        style={{ border: `1px solid rgba(var(--brand-primary-rgb), 0.082)` }}
                                    >
                                        <div className="aspect-[16/10] overflow-hidden">
                                            <img src={item.imageUrl} alt={item.title || ''} className="w-full h-full object-cover" data-image-index={i} />
                                        </div>
                                        <div className={CARD_PADDING.md}>
                                            {item.title && <Heading level={4} className="text-lg mb-2">{item.title}</Heading>}
                                            {item.description && <Body size="small" className="opacity-50 leading-relaxed">{item.description}</Body>}
                                        </div>
                                    </Wrapper>
                                </div>
                            )
                        })}
                    </div>
                    {total > 1 && (
                        <>
                            <ArrowButton direction="left" onClick={prev} />
                            <ArrowButton direction="right" onClick={next} />
                        </>
                    )}
                </div>
                {total > 1 && <Dots />}
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
                    style={{ transform: `translateX(-${currentIndex * 100}%)` }}
                >
                    {items.map((item, i) => (
                        <div key={i} className="w-full shrink-0 px-4">
                            <div
                                className="p-8 md:p-12 rounded-2xl text-center"
                                style={{ background: `rgba(var(--brand-primary-rgb), 0.024)`, border: `1px solid rgba(var(--brand-primary-rgb), 0.071)` }}
                            >
                                {item.imageUrl && (
                                    <img
                                        src={item.imageUrl}
                                        alt={item.title || ''}
                                        className="w-16 h-16 rounded-full mx-auto mb-6 object-cover"
                                        style={{ border: `2px solid rgba(var(--brand-primary-rgb), 0.188)` }}
                                        data-image-index={i}
                                    />
                                )}
                                {item.description && (
                                    <blockquote className="text-lg md:text-xl leading-relaxed opacity-80 mb-6 italic">
                                        &ldquo;{item.description}&rdquo;
                                    </blockquote>
                                )}
                                {item.title && (
                                    <p className="font-bold font-heading" style={{ color: 'var(--brand-primary)' }}>{item.title}</p>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
                {total > 1 && (
                    <>
                        <ArrowButton direction="left" onClick={prev} />
                        <ArrowButton direction="right" onClick={next} />
                    </>
                )}
            </div>
            {total > 1 && <Dots />}
        </SectionWrapper>
    )

    // Default: images
    return null
}
