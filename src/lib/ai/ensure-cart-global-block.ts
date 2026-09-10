import { detectCommercePresence } from '@/lib/site-renderer/detect-commerce-presence'
import { hasHeaderCart } from '@/lib/site-renderer/has-header-cart'

// Same defaults as add-section.ts createAddSectionBlock('cartWidget') and cart-widget/config.ts.
export const DEFAULT_CART_WIDGET_BLOCK = {
    blockType: 'cartWidget',
    variant: 'floating',
    label: 'Cart',
    showLabel: false,
} as const

/**
 * Generation-time counterpart of the render-time cart auto-inject
 * (applyGlobalBlock autoInject tier): when generated pages contain a commerce
 * block (products-grid / products-featured / product-quick-view), persist a
 * floating cartWidget into site.globalBlocks so the cart exists as a real,
 * editable block instead of a render-only fallback. Without this the editor
 * normalizes an unset globalBlocks to null ("user deleted") and never shows
 * the cart for freshly generated commerce sites.
 *
 * Returns a spreadable payload.update data patch — {} when nothing to change.
 * Mirrors editorStore.addBlock auto-restore semantics: an already-configured
 * cartWidget object is left untouched; unset AND explicitly-deleted (null)
 * both get the default cart, since generation ships new commerce content.
 */
export function ensureCartGlobalBlock(
    existingGlobalBlocks: Record<string, unknown> | null | undefined,
    pages: Array<{ layout?: unknown[] }>,
    headerBlock?: unknown,
    requireCart = false,
): { globalBlocks: Record<string, unknown> } | Record<string, never> {
    if (!requireCart && !detectCommercePresence(pages)) return {}
    if (hasHeaderCart(headerBlock)) return {}

    const existing =
        existingGlobalBlocks && typeof existingGlobalBlocks === 'object' ? existingGlobalBlocks : {}
    if (existing.cartWidget && typeof existing.cartWidget === 'object') return {}

    return { globalBlocks: { ...existing, cartWidget: { ...DEFAULT_CART_WIDGET_BLOCK } } }
}

/**
 * ensureCartGlobalBlock + pendingGlobalBlocks awareness. The editor and
 * preview read pendingGlobalBlocks FIRST when non-null (editor-data route),
 * so a stale pending draft — e.g. an unpublished cartWidget deletion — would
 * shadow the freshly persisted live cart and resurrect the missing-cart bug
 * on regeneration/re-skin. When a pending draft exists and lacks a configured
 * cart, graft the default cart into it too; other pending keys (unpublished
 * whatsapp/social edits) are preserved rather than discarded.
 */
export function ensureCartGlobalBlockWithPending(
    existingGlobalBlocks: Record<string, unknown> | null | undefined,
    pendingGlobalBlocks: Record<string, unknown> | null | undefined,
    pages: Array<{ layout?: unknown[] }>,
    headerBlock?: unknown,
    requireCart = false,
): { globalBlocks?: Record<string, unknown>; pendingGlobalBlocks?: Record<string, unknown> } {
    const livePatch = ensureCartGlobalBlock(existingGlobalBlocks, pages, headerBlock, requireCart)
    if (pendingGlobalBlocks == null) return livePatch

    const pendingPatch = ensureCartGlobalBlock(pendingGlobalBlocks, pages, headerBlock, requireCart)
    return {
        ...livePatch,
        ...('globalBlocks' in pendingPatch ? { pendingGlobalBlocks: pendingPatch.globalBlocks } : {}),
    }
}
