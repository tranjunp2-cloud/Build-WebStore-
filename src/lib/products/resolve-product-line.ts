export type ProductLineVariant = {
    name: string
    price: number
    compareAtPrice?: number | null
    stock?: number | null
}

export type ProductLineImage = {
    url?: string | null
    image?: { url?: string | null } | string | number | null
}

/** Minimal Product shape shared by storefront cart resolution and checkout. */
export type ProductLineProduct = {
    id: string | number
    name: string
    slug?: string
    price: number
    compareAtPrice?: number | null
    currency?: string | null
    inventory?: number | null
    hasVariants?: boolean | null
    variants?: ProductLineVariant[] | null
    images?: ProductLineImage[] | null
    weight?: number | null
    tenant?: string | number | { id: string | number }
}

export type ProductLineRequest = {
    variant?: string
    quantity: number
}

export type ProductLineResolution =
    | {
        ok: true
        variant: ProductLineVariant | null
        unitPrice: number
        compareAtPrice?: number
        stock: number | null
        quantity: number
        imageUrl?: string
    }
    | {
        ok: false
        code: 'VARIANT_REQUIRED' | 'VARIANT_NOT_FOUND' | 'OUT_OF_STOCK'
        available?: number
    }

export type ProductLineResolveOptions = {
    /** Checkout rejects an over-stock request; cart reconciliation reduces it to current stock. */
    stockPolicy?: 'reject' | 'clamp' | 'ignore'
}

/** Returns the first populated Product image URL without leaking the raw media document. */
export function getProductImageUrl(product: Pick<ProductLineProduct, 'images'>): string | undefined {
    const firstImage = product.images?.[0]
    if (!firstImage) return undefined
    if (typeof firstImage.url === 'string' && firstImage.url) return firstImage.url
    if (firstImage.image && typeof firstImage.image === 'object' && typeof firstImage.image.url === 'string') {
        return firstImage.image.url
    }
    return undefined
}

/**
 * Resolve the selected variant, canonical price and stock for one already-loaded Product.
 * Fetching and authorization deliberately stay with the caller so batch cart resolution and
 * authoritative checkout can share business rules without sharing their query strategy.
 */
export function resolveProductLine(
    product: ProductLineProduct,
    request: ProductLineRequest,
    { stockPolicy = 'reject' }: ProductLineResolveOptions = {},
): ProductLineResolution {
    if (product.hasVariants && !request.variant) {
        return { ok: false, code: 'VARIANT_REQUIRED' }
    }

    const variant = product.hasVariants && request.variant && Array.isArray(product.variants)
        ? product.variants.find(candidate => candidate.name === request.variant) ?? null
        : null

    if (product.hasVariants && request.variant && !variant) {
        return { ok: false, code: 'VARIANT_NOT_FOUND' }
    }

    const stock = product.hasVariants && variant
        ? (variant.stock ?? null)
        : (product.inventory ?? null)
    const finiteStock = stock ?? Infinity

    if (stockPolicy !== 'ignore' && finiteStock <= 0) {
        return { ok: false, code: 'OUT_OF_STOCK', available: 0 }
    }

    if (stockPolicy === 'reject' && finiteStock < request.quantity) {
        return { ok: false, code: 'OUT_OF_STOCK', available: finiteStock }
    }

    return {
        ok: true,
        variant,
        unitPrice: variant ? variant.price : product.price,
        compareAtPrice: variant?.compareAtPrice ?? product.compareAtPrice ?? undefined,
        stock,
        quantity: stockPolicy === 'clamp' ? Math.min(request.quantity, finiteStock) : request.quantity,
        imageUrl: getProductImageUrl(product),
    }
}
