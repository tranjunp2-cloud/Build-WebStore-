'use client'

import { useState, useRef, useCallback } from 'react'
import Image from 'next/image'
import type { BlockProps } from '../types'
import type { BeforeAfterConfig } from './config'
import { CSS_VARS as _CSS_VARS } from '@/lib/theme/resolve'
import { AnimatedSection } from '../shared/animations'
import { RichText } from '../shared/RichText'
import { Heading } from '../shared/Typography'
import { CONTAINER, INNER_PADDING, SECTION_PADDING } from '@/lib/design-tokens'
import { MediaUploadOverlay } from '@/blocks/shared/media-upload-overlay'

void _CSS_VARS

export function BeforeAfterBlock({ block, theme: _theme }: BlockProps<BeforeAfterConfig>) {
    void _theme
    const { variant = 'slider', headline, beforeImage, afterImage } = block

    const containerRef = useRef<HTMLDivElement>(null)
    const [position, setPosition] = useState(50)
    const [isDragging, setIsDragging] = useState(false)

    const handleMove = useCallback(
        (clientX: number) => {
            if (!containerRef.current) return
            const rect = containerRef.current.getBoundingClientRect()
            const x = Math.max(0, Math.min(clientX - rect.left, rect.width))
            setPosition((x / rect.width) * 100)
        },
        [],
    )

    const onPointerDown = useCallback(
        (e: React.PointerEvent) => {
            setIsDragging(true)
            handleMove(e.clientX)
            ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
        },
        [handleMove],
    )

    const onPointerMove = useCallback(
        (e: React.PointerEvent) => {
            if (!isDragging) return
            handleMove(e.clientX)
        },
        [isDragging, handleMove],
    )

    const onPointerUp = useCallback(() => {
        setIsDragging(false)
    }, [])

    if (variant === 'side-by-side') {
        return (
            <AnimatedSection className={SECTION_PADDING.default}>
                <div className={`${CONTAINER.default} mx-auto ${INNER_PADDING}`}>
                    {headline && (
                        <Heading level={2} className="text-center mb-12">
                            <RichText text={headline} as="span" />
                        </Heading>
                    )}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="relative rounded-2xl overflow-hidden" style={{ border: `1px solid rgba(var(--brand-primary-rgb), 0.125)` }}>
                            <MediaUploadOverlay field="beforeImage" altText={beforeImage?.alt || 'Before'} valueShape="url-group">
                                <Image src={beforeImage?.url || '/placeholder.png'} alt={beforeImage?.alt || 'Before'} width={0} height={0} sizes="100vw" className="w-full h-auto block" />
                            </MediaUploadOverlay>
                            {beforeImage.label && (
                                <span
                                    className="absolute top-4 left-4 px-3 py-1 rounded-full text-sm font-medium text-white"
                                    style={{ background: 'var(--brand-primary)' }}
                                >
                                    {beforeImage.label}
                                </span>
                            )}
                        </div>
                        <div className="relative rounded-2xl overflow-hidden" style={{ border: `1px solid rgba(var(--brand-primary-rgb), 0.125)` }}>
                            <MediaUploadOverlay field="afterImage" altText={afterImage?.alt || 'After'} valueShape="url-group">
                                <Image src={afterImage?.url || '/placeholder.png'} alt={afterImage?.alt || 'After'} width={0} height={0} sizes="100vw" className="w-full h-auto block" />
                            </MediaUploadOverlay>
                            {afterImage.label && (
                                <span
                                    className="absolute top-4 left-4 px-3 py-1 rounded-full text-sm font-medium text-white"
                                    style={{ background: 'var(--brand-primary)' }}
                                >
                                    {afterImage.label}
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            </AnimatedSection>
        )
    }

    // slider (default)
    return (
        <AnimatedSection className={SECTION_PADDING.default}>
            <div className={`${CONTAINER.default} mx-auto ${INNER_PADDING}`}>
                {headline && (
                    <Heading level={2} className="text-center mb-12">
                        <RichText text={headline} as="span" />
                    </Heading>
                )}
                <div
                    ref={containerRef}
                    className="relative rounded-2xl overflow-hidden select-none touch-none cursor-ew-resize max-w-4xl mx-auto"
                    style={{ border: `1px solid rgba(var(--brand-primary-rgb), 0.125)` }}
                    onPointerDown={onPointerDown}
                    onPointerMove={onPointerMove}
                    onPointerUp={onPointerUp}
                >
                    {/* After image (full) — drives container height */}
                    <Image src={afterImage?.url || '/placeholder.png'} alt={afterImage?.alt || 'After'} width={0} height={0} sizes="100vw" className="w-full h-auto block" draggable={false} />

                    {/* Before image (clipped) */}
                    <div className="absolute inset-0 overflow-hidden" style={{ width: `${position}%` }}>
                        <Image
                            src={beforeImage?.url || '/placeholder.png'}
                            alt={beforeImage?.alt || 'Before'}
                            fill
                            className="object-cover"
                            draggable={false}
                        />
                    </div>

                    {/* Divider line */}
                    <div className="absolute inset-y-0 z-10 w-0.5" style={{ left: `${position}%`, background: 'var(--brand-primary)' }}>
                        <div
                            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 rounded-full flex items-center justify-center shadow-lg"
                            style={{ background: 'var(--brand-primary)' }}
                        >
                            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="text-white">
                                <path d="M6 10L2 10M2 10L5 7M2 10L5 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                <path d="M14 10L18 10M18 10L15 7M18 10L15 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                        </div>
                    </div>

                    {/* Labels */}
                    {beforeImage?.label && (
                        <span className="absolute bottom-4 left-4 z-20 px-3 py-1 rounded-full text-sm font-medium text-white bg-black/50 backdrop-blur-sm">
                            {beforeImage.label}
                        </span>
                    )}
                    {afterImage?.label && (
                        <span className="absolute bottom-4 right-4 z-20 px-3 py-1 rounded-full text-sm font-medium text-white bg-black/50 backdrop-blur-sm">
                            {afterImage.label}
                        </span>
                    )}
                </div>
            </div>
        </AnimatedSection>
    )
}
