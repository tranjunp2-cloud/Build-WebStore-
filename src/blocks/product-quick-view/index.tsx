'use client'

import { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { BlockProps } from '../types'
import type { ProductQuickViewConfig, QuickViewProduct } from './config'
import { AnimatedSection } from '../shared/animations'
import { RichText } from '../shared/RichText'
import { Heading, Body, Caption } from '../shared/Typography'
import {
    CONTAINER,
    INNER_PADDING,
    SECTION_PADDING,
    CARD_PADDING,
    TOUCH_TARGET,
} from '@/lib/design-tokens'

// ── Local helpers (Phase 05 refactor) ───────────────────────────────────────

const PRODUCT_CONTAINER = `${CONTAINER.default} mx-auto ${INNER_PADDING}`

/** Image placeholder used in card + modal. */
function ImagePlaceholder({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
    const iconSize = size === 'lg' ? 'w-16 h-16' : size === 'md' ? 'w-12 h-12' : 'w-8 h-8'
    return (
        <div
            className="w-full h-full flex items-center justify-center"
            style={{ background: `rgba(var(--brand-primary-rgb), 0.04)` }}
        >
            <svg className={`${iconSize} opacity-20`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
            </svg>
        </div>
    )
}

/** Carousel arrow button — used in carousel variant (prev/next). */
function CarouselArrow({
    direction,
    onClick,
    label,
}: {
    direction: 'left' | 'right'
    onClick: () => void
    label: string
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`rounded-full flex items-center justify-center transition-opacity hover:opacity-80 ${TOUCH_TARGET.min} min-w-[44px]`}
            style={{ background: `rgba(var(--brand-primary-rgb), 0.082)` }}
            aria-label={label}
        >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                {direction === 'left' ? (
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                )}
            </svg>
        </button>
    )
}

function QuickViewModal({
    product,
    currency,
    onClose,
}: {
    product: QuickViewProduct
    currency: string
    onClose: () => void
}) {
    const [selectedImage, setSelectedImage] = useState(0)
    const images = product.imageUrls.length > 0 ? product.imageUrls : []

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.6)' }}
            onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
            role="dialog"
            aria-modal="true"
            aria-label={`Quick view: ${product.name}`}
        >
            <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl"
                style={{ background: 'var(--brand-surface, #fff)', border: `1px solid rgba(var(--brand-primary-rgb), 0.125)` }}
            >
                <div className="grid grid-cols-1 md:grid-cols-2">
                    {/* Images */}
                    <div className="relative aspect-square overflow-hidden">
                        {images.length > 0 ? (
                            <img src={images[selectedImage]} alt={product.name} className="w-full h-full object-cover" />
                        ) : (
                            <ImagePlaceholder size="lg" />
                        )}
                        {images.length > 1 && (
                            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                                {images.map((_, i) => (
                                    <button
                                        key={i}
                                        type="button"
                                        onClick={() => setSelectedImage(i)}
                                        className={`flex items-center justify-center ${TOUCH_TARGET.min} min-w-[44px]`}
                                        aria-label={`View image ${i + 1}`}
                                        aria-current={i === selectedImage}
                                    >
                                        <span
                                            className="w-2 h-2 rounded-full transition-colors block"
                                            style={{ background: i === selectedImage ? '#fff' : 'rgba(255,255,255,0.5)' }}
                                        />
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Details */}
                    <div className={CARD_PADDING.md}>
                        <div className="flex items-start justify-between mb-4">
                            <div>
                                {product.badge && (
                                    <span
                                        className="px-2 py-0.5 rounded-full text-xs font-bold mb-2 inline-block"
                                        style={{ background: 'var(--brand-primary)', color: '#fff' }}
                                    >
                                        {product.badge}
                                    </span>
                                )}
                                <Heading level={3}>{product.name}</Heading>
                            </div>
                            <button
                                type="button"
                                onClick={onClose}
                                className={`flex items-center justify-center rounded-full opacity-50 hover:opacity-100 transition-opacity ${TOUCH_TARGET.min} min-w-[44px]`}
                                aria-label="Close"
                            >
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        <div className="flex items-center gap-2 mb-4">
                            <span className="text-2xl font-bold" style={{ color: 'var(--brand-primary)' }}>
                                {currency} {product.price.toFixed(2)}
                            </span>
                            {product.originalPrice && product.originalPrice > product.price && (
                                <Body size="small" className="line-through opacity-40">
                                    {currency} {product.originalPrice.toFixed(2)}
                                </Body>
                            )}
                        </div>

                        {product.description && (
                            <Body size="small" className="opacity-60 leading-relaxed mb-4">{product.description}</Body>
                        )}

                        {product.variants && product.variants.length > 0 && (
                            <div className="mb-6">
                                <Caption className="font-semibold uppercase tracking-wider opacity-40 mb-2 block">Options</Caption>
                                <div className="flex flex-wrap gap-2">
                                    {product.variants.map((v, i) => (
                                        <span
                                            key={i}
                                            className="px-3 py-1.5 rounded-lg text-sm font-medium cursor-pointer transition-all"
                                            style={{ border: `1px solid rgba(var(--brand-primary-rgb), 0.125)` }}
                                        >
                                            {v}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {product.ctaUrl ? (
                            <a
                                href={product.ctaUrl}
                                className={`block w-full py-3 rounded-xl font-semibold text-center text-white transition-opacity hover:opacity-90 ${TOUCH_TARGET.min}`}
                                style={{ background: 'var(--brand-primary)' }}
                            >
                                {product.ctaLabel || 'Add to Cart'}
                            </a>
                        ) : (
                            <button
                                type="button"
                                className={`w-full py-3 rounded-xl font-semibold text-white transition-opacity hover:opacity-90 ${TOUCH_TARGET.min}`}
                                style={{ background: 'var(--brand-primary)' }}
                            >
                                {product.ctaLabel || 'Add to Cart'}
                            </button>
                        )}
                    </div>
                </div>
            </motion.div>
        </motion.div>
    )
}

export function ProductQuickViewBlock({ block }: BlockProps<ProductQuickViewConfig>) {
    const {
        headline,
        subheadline,
        products = [],
        variant = 'grid',
        columns = 4,
        showQuickView = true,
        currency = 'RM',
    } = block

    const [quickViewProduct, setQuickViewProduct] = useState<QuickViewProduct | null>(null)
    const scrollRef = useRef<HTMLDivElement>(null)

    const colClass = columns === 2
        ? 'grid-cols-1 sm:grid-cols-2'
        : columns === 3
            ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
            : 'grid-cols-2 sm:grid-cols-2 lg:grid-cols-4'

    const ProductCard = ({ product, minimal = false }: { product: QuickViewProduct; minimal?: boolean }) => (
        <div
            className="group rounded-2xl overflow-hidden transition-shadow duration-300 hover:shadow-lg"
            style={{ border: `1px solid rgba(var(--brand-primary-rgb), 0.082)` }}
        >
            <div className="relative aspect-square overflow-hidden">
                {product.imageUrls[0] ? (
                    <img src={product.imageUrls[0]} alt={product.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                ) : (
                    <ImagePlaceholder size="md" />
                )}
                {product.badge && (
                    <span
                        className="absolute top-3 left-3 px-2 py-0.5 rounded-full text-xs font-bold"
                        style={{ background: 'var(--brand-primary)', color: '#fff' }}
                    >
                        {product.badge}
                    </span>
                )}
                {!minimal && showQuickView && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/30 transition-colors duration-300">
                        <button
                            type="button"
                            onClick={() => setQuickViewProduct(product)}
                            className={`px-4 rounded-xl font-semibold text-sm text-white opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0 ${TOUCH_TARGET.min}`}
                            style={{ background: 'var(--brand-primary)' }}
                        >
                            Quick View
                        </button>
                    </div>
                )}
            </div>
            <div className={CARD_PADDING.sm}>
                <Heading level={4} className="text-sm mb-1 line-clamp-1">{product.name}</Heading>
                <div className="flex items-center gap-2">
                    <span className="font-bold" style={{ color: 'var(--brand-primary)' }}>
                        {currency} {product.price.toFixed(2)}
                    </span>
                    {product.originalPrice && product.originalPrice > product.price && (
                        <Caption className="line-through opacity-40">
                            {currency} {product.originalPrice.toFixed(2)}
                        </Caption>
                    )}
                </div>
            </div>
        </div>
    )

    /* ── Grid ────────────────────────────────────────────────────────────────── */
    const renderGrid = () => (
        <div className={`grid ${colClass} gap-6`}>
            {products.map((product, i) => (
                <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 16 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.03 }}
                >
                    <ProductCard product={product} />
                </motion.div>
            ))}
        </div>
    )

    /* ── Carousel ────────────────────────────────────────────────────────────── */
    const renderCarousel = () => {
        const scroll = (dir: 'left' | 'right') => {
            if (!scrollRef.current) return
            scrollRef.current.scrollBy({ left: dir === 'left' ? -280 : 280, behavior: 'smooth' })
        }
        return (
            <div className="relative">
                <div
                    ref={scrollRef}
                    className="flex gap-6 overflow-x-auto snap-x snap-mandatory scrollbar-hide pb-4 -mx-6 px-6"
                >
                    {products.map((product, i) => (
                        <div key={i} className="snap-start shrink-0 w-[260px]">
                            <ProductCard product={product} />
                        </div>
                    ))}
                </div>
                {products.length > 4 && (
                    <div className="flex justify-center gap-3 mt-6">
                        <CarouselArrow direction="left" onClick={() => scroll('left')} label="Previous products" />
                        <CarouselArrow direction="right" onClick={() => scroll('right')} label="Next products" />
                    </div>
                )}
            </div>
        )
    }

    /* ── Minimal ─────────────────────────────────────────────────────────────── */
    const renderMinimal = () => (
        <div className={`grid ${colClass} gap-6`}>
            {products.map((product, i) => (
                <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 16 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.03 }}
                >
                    <ProductCard product={product} minimal />
                </motion.div>
            ))}
        </div>
    )

    return (
        <AnimatedSection className={SECTION_PADDING.default}>
            <div className={PRODUCT_CONTAINER}>
                <div className="text-center max-w-2xl mx-auto mb-12">
                    <Heading level={2} className="mb-5 leading-tight">
                        <RichText text={headline} as="span" />
                    </Heading>
                    {subheadline && (
                        <Body size="lg" className="opacity-50 leading-relaxed">
                            <RichText text={subheadline} as="span" />
                        </Body>
                    )}
                </div>

                {variant === 'grid' && renderGrid()}
                {variant === 'carousel' && renderCarousel()}
                {variant === 'minimal' && renderMinimal()}
            </div>

            <AnimatePresence>
                {quickViewProduct && (
                    <QuickViewModal
                        product={quickViewProduct}
                        currency={currency}
                        onClose={() => setQuickViewProduct(null)}
                    />
                )}
            </AnimatePresence>
        </AnimatedSection>
    )
}
