/**
 * Alt-text fallback for product images (GH-1458).
 *
 * Modeled on safeAltText() in src/blocks/hero/shared.tsx. Priority chain: merchant-entered alt →
 * productName alone → storeName alone → hard fallback. NEVER
 * returns an empty string, so the storefront `<img alt>` is never blank in the DOM.
 *
 * Pure function, no I/O — fully unit-testable.
 */
export function buildProductAlt(
    alt: string | null | undefined,
    productName: string | null | undefined,
    storeName: string | null | undefined,
): string {
    const trimmedAlt = typeof alt === 'string' ? alt.trim() : ''
    if (trimmedAlt) return trimmedAlt

    const trimmedName = typeof productName === 'string' ? productName.trim() : ''
    const trimmedStore = typeof storeName === 'string' ? storeName.trim() : ''

    if (trimmedName) return trimmedName
    if (trimmedStore) return trimmedStore
    return 'Product image'
}
