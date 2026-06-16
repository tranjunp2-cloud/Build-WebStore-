import type { Payload } from 'payload'
import { decrementVariantStock, restockItem } from '@/app/api/orders/lib/stock-utils'
import type { OrderItemRow } from '../stripe-checkout/build-order-items'

export type DecrementedItem = { productId: number | string; quantity: number; variantName: string | null }

export type DecrementResult =
    | { ok: true; decremented: DecrementedItem[] }
    | { ok: false; decremented: DecrementedItem[]; errorMessage: string }

/** Decrement variant stock for all items. On first failure, restock already-decremented items.
 * Non-variant items are handled at buildOrderItems level (skipStockCheck=false default). */
export async function decrementOrderStock(
    payload: Payload,
    orderItems: OrderItemRow[],
): Promise<DecrementResult> {
    const decremented: DecrementedItem[] = []
    for (const item of orderItems) {
        const productId = item.product
        const variantName = item.variant?.trim() || null
        if (!variantName) continue
        const res = await decrementVariantStock(payload, productId, variantName, item.quantity)
        if (res.ok) {
            decremented.push({ productId, quantity: item.quantity, variantName })
        } else {
            const msg = res.reason === 'insufficient_stock'
                ? `"${item.productName}" (${variantName}) is out of stock`
                : `Stock update failed for "${item.productName}"`
            return { ok: false, decremented, errorMessage: msg }
        }
    }
    return { ok: true, decremented }
}

/** Restock all decremented items (fire-and-forget per item). */
export async function restockAll(payload: Payload, decremented: DecrementedItem[]): Promise<void> {
    await Promise.all(decremented.map(d => restockItem(payload, d.productId, d.variantName, d.quantity).catch(() => null)))
}
