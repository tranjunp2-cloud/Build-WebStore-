'use client'

import { useRef, useState } from 'react'
import { ProductVariantSelector } from '@/components/storefront/ProductVariantSelector'
import { AddToCartButton } from '@/components/storefront/AddToCartButton'
import { QuantityStepper } from '@/components/storefront/quantity-stepper'
import { formatPrice } from '@/lib/utils'
import { ProductStickyAddToCartBar } from '@/components/storefront/product-sticky-add-to-cart-bar'

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
 * Renders ProductVariantSelector (when hasVariants) + QuantityStepper + AddToCartButton.
 * Price/stock display for non-variant products stays server-rendered in page.tsx.
 */
export function ProductAddToCartSection({ product, primaryColor, siteSlug, siteId }: Props) {
    const [selectedVariant, setSelectedVariant] = useState<Variant | null>(null)
    const [quantity, setQuantity] = useState(1)

    const hasVariants = Boolean(product.hasVariants && product.variants?.length)
    const price = selectedVariant?.price ?? product.price
    const compareAtPrice = selectedVariant != null
        ? (selectedVariant.compareAtPrice ?? undefined)
        : product.compareAtPrice
    // Per-variant stock when a variant is selected; aggregate inventory otherwise (#1179).
    const inventory = selectedVariant?.stock ?? product.inventory ?? 0
    const variantName = selectedVariant?.name ?? null
    const selectorRef = useRef<HTMLDivElement>(null)
    const inlineButtonRef = useRef<HTMLDivElement>(null)
    const cartProduct = {
        id: product.id,
        slug: product.slug,
        name: product.name,
        price,
        compareAtPrice,
        currency: product.currency,
        imageUrl: product.imageUrl,
        inventory,
    }

    return (
        <>
            {hasVariants && product.variants && (
                <div ref={selectorRef}>
                <ProductVariantSelector
                    variants={product.variants}
                    currency={product.currency}
                    primaryColor={primaryColor}
                    basePrice={product.price}
                    baseCompareAtPrice={product.compareAtPrice ?? null}
                    onSelect={variant => {
                        setSelectedVariant(variant)
                        setQuantity(1) // stock differs per variant
                    }}
                />
                </div>
            )}
            <QuantityStepper value={quantity} max={inventory} onChange={setQuantity} />
            <div ref={inlineButtonRef} data-testid="pd-inline-add-to-cart">
                <AddToCartButton
                    quantity={quantity}
                    product={cartProduct}
                    variantName={variantName}
                    requireVariant={hasVariants}
                    primaryColor={primaryColor}
                    siteSlug={siteSlug}
                    siteId={siteId}
                />
            </div>
            <ProductStickyAddToCartBar
                anchorRef={inlineButtonRef}
                quantity={quantity}
                product={cartProduct}
                variantName={variantName}
                requireVariant={hasVariants}
                primaryColor={primaryColor}
                siteSlug={siteSlug}
                siteId={siteId}
                priceLabel={formatPrice(price, product.currency || 'MYR')}
                onSelectVariant={() => selectorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
            />
        </>
    )
}
