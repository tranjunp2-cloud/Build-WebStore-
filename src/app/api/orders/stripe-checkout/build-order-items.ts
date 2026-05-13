import { NextResponse } from 'next/server'

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
 * Returns an errorResponse if any product is missing or out of stock.
 */
export async function buildOrderItems(
    payload: any,
    items: Array<{ productId: string | number; quantity: number; variant?: string }>,
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

        const p = product as any
        if (p.inventory !== undefined && p.inventory !== null && p.inventory < item.quantity) {
            return {
                orderItems: [], checkoutItems: [], subtotal: 0, currency,
                errorResponse: NextResponse.json(
                    { success: false, error: { code: 'OUT_OF_STOCK', message: `"${p.name}" has only ${p.inventory} left in stock` } },
                    { status: 422 },
                ),
            }
        }

        currency = p.currency || 'MYR'
        subtotal += p.price * item.quantity
        orderItems.push({ product: productId, productName: p.name, variant: item.variant || '', quantity: item.quantity, unitPrice: p.price })
        // Stripe expects smallest unit: 100 sen = RM 1
        checkoutItems.push({ name: p.name, price: Math.round(p.price * 100), quantity: item.quantity, images: p.images?.[0]?.url ? [p.images[0].url] : [] })
    }

    return { orderItems, checkoutItems, subtotal, currency }
}
