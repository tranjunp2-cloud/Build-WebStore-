'use client'


import Image from 'next/image'
import { motion } from 'framer-motion'
import type { BlockProps } from '../types'
import type { PropertyCardConfig, PropertyItem } from './config'
import { AnimatedSection } from '../shared/animations'
import { RichText } from '../shared/RichText'
import { Heading, Body } from '../shared/Typography'
import { HeroMediaOverlay } from '../hero/hero-media-overlay'
import {
    CONTAINER,
    INNER_PADDING,
    SECTION_PADDING,
    CARD_PADDING,
    TOUCH_TARGET,
} from '@/lib/design-tokens'

const PROPERTY_CONTAINER = `${CONTAINER.default} mx-auto ${INNER_PADDING}`

function BedIcon() {
    return (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M2 17V7a2 2 0 012-2h16a2 2 0 012 2v10M2 17h20M6 11h12a2 2 0 012 2v4H4v-4a2 2 0 012-2z" />
        </svg>
    )
}

function BathIcon() {
    return (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 13h18v4a3 3 0 01-3 3H6a3 3 0 01-3-3v-4zM5 13V7a3 3 0 016 0v1" />
        </svg>
    )
}

function AreaIcon() {
    return (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
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

function PropertyImage({ property, imageField, className = '' }: { property: PropertyItem; imageField: string; className?: string }) {
    const imageUrl = property.image && typeof property.image === 'object' && 'url' in property.image
        ? (property.image as { url: string }).url
        : typeof property.image === 'string'
            ? property.image
            : null

    const placeholder = (
        <div className={`${className} flex items-center justify-center`} style={{ background: `rgba(var(--brand-primary-rgb), 0.063)` }}>
            <svg className="w-12 h-12 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
            </svg>
        </div>
    )

    const image = imageUrl ? (
        <div className={`${className} relative`}>
            <Image src={imageUrl} alt={property.title} fill className="object-cover" />
        </div>
    ) : placeholder

    return (
        <HeroMediaOverlay field={imageField} altText={property.title} positionClass="relative">
            {image}
        </HeroMediaOverlay>
    )
}

/** Price line with currency + optional /mo suffix for rent. */
function PropertyPrice({
    price,
    type,
    currency,
    size = 'lg',
    className = '',
}: {
    price: number
    type: 'sale' | 'rent'
    currency: string
    size?: 'xl' | 'lg' | 'md'
    className?: string
}) {
    const formatPrice = (p: number) => {
        if (p >= 1000000) return `${(p / 1000000).toFixed(1)}M`
        if (p >= 1000) return `${(p / 1000).toFixed(0)}K`
        return p.toLocaleString()
    }
    const textSize = size === 'xl' ? 'text-3xl' : size === 'lg' ? 'text-2xl' : 'text-xl'
    const suffixSize = size === 'xl' ? 'text-base' : size === 'lg' ? 'text-sm' : 'text-xs'
    return (
        <p className={`${textSize} font-bold ${className}`} style={{ color: 'var(--brand-primary)' }}>
            {currency} {formatPrice(price)}
            {type === 'rent' && <span className={`${suffixSize} font-normal opacity-60`}>/mo</span>}
        </p>
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
                        <PropertyImage property={prop} imageField={`properties.${i}.image`} className="aspect-[16/10] overflow-hidden" />
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
                        <PropertyPrice price={prop.price} type={prop.type} currency={currency} size="lg" className="mb-1" />
                        <Heading level={4} className="mb-1">{prop.title}</Heading>
                        <Body size="small" className="opacity-50 mb-3">{prop.location}</Body>
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
                        <PropertyImage property={prop} imageField={`properties.${i}.image`} className="aspect-[16/10] md:aspect-auto md:h-full overflow-hidden" />
                        <div className="absolute top-3 left-3">
                            <TypeBadge type={prop.type} />
                        </div>
                    </div>
                    <div className="p-5 flex-1">
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <Heading level={4} className="mb-1">{prop.title}</Heading>
                                <Body size="small" className="opacity-50 mb-2">{prop.location}</Body>
                            </div>
                            <PropertyPrice price={prop.price} type={prop.type} currency={currency} size="md" className="shrink-0" />
                        </div>
                        {prop.description && <Body size="small" className="opacity-50 mb-3 line-clamp-2">{prop.description}</Body>}
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
                        <PropertyImage property={hero} imageField="properties.0.image" className="aspect-[16/10] lg:aspect-auto lg:min-h-[400px] overflow-hidden" />
                        <div className={`${CARD_PADDING.lg} lg:p-10 flex flex-col justify-center`}>
                            <TypeBadge type={hero.type} />
                            <Heading level={3} className="mt-4 mb-2">{hero.title}</Heading>
                            <Body size="small" className="opacity-50 mb-4">{hero.location}</Body>
                            <PropertyPrice price={hero.price} type={hero.type} currency={currency} size="xl" className="mb-4" />
                            {hero.description && <Body size="small" className="opacity-50 mb-4">{hero.description}</Body>}
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
                                <PropertyImage property={prop} imageField={`properties.${i + 1}.image`} className="aspect-[16/10] overflow-hidden" />
                                <div className="p-5">
                                    <TypeBadge type={prop.type} />
                                    <PropertyPrice price={prop.price} type={prop.type} currency={currency} size="md" className="mt-2" />
                                    <Heading level={4} className="mt-1">{prop.title}</Heading>
                                    <Body size="small" className="opacity-50 mb-3">{prop.location}</Body>
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
        <AnimatedSection className={SECTION_PADDING.default}>
            <div className={PROPERTY_CONTAINER}>
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
                {variant === 'list' && renderList()}
                {variant === 'featured' && renderFeatured()}
            </div>
        </AnimatedSection>
    )
}
