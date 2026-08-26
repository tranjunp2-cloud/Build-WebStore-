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
        return
    }

    // payment.failure (v2) | payment_request.expiry (v3) → mark as failed
    if (event === 'payment.failure' || event === 'payment_request.expiry') {
        await (payload.db.drizzle as any).execute(sql`
            UPDATE orders SET payment_status = 'payment_failed', updated_at = NOW()
            WHERE id = ${order.id} AND status = 'pending'
        `)
        console.log(`[Xendit Webhook] Order ${order.id} marked payment_failed`)
        return
    }

    // payment.capture | payment.authorization (v2) | payment_request.succeeded (v3) → treat as paid
    if (webhookAmount != null && Math.abs(webhookAmount - order.total) > 0.01) {
        console.error(
            `[Xendit Webhook] Amount mismatch on order ${order.id}: webhook=${webhookAmount} order=${order.total} (RM). Not reconciling.`,
        )
        return
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

/**
 * Handle Xendit Invoice webhook (POST /v2/invoices flow).
 * Invoice payloads have no `event` field — detected by presence of `external_id` at root.
 * external_id = our order.id. status = 'PAID' | 'EXPIRED' | 'PENDING'.
 */
export async function handleInvoiceEvent(payload: Payload, body: Record<string, any>): Promise<void> {
    const invoiceId: string | undefined = body.id           // inv-...
    const externalId: string | undefined = body.external_id // our order.id
    const status: string = (body.status ?? '').toUpperCase()
    // amount is RM major unit
    const webhookAmount: number | undefined = body.amount != null ? Number(body.amount) : undefined

    const order = await findOrderByPayment(payload, externalId, invoiceId)
    if (!order) {
        console.warn('[Xendit Webhook] No order for invoice', { externalId, invoiceId, status })
        return
    }

    if (status === 'EXPIRED') {
        await (payload.db.drizzle as any).execute(sql`
            UPDATE orders SET payment_status = 'payment_failed', updated_at = NOW()
            WHERE id = ${order.id} AND status = 'pending'
        `)
        console.log(`[Xendit Webhook] Invoice expired → order ${order.id} marked payment_failed`)
        return
    }

    if (status === 'PAID') {
        if (webhookAmount != null && Math.abs(webhookAmount - order.total) > 0.01) {
            console.error(
                `[Xendit Webhook] Invoice amount mismatch on order ${order.id}: webhook=${webhookAmount} order=${order.total} (RM). Not reconciling.`,
            )
            return
        }
        const channelCode = body.paymentChannel ?? body.payment_channel ?? body.paymentMethod ?? body.payment_method ?? ''
        console.log(`[Xendit Webhook] Invoice PAID order=${order.id} channel=${channelCode}`, {
            paymentChannel: body.paymentChannel,
            payment_channel: body.payment_channel,
            paymentMethod: body.paymentMethod,
            payment_method: body.payment_method,
        })
        await reconcileOrderPaid(payload, {
            orderId: order.id,
            xenditData: {
                paymentRequestId: invoiceId ?? '',
                channelCode,
            },
            source: 'webhook',
        })
        return
    }

    // PENDING or unknown statuses — no action
    console.log(`[Xendit Webhook] Invoice ${invoiceId} status=${status} — no action`)
}
