'use client'

import { useCallback } from 'react'
import { useCartStore } from '@/store/cartStore'
import { trackEvent } from '@/lib/analytics/track-event'
import { useIsOwner } from '@/components/site-renderer/OwnerContext'
import { isInEditorPreview, EDITOR_CART_TOAST_MSG } from '@/lib/storefront/editor-intercept'

type AddToCartProduct = {
    id: string
    slug: string
    name: string
    priceRaw: number
    compareAtPrice?: number
    currency: string
    imageUrl?: string
    inventory: number
}

export function useAddToCart(product: AddToCartProduct, siteSlug: string, siteId?: string) {
    const { addItem, setSiteSlug } = useCartStore()
    const isOwner = useIsOwner()
    const isOutOfStock = product.inventory <= 0

    const handleAddToCart = useCallback(() => {
        if (!product.id) return
        if (isOutOfStock) return
        if (isInEditorPreview()) {
            window.parent.postMessage(
                { type: 'SHOW_TOAST', variant: 'info', message: EDITOR_CART_TOAST_MSG },
                '*',
            )
            return
        }
        if (siteSlug) setSiteSlug(siteSlug)
        addItem({
            productId: product.id,
            productSlug: product.slug,
            name: product.name,
            price: product.priceRaw,
            compareAtPrice: product.compareAtPrice,
            currency: product.currency || 'MYR',
            imageUrl: product.imageUrl,
            inventory: product.inventory,
        })
        if (siteId) {
            trackEvent({
                siteId,
                event: 'add_to_cart',
                metadata: { productId: product.id, productSlug: product.slug, price: product.priceRaw },
                isOwner,
            })
        }
    }, [
        isOutOfStock, siteSlug, siteId,
        product.id, product.slug, product.name, product.priceRaw,
        product.compareAtPrice, product.currency, product.imageUrl, product.inventory,
        addItem, setSiteSlug, isOwner,
    ])

    return { handleAddToCart, isOutOfStock }
}
