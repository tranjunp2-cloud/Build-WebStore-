'use client'

import { useState, useRef, useCallback } from 'react'
import type { BlockProps } from '../types'
import type { BeforeAfterConfig } from './config'
import { CSS_VARS } from '@/lib/theme/resolve'
import { AnimatedSection } from '../shared/animations'
import { RichText } from '../shared/RichText'

export function BeforeAfterBlock({ block, theme }: BlockProps<BeforeAfterConfig>) {
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
            <AnimatedSection className="py-24">
                <div className="container mx-auto px-6">
                    {headline && (
                        <RichText text={headline} as="h2" className="text-3xl md:text-5xl font-bold font-heading text-center mb-12" />
                    )}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="relative rounded-2xl overflow-hidden" style={{ border: `1px solid rgba(var(--brand-primary-rgb), 0.125)` }}>
                            <img src={beforeImage?.url} alt={beforeImage?.alt || 'Before'} className="w-full h-auto object-cover" />
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
                            <img src={afterImage?.url} alt={afterImage?.alt || 'After'} className="w-full h-auto object-cover" />
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
        <AnimatedSection className="py-24">
            <div className="container mx-auto px-6">
                {headline && (
                    <RichText text={headline} as="h2" className="text-3xl md:text-5xl font-bold font-heading text-center mb-12" />
                )}
                <div
                    ref={containerRef}
                    className="relative rounded-2xl overflow-hidden select-none touch-none cursor-ew-resize max-w-4xl mx-auto"
                    style={{ border: `1px solid rgba(var(--brand-primary-rgb), 0.125)` }}
                    onPointerDown={onPointerDown}
                    onPointerMove={onPointerMove}
                    onPointerUp={onPointerUp}
                >
                    {/* After image (full) */}
                    <img src={afterImage?.url} alt={afterImage?.alt || 'After'} className="w-full h-auto block" draggable={false} />

                    {/* Before image (clipped) */}
                    <div className="absolute inset-0 overflow-hidden" style={{ width: `${position}%` }}>
                        <img
                            src={beforeImage?.url}
                            alt={beforeImage?.alt || 'Before'}
                            className="h-full object-cover"
                            style={{ width: containerRef.current ? `${containerRef.current.offsetWidth}px` : '100vw' }}
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
                    {beforeImage.label && (
                        <span className="absolute bottom-4 left-4 z-20 px-3 py-1 rounded-full text-sm font-medium text-white bg-black/50 backdrop-blur-sm">
                            {beforeImage.label}
                        </span>
                    )}
                    {afterImage.label && (
                        <span className="absolute bottom-4 right-4 z-20 px-3 py-1 rounded-full text-sm font-medium text-white bg-black/50 backdrop-blur-sm">
                            {afterImage.label}
                        </span>
                    )}
                </div>
            </div>
        </AnimatedSection>
    )
}
