'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import type { BlockProps } from '../types'
import type { PropertyCardConfig, PropertyItem } from './config'
import { CSS_VARS } from '@/lib/theme/resolve'
import { AnimatedSection } from '../shared/animations'

function BedIcon() {
    return (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M2 17V7a2 2 0 012-2h16a2 2 0 012 2v10M2 17h20M6 11h12a2 2 0 012 2v4H4v-4a2 2 0 012-2z" />
        </svg>
    )
}

function BathIcon() {
    return (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 13h18v4a3 3 0 01-3 3H6a3 3 0 01-3-3v-4zM5 13V7a3 3 0 016 0v1" />
        </svg>
    )
}

function AreaIcon() {
    return (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
        </svg>
    )
}

function PropertySpecs({ property }: { property: PropertyItem }) {
    return (
        <div className="flex items-center gap-4 text-sm opacity-60">
            <span className="flex items-center gap-1"><BedIcon /> {property.bedrooms}</span>
            <span className="flex items-center gap-1"><BathIcon /> {property.bathrooms}</span>
            <span className="flex items-center gap-1"><AreaIcon /> {property.area} sqft</span>
        </div>
    )
}

function TypeBadge({ type }: { type: 'sale' | 'rent' }) {
    return (
        <span
            className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider"
            style={{
                background: type === 'sale' ? 'var(--brand-primary)' : `rgba(var(--brand-primary-rgb), 0.188)`,
                color: type === 'sale' ? '#fff' : 'var(--brand-primary)',
            }}
        >
            For {type}
        </span>
    )
}

function PropertyImage({ property, className = '' }: { property: PropertyItem; className?: string }) {
    const [imgIndex, setImgIndex] = useState(0)
    const images = property.imageUrls.length > 0 ? property.imageUrls : []

    if (images.length === 0) {
        return (
            <div className={`${className} flex items-center justify-center`} style={{ background: `rgba(var(--brand-primary-rgb), 0.063)` }}>
                <svg className="w-12 h-12 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
                </svg>
            </div>
        )
    }

    return (
        <div className={`${className} relative group`}>
            <img src={images[imgIndex]} alt={property.title} className="w-full h-full object-cover" />
            {images.length > 1 && (
                <>
                    <button
                        onClick={(e) => { e.stopPropagation(); setImgIndex((imgIndex - 1 + images.length) % images.length) }}
                        className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/50 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity"
                        aria-label="Previous image"
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                        </svg>
                    </button>
                    <button
                        onClick={(e) => { e.stopPropagation(); setImgIndex((imgIndex + 1) % images.length) }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/50 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity"
                        aria-label="Next image"
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                    </button>
                    <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                        {images.map((_, i) => (
                            <span
                                key={i}
                                className="w-1.5 h-1.5 rounded-full"
                                style={{ background: i === imgIndex ? '#fff' : 'rgba(255,255,255,0.5)' }}
                            />
                        ))}
                    </div>
                </>
            )}
        </div>
    )
}

export function PropertyCardBlock({ block }: BlockProps<PropertyCardConfig>) {
    const {
        headline,
        subheadline,
        properties = [],
        variant = 'grid',
        currency = 'RM',
    } = block

    const formatPrice = (price: number) => {
        if (price >= 1000000) return `${(price / 1000000).toFixed(1)}M`
        if (price >= 1000) return `${(price / 1000).toFixed(0)}K`
        return price.toLocaleString()
    }

    /* ── Grid variant ────────────────────────────────────────────────────────── */
    const renderGrid = () => (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {properties.map((prop, i) => (
                <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 16 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.05 }}
                    className="rounded-2xl overflow-hidden transition-shadow duration-300 hover:shadow-lg"
                    style={{ border: `1px solid rgba(var(--brand-primary-rgb), 0.082)` }}
                >
                    <div className="relative">
                        <PropertyImage property={prop} className="aspect-[16/10] overflow-hidden" />
                        <div className="absolute top-3 left-3">
                            <TypeBadge type={prop.type} />
                        </div>
                        {prop.status && (
                            <span className="absolute top-3 right-3 px-2 py-1 rounded-full bg-black/60 text-white text-xs font-medium">
                                {prop.status}
                            </span>
                        )}
                    </div>
                    <div className="p-5">
                        <p className="text-2xl font-bold mb-1" style={{ color: 'var(--brand-primary)' }}>
                            {currency} {formatPrice(prop.price)}
                            {prop.type === 'rent' && <span className="text-sm font-normal opacity-60">/mo</span>}
                        </p>
                        <h4 className="font-bold font-heading mb-1">{prop.title}</h4>
                        <p className="text-sm opacity-50 mb-3">{prop.location}</p>
                        <PropertySpecs property={prop} />
                    </div>
                </motion.div>
            ))}
        </div>
    )

    /* ── List variant ────────────────────────────────────────────────────────── */
    const renderList = () => (
        <div className="max-w-4xl mx-auto space-y-4">
            {properties.map((prop, i) => (
                <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -8 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.05 }}
                    className="flex flex-col md:flex-row rounded-2xl overflow-hidden transition-shadow duration-200 hover:shadow-md"
                    style={{ border: `1px solid rgba(var(--brand-primary-rgb), 0.082)` }}
                >
                    <div className="md:w-72 shrink-0 relative">
                        <PropertyImage property={prop} className="aspect-[16/10] md:aspect-auto md:h-full overflow-hidden" />
                        <div className="absolute top-3 left-3">
                            <TypeBadge type={prop.type} />
                        </div>
                    </div>
                    <div className="p-5 flex-1">
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <h4 className="font-bold font-heading text-lg mb-1">{prop.title}</h4>
                                <p className="text-sm opacity-50 mb-2">{prop.location}</p>
                            </div>
                            <p className="text-xl font-bold shrink-0" style={{ color: 'var(--brand-primary)' }}>
                                {currency} {formatPrice(prop.price)}
                                {prop.type === 'rent' && <span className="text-xs font-normal opacity-60">/mo</span>}
                            </p>
                        </div>
                        {prop.description && <p className="text-sm opacity-50 mb-3 line-clamp-2">{prop.description}</p>}
                        <PropertySpecs property={prop} />
                    </div>
                </motion.div>
            ))}
        </div>
    )

    /* ── Featured variant ────────────────────────────────────────────────────── */
    const renderFeatured = () => {
        if (properties.length === 0) return null
        const [hero, ...rest] = properties
        return (
            <>
                <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="rounded-2xl overflow-hidden mb-8"
                    style={{ border: `1px solid rgba(var(--brand-primary-rgb), 0.125)` }}
                >
                    <div className="grid grid-cols-1 lg:grid-cols-2">
                        <PropertyImage property={hero} className="aspect-[16/10] lg:aspect-auto lg:min-h-[400px] overflow-hidden" />
                        <div className="p-8 lg:p-10 flex flex-col justify-center">
                            <TypeBadge type={hero.type} />
                            <h3 className="text-2xl font-bold font-heading mt-4 mb-2">{hero.title}</h3>
                            <p className="text-sm opacity-50 mb-4">{hero.location}</p>
                            <p className="text-3xl font-bold mb-4" style={{ color: 'var(--brand-primary)' }}>
                                {currency} {formatPrice(hero.price)}
                                {hero.type === 'rent' && <span className="text-base font-normal opacity-60">/mo</span>}
                            </p>
                            {hero.description && <p className="text-sm opacity-50 mb-4">{hero.description}</p>}
                            <PropertySpecs property={hero} />
                        </div>
                    </div>
                </motion.div>
                {rest.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {rest.map((prop, i) => (
                            <motion.div
                                key={i}
                                initial={{ opacity: 0, y: 16 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: i * 0.05 }}
                                className="rounded-2xl overflow-hidden transition-shadow duration-300 hover:shadow-lg"
                                style={{ border: `1px solid rgba(var(--brand-primary-rgb), 0.082)` }}
                            >
                                <PropertyImage property={prop} className="aspect-[16/10] overflow-hidden" />
                                <div className="p-5">
                                    <TypeBadge type={prop.type} />
                                    <p className="text-xl font-bold mt-2" style={{ color: 'var(--brand-primary)' }}>
                                        {currency} {formatPrice(prop.price)}
                                    </p>
                                    <h4 className="font-bold font-heading mt-1">{prop.title}</h4>
                                    <p className="text-sm opacity-50 mb-3">{prop.location}</p>
                                    <PropertySpecs property={prop} />
                                </div>
                            </motion.div>
                        ))}
                    </div>
                )}
            </>
        )
    }

    return (
        <AnimatedSection className="py-24">
            <div className="container mx-auto px-6">
                <div className="text-center max-w-2xl mx-auto mb-12">
                    <h2 className="text-4xl md:text-5xl font-bold font-heading mb-5 leading-tight">{headline}</h2>
                    {subheadline && <p className="text-lg opacity-50 leading-relaxed">{subheadline}</p>}
                </div>

                {variant === 'grid' && renderGrid()}
                {variant === 'list' && renderList()}
                {variant === 'featured' && renderFeatured()}
            </div>
        </AnimatedSection>
    )
}
