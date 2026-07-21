'use client'

import { toast } from 'sonner'
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
    /** Variant name to add to cart; null/undefined when no variant selected */
    variantName?: string | null
    /** When true, button is disabled until a variant is chosen */
    requireVariant?: boolean
    primaryColor: string
    siteSlug: string
    siteId?: string
}

export function AddToCartButton({ product, variantName, requireVariant, primaryColor, siteSlug, siteId }: AddToCartButtonProps) {
    const { addItem, activateSiteCart, items } = useCartStore()
    const isOwner = useIsOwner()
    const { t, ti } = useI18n()

    // Cart line identity: productId + (variantName ?? '') — matches cartStore sameLine logic
    const cartQty = items.find(
        i => i.productId === product.id && (i.variantName ?? '') === (variantName ?? '')
    )?.quantity ?? 0
    const isAtStockLimit = product.inventory > 0 && cartQty >= product.inventory

    const isOutOfStock = product.inventory <= 0
    const needsVariant = Boolean(requireVariant) && !variantName
    const isDisabled = isOutOfStock || needsVariant || isAtStockLimit

    const handleClick = () => {
        if (isDisabled) return
        // GH-960: In editor iframe show preview toast; real cart logic ships in #961.
        if (isInEditorPreview()) {
            window.parent.postMessage(
                { type: 'SHOW_TOAST', variant: 'info', message: EDITOR_CART_TOAST_MSG },
                getParentOrigin(),
            )
            return
        }
        if (!siteId) return
        activateSiteCart(String(siteId), siteSlug)
        addItem({
            productId: product.id,
            productSlug: product.slug,
            name: product.name,
            price: product.price,
            compareAtPrice: product.compareAtPrice,
            currency: product.currency || 'MYR',
            imageUrl: product.imageUrl,
            inventory: product.inventory,
            variantName: variantName ?? undefined,
        })
        if (siteId) {
            trackEvent({
                siteId,
                event: 'add_to_cart',
                metadata: { productId: product.id, productSlug: product.slug, price: product.price, variant: variantName },
                isOwner,
            })
        }
    }

    // Disabled button swallows onClick — wrapper div intercepts clicks when at stock limit
    const handleWrapperClick = () => {
        if (isAtStockLimit) {
            toast.warning(t.storefront.products.stockLimitToast)
        }
    }

    const label = needsVariant
        ? t.storefront.products.selectVariant
        : isOutOfStock
            ? t.storefront.products.outOfStock
            : t.storefront.products.addToCart

    return (
        <>
            {/* role="presentation": purely structural wrapper to capture clicks on disabled button */}
            <div role="presentation" onClick={handleWrapperClick}>
                <button
                    onClick={handleClick}
                    disabled={isDisabled}
                    style={{
                        background: primaryColor,
                        color: 'white',
                        border: 'none',
                        borderRadius: '12px',
                        padding: '14px 32px',
                        fontSize: '16px',
                        fontWeight: 600,
                        cursor: isDisabled ? 'not-allowed' : 'pointer',
                        width: '100%',
                        marginBottom: '24px',
                        opacity: isDisabled ? 0.5 : 1,
                        transition: 'opacity 0.2s',
                    }}
                >
                    {label}
                </button>
            </div>
            {isAtStockLimit && (
                <p style={{ fontSize: '13px', color: 'var(--text-muted, #999)', marginTop: '-16px', marginBottom: '16px', textAlign: 'center' }}>
                    {ti(t.storefront.products.stockLimitMessage, { cartQty, inventory: product.inventory })}
                </p>
            )}
        </>
    )
}
