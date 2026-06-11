import { sql } from 'drizzle-orm'
import type { Payload } from 'payload'
import { reconcileOrderPaid } from '@/lib/payment/reconcile-order-paid'

/**
 * Find order by reference_id (= our order.id, string) OR by xenditPaymentRequestId.
 * reference_id is persisted at order creation; xenditPaymentRequestId persisted after PR created.
 * Using both covers the race where webhook fires before PR id is saved.
 */
async function findOrderByPayment(
    payload: Payload,
    referenceId: string | undefined,
    paymentRequestId: string | undefined,
): Promise<{ id: number; total: number; status: string } | null> {
    // Try reference_id first (order.id as string)
    if (referenceId && !isNaN(Number(referenceId))) {
        const order = await payload
            .findByID({
                collection: 'orders',
                id: Number(referenceId),
                depth: 0,
                overrideAccess: true,
            })
            .catch(() => null) as Record<string, any> | null
        if (order) {
            return { id: Number(order.id), total: Number(order.total), status: String(order.status) }
        }
    }
    // Fallback: lookup by xenditPaymentRequestId
    if (paymentRequestId) {
        const { docs } = await payload.find({
            collection: 'orders',
            where: { xenditPaymentRequestId: { equals: paymentRequestId } },
            limit: 1,
            depth: 0,
            overrideAccess: true,
        })
        if (docs[0]) {
            const d = docs[0] as Record<string, any>
            return { id: Number(d.id), total: Number(d.total), status: String(d.status) }
        }
    }
    return null
}

export async function handlePaymentEvent(payload: Payload, event: string, data: Record<string, any>): Promise<void> {
    const paymentRequestId: string | undefined = data.payment_request_id ?? data.id
    const referenceId: string | undefined = data.reference_id
    const channelCode: string = data.channel_code ?? ''
    // data.amount is RM major unit — compare directly to order.total (RM). NO /100 or *100.
    const webhookAmount: number | undefined = data.amount != null ? Number(data.amount) : undefined

    const order = await findOrderByPayment(payload, referenceId, paymentRequestId)
    if (!order) {
        console.warn('[Xendit Webhook] No order for payment', { referenceId, paymentRequestId, event })
        return // 200 — may be a race; Xendit retries will be handled
    }

    if (event === 'payment.failure') {
        await (payload.db.drizzle as any).execute(sql`
            UPDATE orders SET payment_status = 'payment_failed', updated_at = NOW()
            WHERE id = ${order.id} AND status = 'pending'
        `)
        console.log(`[Xendit Webhook] Order ${order.id} marked payment_failed`)
        return
    }

    // payment.capture | payment.authorization → treat as paid
    // (authorization = pre-auth, capture = final)
    // Amount guard: assert RM amount matches to prevent tampered/unit-bug reconciliation.
    if (webhookAmount != null && Math.abs(webhookAmount - order.total) > 0.01) {
        console.error(
            `[Xendit Webhook] Amount mismatch on order ${order.id}: webhook=${webhookAmount} order=${order.total} (RM). Not reconciling.`,
        )
        return // 200 — do not transition; ops must investigate
    }

    await reconcileOrderPaid(payload, {
        orderId: order.id,
        xenditData: {
            paymentRequestId: paymentRequestId ?? '',
            channelCode,
        },
        source: 'webhook',
    })
}
