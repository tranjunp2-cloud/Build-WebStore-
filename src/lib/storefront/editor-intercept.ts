import type React from 'react'

/**
 * GH-960: In editor iframe, intercept cart/nav clicks and show preview toast.
 *
 * Shared by products-featured, products-grid, product-quick-view blocks,
 * and AddToCartButton.
 */

// Contract: editor host must pass ?editor=1 or ?builder=1 in the iframe URL.
// Without these params, returns false even inside an iframe.
export function isInEditorPreview(): boolean {
    if (typeof window === 'undefined') return false
    const params = new URLSearchParams(window.location.search)
    return window.parent !== window && (params.has('editor') || params.has('builder'))
}

// True ONLY in the editor edit canvas (?editor=1), NOT the builder result preview
// (?builder=1). Use this to gate NAVIGATION: in the editor a link click must select
// the block instead of navigating away, but in the builder preview (shown right after
// AI generation) the user must be able to click links to explore the generated site.
// Cart/checkout actions stay gated by isInEditorPreview() in both modes.
export function isInEditorEditMode(): boolean {
    if (typeof window === 'undefined') return false
    const params = new URLSearchParams(window.location.search)
    return window.parent !== window && params.has('editor')
}

// Derive parent frame origin from document.referrer (same pattern as PreviewScripts.tsx).
// Fallback to window.location.origin when referrer is absent or unparseable.
export function getParentOrigin(): string {
    if (typeof window === 'undefined') return ''
    try {
        return new URL(document.referrer).origin
    } catch {
        return window.location.origin
    }
}

export const EDITOR_NAV_TOAST_MSG = 'Navigation is disabled inside the Editor.'
export const EDITOR_CART_TOAST_MSG = 'Cart actions are disabled in the Editor.'

export const handleCartClick = (e: React.MouseEvent): void => {
    if (isInEditorPreview()) {
        e.preventDefault()
        window.parent.postMessage(
            { type: 'SHOW_TOAST', variant: 'info', message: EDITOR_NAV_TOAST_MSG },
            getParentOrigin(),
        )
    }
}
