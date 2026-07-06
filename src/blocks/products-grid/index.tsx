'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { BlockProps, ThemeConfig } from '../types'
import type { ProductsGridConfig } from './config'
import { CSS_VARS } from '@/lib/theme/resolve'
import { AnimatedSection, StaggerGrid, StaggerItem, HoverCard } from '../shared/animations'
import { SectionLabel, GradientBlob } from '../shared/decorative'
import { RichText } from '../shared/RichText'
import { Heading, Body } from '../shared/Typography'
import { TOUCH_TARGET, CARD_PADDING } from '@/lib/design-tokens'
import { handleCartClick, isInEditorPreview } from '@/lib/storefront/editor-intercept'
import { SectionWrapper } from '@/blocks/shared/SectionWrapper'
import { buildProductAlt } from '@/lib/products/build-product-alt'

const CURRENCY_DISPLAY: Record<string, string> = { MYR: 'RM', USD: 'USD', SGD: 'SGD' }

interface ProductItem {
    id: string
    slug: string
    name: string
    price: string
    priceRaw: number
    currency: string
    inventory: number
    compareAtPrice?: number
    image: string | null
    imageAlt?: string
}

function ProductCard({ product, variant, theme, siteBasePath, siteName }: {
    product: ProductItem
    variant: 'grid-3' | 'grid-4' | 'list'
    theme: ThemeConfig
    siteBasePath: string
    siteName?: string
}) {
    // Prefetched soft-nav to the PDP. <Link> prefetches the (force-dynamic) detail
    // route as the card enters the viewport, so the click feels instant instead of
    // waiting on a cold server render. Editor preview still intercepts navigation.
    const pdpHref = product.slug ? `${siteBasePath}/products/${product.slug}` : '#'

    return (
        <HoverCard
            className={`group overflow-hidden rounded-2xl h-full flex ${variant === 'list' ? 'flex-row items-center gap-6 p-4' : 'flex-col'}`}
            style={{
                border: `1px solid rgba(var(--brand-primary-rgb), 0.125)`,
                background: `linear-gradient(135deg, ${theme.colorMode === 'dark' ? '#ffffff03' : '#00000003'}, transparent)`,
            }}
        >
            <div className={`relative overflow-hidden bg-black/5 dark:bg-white/5 ${variant === 'list' ? 'w-32 h-32 rounded-xl flex-shrink-0' : 'aspect-square'}`}>
                {product.image ? (
                    <img
                        src={product.image}
                        alt={buildProductAlt(product.imageAlt, product.name, siteName)}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 mix-blend-multiply dark:mix-blend-normal"
                        loading="lazy"
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-4xl opacity-20">🛍️</div>
                )}
            </div>

            <div className={variant === 'list' ? 'flex-1 py-2' : `${CARD_PADDING.md} flex flex-col flex-1`}>
                <Heading level={4} className="font-body mb-2">{product.name}</Heading>
                <RichText text={product.price} as="p" className="text-xl font-heading mb-4" style={{ color: 'var(--brand-primary)' }} />

                {variant !== 'list' && <div className="mt-auto" />}

                {/* Design decision (GH-1084): always navigate to PDP — add-to-cart is handled on
                    PDP via ProductAddToCartSection (ensures variant selection before cart). */}
                <Link
                    href={pdpHref}
                    className={`inline-flex items-center justify-center px-4 py-2 font-medium no-underline transition-all duration-300 ${TOUCH_TARGET.min} ${variant === 'list' ? 'rounded-lg text-sm w-max' : 'rounded-xl w-full text-center'}`}
                    style={{
                        backgroundColor: variant === 'list' ? `rgba(var(--brand-primary-rgb), 0.082)` : 'transparent',
                        color: 'var(--brand-primary)',
                        border: variant === 'list' ? 'none' : `1px solid rgba(var(--brand-primary-rgb), 0.188)`,
                    }}
                    onMouseEnter={(e) => {
                        if (variant === 'list') return
                        e.currentTarget.style.backgroundColor = CSS_VARS.primary
                        e.currentTarget.style.color = theme.colorMode === 'dark' ? '#000' : '#fff'
                    }}
                    onMouseLeave={(e) => {
                        if (variant === 'list') return
                        e.currentTarget.style.backgroundColor = 'transparent'
                        e.currentTarget.style.color = CSS_VARS.primary
                    }}
                    onClick={(e) => {
                        // Editor preview: block navigation + show toast (handleCartClick preventDefaults).
                        // Both editor and builder gate PDP nav — product preview routes are not
                        // rewritten to /preview, so navigating would leak to a live storefront PDP
                        // that 404s for a draft site. (Builder product nav needs a productPreviewPath
                        // rewrite first — out of scope for the menu-tab navigation fix.)
                        if (isInEditorPreview()) { handleCartClick(e); return }
                        // No slug → nothing to navigate to.
                        if (!product.slug) e.preventDefault()
                    }}
                >
                    View Detail
                </Link>
            </div>
        </HoverCard>
    )
}

export function ProductsGridBlock({ block, theme, site }: BlockProps<ProductsGridConfig>) {
    const { headline = 'Featured Products', subheadline, limit = 6, variant = 'grid-3' } = block
    const [products, setProducts] = useState<ProductItem[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const siteId = site?.id ? String(site.id) : null
        if (!siteId) {
            setLoading(false)
            return
        }

        const controller = new AbortController()

        fetch(`/api/storefront/products?site=${siteId}&limit=${limit}&sort=-createdAt`, { signal: controller.signal })
            .then(res => res.ok ? res.json() : Promise.reject(res))
            .then(json => {
                const docs = json.docs || []
                const mapped: ProductItem[] = docs.map((doc: Record<string, unknown>) => {
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
                        image: images?.[0]?.image?.url ?? null,
                        imageAlt: images?.[0]?.alt,
                    }
                })
                setProducts(mapped)
            })
            .catch(err => {
                if (err.name !== 'AbortError') console.error('[ProductsGridBlock] Failed to fetch products:', err)
            })
            .finally(() => setLoading(false))

        return () => controller.abort()
    }, [limit, site?.id])

    const gridCols = {
        'grid-3': 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
        'grid-4': 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
        'list': 'grid-cols-1 max-w-3xl mx-auto',
    }[variant] || 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'

    if (loading) {
        return (
            <SectionWrapper as={AnimatedSection} padding="default" container="default" background="transparent">
                <div className="text-center">
                    <div className="animate-pulse flex flex-col items-center gap-4">
                        <div className="h-8 w-64 bg-white/10 rounded" />
                        <div className="h-4 w-48 bg-white/5 rounded" />
                    </div>
                </div>
            </SectionWrapper>
        )
    }

    if (products.length === 0) {
        return (
            <SectionWrapper as={AnimatedSection} padding="default" container="default" background="transparent">
                <div className="text-center">
                    {block.sectionLabel && <SectionLabel color={CSS_VARS.primary}>{block.sectionLabel}</SectionLabel>}
                    <RichText text={headline} as="h2" className="text-4xl md:text-5xl font-bold font-heading mb-4" />
                    <p className="opacity-60 text-lg">No products yet. Check back soon!</p>
                </div>
            </SectionWrapper>
        )
    }

    const siteRec = site as Record<string, unknown>
    const siteBasePath = typeof siteRec?.siteBasePath === 'string'
        ? (siteRec.siteBasePath as string)
        : (siteRec?.tenantSlug ? `/sites/${siteRec.tenantSlug as string}` : '')

    return (
        <SectionWrapper as={AnimatedSection} padding="default" container="default" background="transparent" className="relative overflow-hidden" innerClassName="relative z-10">
            <GradientBlob color={CSS_VARS.primary} className="bottom-[10%] left-[-5%]" size={500} opacity={0.04} />

            {/* Header */}
            <div className="text-center max-w-2xl mx-auto mb-16">
                {block.sectionLabel && <SectionLabel color={CSS_VARS.primary}>{block.sectionLabel}</SectionLabel>}
                <Heading level={2} className="mb-4">
                    <RichText text={headline} as="span" />
                </Heading>
                {subheadline && (
                    <Body size="lg" className="opacity-60">
                        <RichText text={subheadline} as="span" />
                    </Body>
                )}
            </div>

            {/* Grid */}
            <StaggerGrid className={`grid gap-8 ${gridCols}`}>
                {products.map((product) => (
                    <StaggerItem key={product.id}>
                        <ProductCard
                            product={product}
                            variant={variant}
                            theme={theme}
                            siteBasePath={siteBasePath}
                            siteName={site?.name ?? undefined}
                        />
                    </StaggerItem>
                ))}
            </StaggerGrid>
        </SectionWrapper>
    )
}
