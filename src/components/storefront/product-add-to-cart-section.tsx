'use client'

import { useState } from 'react'
import { ProductVariantSelector } from '@/components/storefront/ProductVariantSelector'
import { AddToCartButton } from '@/components/storefront/AddToCartButton'

type Variant = {
    name: string
    price: number
    compareAtPrice?: number | null
    stock: number
}

type Props = {
    product: {
        id: string
        slug: string
        name: string
        price: number
        compareAtPrice?: number
        currency: string
        imageUrl?: string
        inventory: number
        hasVariants?: boolean
        variants?: Variant[]
    }
    primaryColor: string
    siteSlug: string
    siteId: string
}

/**
 * Client wrapper that bridges the Server Component PDP to variant state.
 * Renders ONLY ProductVariantSelector (when hasVariants) + AddToCartButton.
 * Price/stock display for non-variant products stays server-rendered in page.tsx.
 */
export function ProductAddToCartSection({ product, primaryColor, siteSlug, siteId }: Props) {
    const [selectedVariant, setSelectedVariant] = useState<Variant | null>(null)

    const hasVariants = Boolean(product.hasVariants && product.variants?.length)
    const price = selectedVariant?.price ?? product.price
    const compareAtPrice = selectedVariant != null
        ? (selectedVariant.compareAtPrice ?? undefined)
        : product.compareAtPrice
    // CAS only decrements aggregate product.inventory; variant.stock is a stale snapshot.
    // Always use product.inventory so the button mirrors server-side validation.
    const inventory = product.inventory ?? 0
    const variantName = selectedVariant?.name ?? null

    return (
        <>
            {hasVariants && product.variants && (
                <ProductVariantSelector
                    variants={product.variants}
                    currency={product.currency}
                    primaryColor={primaryColor}
                    basePrice={product.price}
                    baseCompareAtPrice={product.compareAtPrice ?? null}
                    onSelect={setSelectedVariant}
                />
            )}
            <AddToCartButton
                product={{
                    id: product.id,
                    slug: product.slug,
                    name: product.name,
                    price,
                    compareAtPrice,
                    currency: product.currency,
                    imageUrl: product.imageUrl,
                    inventory,
                }}
                variantName={variantName}
                requireVariant={hasVariants}
                primaryColor={primaryColor}
                siteSlug={siteSlug}
                siteId={siteId}
            />
        </>
    )
}
