'use client'

import { useCartStore } from '@/store/cartStore'
import { trackEvent } from '@/lib/analytics/track-event'
import { useIsOwner } from '@/components/site-renderer/OwnerContext'
import { useI18n } from '@/i18n'
import { isInEditorPreview, EDITOR_CART_TOAST_MSG, getParentOrigin } from '@/lib/storefront/editor-intercept'

type AddToCartButtonProps = {
    product: {
        id: string
        slug: string
        name: string
        price: number
        compareAtPrice?: number
        currency: string
        imageUrl?: string
        inventory: number
    }
    primaryColor: string
    siteSlug: string
    siteId?: string
}

export function AddToCartButton({ product, primaryColor, siteSlug, siteId }: AddToCartButtonProps) {
    const { addItem, setSiteSlug } = useCartStore()
    const isOwner = useIsOwner()
    const { t } = useI18n()
    const isOutOfStock = product.inventory <= 0

    const handleClick = () => {
        if (isOutOfStock) return
        // GH-960: In editor iframe show preview toast; real cart logic ships in #961.
        if (isInEditorPreview()) {
            window.parent.postMessage(
                { type: 'SHOW_TOAST', variant: 'info', message: EDITOR_CART_TOAST_MSG },
                getParentOrigin(),
            )
            return
        }
        setSiteSlug(siteSlug)
        addItem({
            productId: product.id,
            productSlug: product.slug,
            name: product.name,
            price: product.price,
            compareAtPrice: product.compareAtPrice,
            currency: product.currency || 'MYR',
            imageUrl: product.imageUrl,
            inventory: product.inventory,
        })
        if (siteId) {
            trackEvent({
                siteId,
                event: 'add_to_cart',
                metadata: { productId: product.id, productSlug: product.slug, price: product.price },
                isOwner,
            })
        }
    }

    return (
        <button
            onClick={handleClick}
            disabled={isOutOfStock}
            style={{
                background: primaryColor,
                color: 'white',
                border: 'none',
                borderRadius: '12px',
                padding: '14px 32px',
                fontSize: '16px',
                fontWeight: 600,
                cursor: isOutOfStock ? 'not-allowed' : 'pointer',
                width: '100%',
                marginBottom: '24px',
                opacity: isOutOfStock ? 0.5 : 1,
                transition: 'opacity 0.2s',
            }}
        >
            {isOutOfStock ? t.storefront.products.outOfStock : t.storefront.products.addToCart}
        </button>
    )
}
