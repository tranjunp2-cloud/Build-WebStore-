import { NextResponse } from 'next/server'
import type { Payload } from 'payload'

/** Minimal shape of a product document used in build-order-items flow. */
interface ProductDoc {
    id: string | number
    name: string
    price: number
    currency?: string
    inventory?: number | null
    hasVariants?: boolean
    variants?: Array<{ name: string; price: number }>  // stock omitted: server uses aggregate p.inventory, not per-variant stock
    tenant?: string | number | { id: string | number }
    images?: Array<{ url?: string }>
}

export interface OrderItemRow {
    product: number | string
    productName: string
    variant: string
    quantity: number
    unitPrice: number
}

export interface CheckoutItemRow {
    name: string
    price: number // in sen (MYR smallest unit)
    quantity: number
    images: string[]
}

export interface BuildResult {
    orderItems: OrderItemRow[]
    checkoutItems: CheckoutItemRow[]
    subtotal: number
    currency: string
    errorResponse?: ReturnType<typeof NextResponse.json>
}

/**
 * Validate products, check stock, and build order + Stripe checkout line items.
 * Returns an errorResponse if any product is missing, out of stock, or belongs to a different tenant.
 */
export async function buildOrderItems(
    payload: Payload,
    items: Array<{ productId: string | number; quantity: number; variant?: string }>,
    tenantId?: number | string,
): Promise<BuildResult> {
    const orderItems: OrderItemRow[] = []
    const checkoutItems: CheckoutItemRow[] = []
    let subtotal = 0
    let currency = 'MYR'

    for (const item of items) {
        const productId =
            typeof item.productId === 'string' && !isNaN(Number(item.productId))
                ? Number(item.productId)
                : item.productId

        const product = await payload.findByID({ collection: 'products', id: productId, depth: 0 })
        if (!product) {
            return {
                orderItems: [], checkoutItems: [], subtotal: 0, currency,
                errorResponse: NextResponse.json(
                    { success: false, error: { code: 'PRODUCT_NOT_FOUND', message: `Product ${item.productId} not found` } },
                    { status: 404 },
                ),
            }
        }

        // Eligibility guard: must be active + not soft-deleted (mirrors COD route find() where clause).
        // findByID does NOT apply Payload where clauses → `!== 'active'` covers undefined/missing too
        // (undefined !== 'active' is true, so legacy rows without a status field are correctly rejected).
        const productAny = product as any
        if (productAny.status !== 'active' || productAny.deletedAt) {
            return {
                orderItems: [], checkoutItems: [], subtotal: 0, currency,
                errorResponse: NextResponse.json(
                    { success: false, error: { code: 'PRODUCT_NOT_FOUND', message: `Product ${item.productId} not found` } },
                    { status: 404 },
                ),
            }
        }

        // Cross-tenant IDOR guard: reject if product has no tenant or belongs to a different tenant
        const p = product as unknown as ProductDoc
        if (tenantId !== undefined) {
            const productTenantId = typeof p.tenant === 'object' ? p.tenant?.id : p.tenant
            if (!productTenantId || String(productTenantId) !== String(tenantId)) {
                return {
                    orderItems: [], checkoutItems: [], subtotal: 0, currency,
                    errorResponse: NextResponse.json(
                        { success: false, error: { code: 'PRODUCT_NOT_FOUND', message: `Product ${item.productId} not found` } },
                        { status: 404 },
                    ),
                }
            }
        }

        // Guard: hasVariants products require an explicit variant selection
        if (p.hasVariants && !item.variant) {
            return {
                orderItems: [], checkoutItems: [], subtotal: 0, currency,
                errorResponse: NextResponse.json(
                    { success: false, error: { code: 'VARIANT_REQUIRED', message: `A variant must be selected for "${p.name}"` } },
                    { status: 422 },
                ),
            }
        }

        // Variant resolution — depth:0 is safe: variants is an array field, present on the doc
        const variant = (p.hasVariants && item.variant && Array.isArray(p.variants))
            ? p.variants!.find(v => v.name === item.variant) ?? null
            : null

        // Stale or unknown variant → reject; prevents silent base-price fallback exploit
        if (p.hasVariants && item.variant && !variant) {
            return {
                orderItems: [], checkoutItems: [], subtotal: 0, currency,
                errorResponse: NextResponse.json(
                    { success: false, error: { code: 'VARIANT_NOT_FOUND', message: `Variant "${item.variant}" not found for "${p.name}"` } },
                    { status: 422 },
                ),
            }
        }

        const unitPrice = variant ? variant.price : p.price
        // Advisory OOS guard: use aggregate p.inventory (decremented by COD CAS in stock-cas.ts).
        // Per-variant stock decrement (products_variants.stock) is a follow-up task — variant.stock
        // is never decremented today, so reading it would give a permanently stale value.
        const stockAvail = p.inventory ?? Infinity

        if (stockAvail < item.quantity) {
            return {
                orderItems: [], checkoutItems: [], subtotal: 0, currency,
                errorResponse: NextResponse.json(
                    {
                        success: false,
                        error: {
                            code: 'OUT_OF_STOCK',
                            message: `"${p.name}" has only ${p.inventory ?? 0} left in stock`,
                        },
                    },
                    { status: 422 },
                ),
            }
        }

        currency = p.currency || 'MYR'
        subtotal += unitPrice * item.quantity
        orderItems.push({ product: productId, productName: p.name, variant: item.variant || '', quantity: item.quantity, unitPrice })
        // Stripe expects smallest unit: 100 sen = RM 1; include variant name so customer sees "Shirt (Red)" on Stripe page
        const displayName = variant ? `${p.name} (${variant.name})` : p.name
        checkoutItems.push({ name: displayName, price: Math.round(unitPrice * 100), quantity: item.quantity, images: p.images?.[0]?.url ? [p.images[0].url] : [] })
    }

    return { orderItems, checkoutItems, subtotal, currency }
}
