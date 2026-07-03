'use client'

import React, { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import type { BlockProps } from '../types'
import type { ProductsFeaturedConfig } from './config'
import { GradientBlob, SectionLabel } from '../shared/decorative'
import { CSS_VARS } from '@/lib/theme/resolve'
import { AnimatedSection } from '../shared/animations'
import { RichText } from '../shared/RichText'
import { Heading, Body, Caption } from '../shared/Typography'
import { TOUCH_TARGET } from '@/lib/design-tokens'
import { SectionWrapper } from '@/blocks/shared/SectionWrapper'
import { getGalleryImages } from '@/lib/images/industry-images'
import { handleCartClick } from '@/lib/storefront/editor-intercept'
import type { ThemeConfig } from '../types'
import { buildProductAlt } from '@/lib/products/build-product-alt'

const CURRENCY_DISPLAY: Record<string, string> = { MYR: 'RM', USD: 'USD', SGD: 'SGD' }

interface FeaturedProduct {
    id: string
    slug: string
    name: string
    price: string
    priceRaw: number
    currency: string
    inventory: number
    compareAtPrice?: number
    description: string
    image: string | null
    imageAlt?: string
    tags: string[]
    isFallback?: boolean
}

function ProductsFeaturedSection({ children }: { children: React.ReactNode }) {
    return (
        <SectionWrapper as={AnimatedSection} padding="default" container="default" background="transparent" className="relative overflow-hidden" innerClassName="relative z-10">
            {children}
        </SectionWrapper>
    )
}

function HeroProductView({ product, block, theme, siteBasePath, siteName }: {
    product: FeaturedProduct
    block: { sectionLabel?: string }
    theme: ThemeConfig
    siteBasePath: string
    siteName?: string
}) {
    const isFallback = product.isFallback ?? false

    return (
        <ProductsFeaturedSection>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
                {/* Left: Product Image */}
                <div className="relative group">
                    <GradientBlob color={CSS_VARS.primary} className="top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" size={500} opacity={0.15} />
                    <div className="relative z-10 rounded-2xl overflow-hidden animate-float" style={{ animationDuration: '6s' }}>
                        {product.image ? (
                            <img
                                src={product.image}
                                alt={buildProductAlt(product.imageAlt, product.name, siteName)}
                                className="w-full h-auto object-cover transform scale-110 drop-shadow-2xl mix-blend-multiply dark:mix-blend-normal"
                            />
                        ) : (
                            <div className="w-full aspect-square bg-black/5 flex items-center justify-center text-8xl opacity-20">🛍️</div>
                        )}
                    </div>
                </div>

                {/* Right: Info */}
                <div className="flex flex-col justify-center">
                    {block.sectionLabel && <SectionLabel color={CSS_VARS.primary}>{block.sectionLabel}</SectionLabel>}

                    {product.tags.length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-6">
                            {product.tags.map((tag) => (
                                <Caption key={tag} className="px-3 py-1 rounded-full font-semibold tracking-wider uppercase"
                                    style={{ backgroundColor: `rgba(var(--brand-primary-rgb), 0.082)`, color: 'var(--brand-primary)', border: `1px solid rgba(var(--brand-primary-rgb), 0.188)` }}>
                                    {tag}
                                </Caption>
                            ))}
                        </div>
                    )}

                    <RichText text={product.name} as="h2" className="text-5xl lg:text-7xl font-bold font-heading mb-6 leading-tight" />
                    <RichText text={product.price} as="p" className="text-4xl font-heading mb-6" style={{ color: 'var(--brand-primary)' }} />

                    {product.description && (
                        <Body size="lg" className="opacity-70 mb-10 max-w-lg">
                            {product.description}
                        </Body>
                    )}

                    {/* Design decision (GH-1084): "Add to Cart" removed from hero block.
                        Purchase flow starts on PDP to enforce variant selection. */}
                    <div className="flex flex-col sm:flex-row gap-4">
                        {product.slug && (
                            <Link
                                href={`${siteBasePath}/products/${product.slug}`}
                                className={`px-8 py-4 rounded-full font-bold text-lg transition-colors inline-block text-center ${TOUCH_TARGET.min}`}
                                style={{ border: `2px solid rgba(var(--brand-primary-rgb), 0.314)`, color: theme.colorMode === 'dark' ? '#fff' : '#000' }}
                                onClick={handleCartClick}
                            >
                                View Details
                            </Link>
                        )}
                    </div>
                </div>
            </div>
            {/* Inline CSS for float animation */}
            <style>{`
                @keyframes float {
                    0% { transform: translateY(0px); }
                    50% { transform: translateY(-15px); }
                    100% { transform: translateY(0px); }
                }
                .animate-float {
                    animation: float ease-in-out infinite;
                }
            `}</style>
        </ProductsFeaturedSection>
    )
}

export function ProductsFeaturedBlock({ block, theme, site }: BlockProps<ProductsFeaturedConfig>) {
    const { headline = 'Featured Collection', subheadline, variant = 'hero-product' } = block
    const category = typeof site?.siteType === 'string' ? site.siteType : 'business'

    const [products, setProducts] = useState<FeaturedProduct[]>([])
    const [loading, setLoading] = useState(true)
    const scrollRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const siteId = site?.id ? String(site.id) : null
        if (!siteId) {
            setLoading(false)
            return
        }

        const controller = new AbortController()
        // carousel shows multiple products; hero needs only 2
        const limit = variant === 'carousel' ? 6 : 2
        fetch(`/api/storefront/products?site=${siteId}&limit=${limit}&sort=-createdAt`, { signal: controller.signal })
            .then(res => res.ok ? res.json() : Promise.reject(res))
            .then(json => {
                const docs = json.docs || []
                const mapped: FeaturedProduct[] = docs.map((doc: Record<string, unknown>) => {
                    const images = doc.images as Array<{ image?: { url?: string }; alt?: string }> | undefined
                    const currencyCode = typeof doc.currency === 'string' ? doc.currency : 'MYR'
                    const currency = CURRENCY_DISPLAY[currencyCode] ?? currencyCode
                    const price = typeof doc.price === 'number' ? doc.price : parseFloat(String(doc.price)) || 0
                    return {
                        id: String(doc.id),
                        slug: String(doc.slug || ''),
                        name: String(doc.name || ''),
                        price: `${currency} ${price.toFixed(2)}`,
                        priceRaw: price,
                        currency: currencyCode,
                        inventory: Number(doc.inventory) || 0,
                        compareAtPrice: typeof doc.compareAtPrice === 'number' ? doc.compareAtPrice : undefined,
                        description: String(doc.shortDescription || ''),
                        image: images?.[0]?.image?.url ?? null,
                        imageAlt: images?.[0]?.alt,
                        tags: [],
                    }
                })
                setProducts(mapped)
            })
            .catch(err => {
                if (err.name !== 'AbortError') console.error('[ProductsFeaturedBlock] Failed to fetch products:', err)
            })
            .finally(() => setLoading(false))

        return () => controller.abort()
    }, [site?.id, variant])

    if (loading) {
        return (
            <SectionWrapper as={AnimatedSection} padding="default" container="default" background="transparent">
                <div className="flex items-center justify-center py-16">
                    <div className="animate-spin w-8 h-8 rounded-full border-2 border-current border-t-transparent opacity-40" />
                </div>
            </SectionWrapper>
        )
    }

    // Fallback: carousel needs more items than hero-product
    const fallbackCount = variant === 'carousel' ? 6 : 2
    const fallbackImages = getGalleryImages(category, fallbackCount)
    const displayProducts: FeaturedProduct[] = products.length > 0
        ? products.map((p, i) => ({
            ...p,
            image: p.image ?? fallbackImages[i] ?? fallbackImages[0] ?? null,
        }))
        : variant === 'carousel'
            ? fallbackImages.map((img, i) => ({
                id: `fallback-${i}`,
                slug: '',
                name: headline,
                price: '',
                priceRaw: 0,
                currency: 'MYR',
                inventory: 0,
                description: subheadline || '',
                image: img ?? null,
                tags: [],
                isFallback: true,
            }))
            : [
                {
                    id: 'fallback-1',
                    slug: '',
                    name: headline,
                    price: '',
                    priceRaw: 0,
                    currency: 'MYR',
                    inventory: 0,
                    description: subheadline || '',
                    image: fallbackImages[0] ?? null,
                    tags: [],
                    isFallback: true,
                },
            ]

    const product = displayProducts[0]!
    const siteRec = site as Record<string, unknown>
    const siteBasePath = typeof siteRec?.siteBasePath === 'string'
        ? (siteRec.siteBasePath as string)
        : (siteRec?.tenantSlug ? `/sites/${siteRec.tenantSlug as string}` : '')

    const scrollCarousel = (dir: 'prev' | 'next') => {
        const el = scrollRef.current
        if (!el) return
        const itemWidth = (el.firstElementChild as HTMLElement)?.offsetWidth ?? 500
        el.scrollBy({ left: dir === 'next' ? itemWidth + 24 : -(itemWidth + 24), behavior: 'smooth' })
    }

    if (variant === 'carousel') {
        return (
            <SectionWrapper as={AnimatedSection} padding="default" container="default" background="transparent" className="relative overflow-hidden" innerClassName="relative z-10">
                <GradientBlob color={CSS_VARS.primary} className="top-1/4 right-0" size={600} opacity={0.05} />
                <div className="text-center max-w-2xl mx-auto mb-16">
                    {block.sectionLabel && <SectionLabel color={CSS_VARS.primary}>{block.sectionLabel}</SectionLabel>}
                    <RichText text={headline} as="h2" className="text-4xl md:text-5xl font-bold font-heading mb-4" />
                    {subheadline && <RichText text={subheadline} as="p" className="opacity-60 text-lg" />}
                </div>

                <div ref={scrollRef} className="flex overflow-x-auto snap-x snap-mandatory gap-6 pb-8 no-scrollbar">
                    {displayProducts.map((p) => (
                        <div key={p.id} className="snap-center w-[85vw] sm:w-[500px] flex-shrink-0 relative rounded-3xl overflow-hidden group">
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent z-10" />
                            {p.image ? (
                                <img src={p.image} alt={buildProductAlt(p.imageAlt, p.name, site?.name ?? undefined)} className="w-full h-[500px] object-cover mix-blend-multiply dark:mix-blend-normal group-hover:scale-105 transition-transform duration-700" />
                            ) : (
                                <div className="w-full h-[500px] bg-black/5 flex items-center justify-center text-6xl opacity-20">🛍️</div>
                            )}
                            <div className="absolute bottom-0 left-0 p-8 z-20 w-full text-white">
                                <Heading level={3} className="mb-2">{p.name}</Heading>
                                {p.price && <Body size="lg" className="font-medium" style={{ color: 'var(--brand-primary)' }}>{p.price}</Body>}
                            </div>
                        </div>
                    ))}
                </div>
                {displayProducts.length > 1 && (
                    <div className="flex justify-center gap-3 mt-4">
                        {(['prev', 'next'] as const).map((dir) => (
                            <button
                                key={dir}
                                type="button"
                                onClick={() => scrollCarousel(dir)}
                                className={`rounded-full flex items-center justify-center transition-opacity hover:opacity-80 ${TOUCH_TARGET.min} min-w-[44px]`}
                                style={{ background: `rgba(var(--brand-primary-rgb), 0.12)`, color: 'var(--brand-primary)' }}
                                aria-label={dir === 'prev' ? 'Previous products' : 'Next products'}
                            >
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                                    <path strokeLinecap="round" strokeLinejoin="round" d={dir === 'prev' ? 'M15 19l-7-7 7-7' : 'M9 5l7 7-7 7'} />
                                </svg>
                            </button>
                        ))}
                    </div>
                )}
            </SectionWrapper>
        )
    }

    // Default: hero-product split view
    return (
        <HeroProductView
            product={product}
            block={block}
            theme={theme}
            siteBasePath={siteBasePath}
            siteName={site?.name ?? undefined}
        />
    )
}
