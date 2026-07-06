/**
 * Why a product can't be toggled to Active (publishing gate, GH-1458).
 *
 * Operates on the PERSISTED product doc (price/sku/inventory/variants), unlike the discount guard
 * (src/lib/discounts/activation-guard.ts) which reads raw form input — the client-side product list
 * already holds the persisted doc, and the server action fetches it before applying the gate.
 *
 * Field rules mirror the existing create/edit form completeness check
 * (src/components/dashboard/product-form/schema.ts superRefine): non-variant products need
 * price/sku/inventory; variant products need a base sku + a fully-populated variants matrix.
 * Weight is required in BOTH modes — it's a single top-level field (shipping calc), not part
 * of the variant matrix, and (unlike price/inventory) 0 is never a valid physical weight.
 *
 * Per plan decision D1, images and category are NOT included — they stay optional for Active.
 *
 * Pure function, no I/O — fully unit-testable.
 */
export interface ProductPublishInput {
    price?: number | null
    sku?: string | null
    inventory?: number | null
    weight?: number | null
    hasVariants?: boolean | null
    variants?: Array<{ sku?: string | null; price?: number | null; stock?: number | null }> | null
}

export interface ProductPublishResult {
    ok: boolean
    missingFields: string[]
}

// Type-guards, not just null-checks — this function evaluates untrusted input from ANY write path
// (REST/GraphQL callers included), so `value?.trim()`/`value <= 0` cannot assume the field actually
// arrived as the type the collection schema declares it as.
function isBlank(value: unknown): boolean {
    return typeof value !== 'string' || value.trim() === ''
}

function isValidNumber(value: unknown): value is number {
    return typeof value === 'number' && Number.isFinite(value)
}

export function productPublishBlocks(product: ProductPublishInput): ProductPublishResult {
    const missing = new Set<string>()

    if (!product.hasVariants) {
        if (!isValidNumber(product.price)) missing.add('price')
        if (isBlank(product.sku)) missing.add('sku')
        if (!isValidNumber(product.inventory)) missing.add('inventory')
    } else {
        if (isBlank(product.sku)) missing.add('sku')

        const variants = product.variants ?? []
        const hasCompleteMatrix =
            variants.length > 0 &&
            variants.every((v) => !isBlank(v.sku) && isValidNumber(v.price) && isValidNumber(v.stock))
        if (!hasCompleteMatrix) missing.add('variants')
    }

    if (!isValidNumber(product.weight) || product.weight <= 0) {
        missing.add('weight')
    }

    const missingFields = Array.from(missing)
    return { ok: missingFields.length === 0, missingFields }
}
