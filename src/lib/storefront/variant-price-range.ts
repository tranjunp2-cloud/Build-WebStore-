/**
 * Lowest and highest price across a product's variants.
 * Returns null when there is no variant with a usable price, so callers fall back to the base price.
 * Out-of-stock variants still count: the range describes what the product sells for, not what is in stock.
 */
export function variantPriceRange(
    variants: ReadonlyArray<{ price?: number | null }> | null | undefined,
): { min: number; max: number } | null {
    const prices = (variants ?? [])
        .map((v) => v.price)
        .filter((p): p is number => typeof p === 'number' && Number.isFinite(p) && p >= 0)
    if (!prices.length) return null
    return { min: Math.min(...prices), max: Math.max(...prices) }
}

/**
 * The price a product card shows: the lowest variant price for variant products (isFrom when the
 * variants differ, so the card reads "From RM 59"), otherwise the base price. compareAtPrice is dropped
 * for variant products because the base compare-at does not belong to any variant.
 */
export function listingPrice(doc: {
    price?: unknown
    compareAtPrice?: unknown
    hasVariants?: unknown
    variants?: unknown
}): { amount: number; isFrom: boolean; compareAtPrice: number | undefined } {
    const range = doc.hasVariants && Array.isArray(doc.variants)
        ? variantPriceRange(doc.variants as Array<{ price?: number | null }>)
        : null
    if (range) return { amount: range.min, isFrom: range.min !== range.max, compareAtPrice: undefined }
    const amount = typeof doc.price === 'number' ? doc.price : parseFloat(String(doc.price)) || 0
    return { amount, isFrom: false, compareAtPrice: typeof doc.compareAtPrice === 'number' ? doc.compareAtPrice : undefined }
}

type OfferVariant = { price?: number | null; stock?: number | null }

/**
 * schema.org `offers` for a product page's JSON-LD. Variant products get an AggregateOffer over the
 * variants that have a usable price (Google never sees a base price of 0); others get a single Offer.
 * Availability follows variant stock for variant products, the product inventory otherwise.
 */
export function buildProductOffers(p: {
    price?: number | null
    currency?: string | null
    inventory?: number | null
    hasVariants?: boolean | null
    variants?: ReadonlyArray<OfferVariant> | null
}) {
    const priceCurrency = p.currency || 'MYR'
    const variants = p.hasVariants ? (p.variants ?? []) : []
    const range = variantPriceRange(variants)
    if (range) {
        const priced = variants.filter((v) => variantPriceRange([v]) !== null)
        const inStock = variants.some((v) => (v.stock ?? 0) > 0)
        return {
            '@type': 'AggregateOffer' as const,
            lowPrice: range.min,
            highPrice: range.max,
            offerCount: priced.length,
            priceCurrency,
            availability: inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
        }
    }
    return {
        '@type': 'Offer' as const,
        price: p.price,
        priceCurrency,
        availability: (p.inventory ?? 0) > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
    }
}
