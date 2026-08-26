import { NextResponse } from 'next/server'
import type { Payload } from 'payload'
import { productWeightToGrams } from '@/lib/shipping/product-weight'
import { resolveProductLine, type ProductLineProduct } from '@/lib/products/resolve-product-line'

export interface OrderItemRow {
    product: number | string
    productName: string
    variant: string
    quantity: number
    unitPrice: number
    /** Per-unit parcel weight in grams (from Products.weight kg; 500 g default) — used for EP rate quotes. */
    weightGrams: number
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
    skipStockCheck = false,
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
        const p = product as unknown as ProductLineProduct
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

        const resolved = resolveProductLine(p, item, { stockPolicy: skipStockCheck ? 'ignore' : 'reject' })
        if (!resolved.ok) {
            if (resolved.code === 'VARIANT_REQUIRED') {
                return {
                    orderItems: [], checkoutItems: [], subtotal: 0, currency,
                    errorResponse: NextResponse.json(
                        { success: false, error: { code: 'VARIANT_REQUIRED', message: `A variant must be selected for "${p.name}"` } },
                        { status: 422 },
                    ),
                }
            }
            if (resolved.code === 'VARIANT_NOT_FOUND') {
                return {
                    orderItems: [], checkoutItems: [], subtotal: 0, currency,
                    errorResponse: NextResponse.json(
                        { success: false, error: { code: 'VARIANT_NOT_FOUND', message: `Variant "${item.variant}" not found for "${p.name}"` } },
                        { status: 422 },
                    ),
                }
            }
            if (!skipStockCheck) {
                const stockAvail = resolved.available ?? 0
                return {
                    orderItems: [], checkoutItems: [], subtotal: 0, currency,
                    errorResponse: NextResponse.json(
                        {
                            success: false,
                            error: {
                                code: 'OUT_OF_STOCK',
                                message: p.hasVariants
                                    ? `"${p.name}" (${item.variant}) has only ${stockAvail} left`
                                    : `"${p.name}" has only ${p.inventory ?? 0} left in stock`,
                                ...(p.hasVariants ? { variant: item.variant } : {}),
                                available: stockAvail,
                                requested: item.quantity,
                            },
                        },
                        { status: 422 },
                    ),
                }
            }
        }

        // The `ignore` policy above guarantees a canonical variant price for legacy retry paths.
        // Normal checkout always uses the reject policy and returns on any non-success result.
        if (!resolved.ok) {
            return {
                orderItems: [], checkoutItems: [], subtotal: 0, currency,
                errorResponse: NextResponse.json(
                    { success: false, error: { code: 'OUT_OF_STOCK', message: `Product ${item.productId} is unavailable` } },
                    { status: 422 },
                ),
            }
        }
        const variant = resolved.variant
        const unitPrice = resolved.unitPrice

        currency = p.currency || 'MYR'
        subtotal += unitPrice * item.quantity
        orderItems.push({ product: productId, productName: p.name, variant: item.variant || '', quantity: item.quantity, unitPrice, weightGrams: productWeightToGrams(p.weight) })
        // Stripe expects smallest unit: 100 sen = RM 1; include variant name so customer sees "Shirt (Red)" on Stripe page
        const displayName = variant ? `${p.name} (${variant.name})` : p.name
        checkoutItems.push({ name: displayName, price: Math.round(unitPrice * 100), quantity: item.quantity, images: resolved.ok && resolved.imageUrl ? [resolved.imageUrl] : [] })
    }

    return { orderItems, checkoutItems, subtotal, currency }
}
