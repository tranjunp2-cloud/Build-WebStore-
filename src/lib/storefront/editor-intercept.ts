import type React from 'react'

/**
 * GH-960: In editor iframe, intercept cart/nav clicks and show preview toast.
 *
 * Shared by products-featured, products-grid, product-quick-view blocks.
 * NOTE: AddToCartButton.tsx has inline logic with cart-store side effects —
 * intentionally not consolidated here.
 */
export const handleCartClick = (e: React.MouseEvent): void => {
    if (window.parent !== window) {
        e.preventDefault()
        window.parent.postMessage(
            { type: 'SHOW_TOAST', variant: 'info', message: 'Navigation is disabled inside the Editor.' },
            window.location.origin,
        )
    }
}
