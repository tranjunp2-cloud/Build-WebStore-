'use client'

import Link from 'next/link'
import type React from 'react'
import type { ThemeConfig } from '../types'
import { HoverCard } from '../shared/animations'
import { RichText } from '../shared/RichText'
import { Heading } from '../shared/Typography'
import { buildProductAlt } from '@/lib/products/build-product-alt'
import { handleCartClick, isInEditorPreview } from '@/lib/storefront/editor-intercept'
import type { ProductItem } from './filter-types'

interface ProductCardProps {
    product: ProductItem
    variant: 'grid-3' | 'grid-4' | 'list'
    theme: ThemeConfig
    siteBasePath: string
    siteName?: string
}

function formatCompareAtPrice(price: number, currency: string) {
    if (currency === 'MYR') return `RM ${price.toFixed(2)}`
    if (currency === 'SGD') return `S$ ${price.toFixed(2)}`
    if (currency === 'USD') return `$ ${price.toFixed(2)}`
    return `${currency} ${price.toFixed(2)}`
}

export function ProductCard({ product, variant, theme, siteBasePath, siteName }: ProductCardProps) {
    const pdpHref = product.slug ? `${siteBasePath}/products/${product.slug}` : '#'
    const hasDiscount = typeof product.compareAtPrice === 'number' && product.compareAtPrice > product.priceRaw

    const handleClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
        if (isInEditorPreview()) {
            handleCartClick(event)
            return
        }

        if (!product.slug) event.preventDefault()
    }

    return (
        <HoverCard
            className={`group h-full overflow-hidden ${variant === 'list' ? 'rounded-[16px] md:rounded-2xl' : 'rounded-[12px] sm:rounded-2xl'}`}
            style={{
                border: '1px solid rgba(var(--brand-primary-rgb), 0.125)',
                background: `linear-gradient(135deg, ${theme.colorMode === 'dark' ? '#ffffff03' : '#00000003'}, transparent)`,
            }}
        >
            <Link
                href={pdpHref}
                className={`block h-full text-inherit no-underline ${variant === 'list' ? 'flex h-[126px] md:h-40' : 'flex h-full flex-col'}`}
                onClick={handleClick}
            >
                <div
                    className={`relative overflow-hidden ${variant === 'list' ? 'h-full w-[112px] flex-shrink-0 md:w-44' : 'h-[110px] sm:aspect-square sm:h-auto'}`}
                    style={{ background: theme.colorMode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }}
                >
                    {product.image ? (
                        <img
                            src={product.image}
                            alt={buildProductAlt(product.imageAlt, product.name, siteName)}
                            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                            style={{ mixBlendMode: theme.colorMode === 'dark' ? 'normal' : 'multiply' }}
                            loading="lazy"
                        />
                    ) : (
                        <div className="flex h-full w-full items-center justify-center text-3xl opacity-20 sm:text-4xl">🛍️</div>
                    )}

                    {hasDiscount && (
                        <span className={`absolute rounded-full bg-red-500 px-3 py-1 text-[11px] font-semibold tracking-wide text-white ${variant === 'list' ? 'left-3 top-3' : 'right-3 top-3'}`}>
                            SALE
                        </span>
                    )}
                </div>

                <div className={`flex flex-1 flex-col ${variant === 'list' ? 'p-3 md:p-6' : 'p-2.5 sm:p-4 md:p-5'}`}>
                    <div className="space-y-2">
                        {product.category?.name && (
                            <p className={`text-xs font-semibold uppercase tracking-[0.18em] ${variant === 'list' ? 'hidden md:block' : 'hidden sm:block'}`} style={{ color: 'var(--brand-primary)' }}>
                                {product.category.name}
                            </p>
                        )}

                        <Heading level={4} className={variant === 'list' ? 'font-body text-[13px] leading-[1.3] md:text-xl' : 'font-body text-[12px] leading-[1.3] sm:text-base'}>
                            {product.name}
                        </Heading>

                        {product.shortDescription && (
                            <p className={`opacity-70 ${variant === 'list' ? 'line-clamp-2 text-[10px] leading-[1.3] md:line-clamp-3 md:text-sm md:leading-6' : 'line-clamp-2 text-[10px] leading-[1.3] sm:text-sm sm:leading-6'}`}>
                                {product.shortDescription}
                            </p>
                        )}
                    </div>

                    <div className={`flex items-center gap-2.5 ${variant === 'list' ? 'mt-auto pt-3 md:pt-5' : 'pt-3 sm:pt-4'}`}>
                        <RichText
                            text={product.price}
                            as="p"
                            className={variant === 'list' ? 'text-[12px] font-heading md:text-xl' : 'text-[12px] font-heading sm:text-lg'}
                            style={{ color: 'var(--text-primary)' }}
                        />
                        {hasDiscount && product.compareAtPrice !== undefined && (
                            <span className={`opacity-50 line-through ${variant === 'list' ? 'text-[10px] md:text-base' : 'text-[10px] sm:text-sm'}`}>
                                {formatCompareAtPrice(product.compareAtPrice, product.currency)}
                            </span>
                        )}
                    </div>
                </div>
            </Link>
        </HoverCard>
    )
}
