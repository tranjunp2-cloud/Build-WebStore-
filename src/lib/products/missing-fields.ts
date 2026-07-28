/**
 * Pure helper for the Product List "missing information" soft-warning (GH-1457).
 * Kept dependency-free (no `Product` type import) so it can be reused by
 * SEO reporting's `productMissingAltCount` concept later without a
 * circular import from `page.tsx`.
 */

export type MissingField = 'alt' | 'category'

/** Minimal structural shape — callers pass their own `Product` type. */
export type MissingFieldsInput = {
    images?: Array<{ alt?: string }>
    category?: unknown[]
}

export function getMissingFields(product: MissingFieldsInput): MissingField[] {
    const missing: MissingField[] = []
    if (!product.images?.length || !product.images[0]?.alt) missing.push('alt')
    if (!product.category?.length) missing.push('category')
    return missing
}
