import { sql } from 'drizzle-orm'
import type { Payload } from 'payload'
import { reconcileOrderPaid } from '@/lib/payment/reconcile-order-paid'

/** The one order a payment webhook is about; its shop's callback token is the one checked (TC-PERF-147). */
export interface WebhookOrder {
    id: number
    total: number
    status: string
    currency: string
    tenantId: number | string | null
}

function toWebhookOrder(doc: Record<string, any>): WebhookOrder {
    const tenant = doc.tenant && typeof doc.tenant === 'object' ? doc.tenant.id : doc.tenant
    return {
        id: Number(doc.id),
        total: Number(doc.total),
        status: String(doc.status),
        currency: String(doc.currency || 'MYR').toUpperCase(),
        tenantId: tenant ?? null,
    }
}

/**
 * Find the order by reference_id / external_id (= our order.id, string) OR by xenditPaymentRequestId.
 * reference_id is persisted at order creation; xenditPaymentRequestId persisted after the PR / invoice is created.
 * Using both covers the race where the webhook fires before the id is saved. The route verifies the callback token
 * against THIS order's shop and the handlers update only this order: the token used to be checked against the
 * order of `data.reference_id` while an invoice event updated the order of `external_id`, so one shop's token
 * could mark another shop's order paid.
 */
export async function findWebhookOrder(
    payload: Payload,
    referenceId: string | undefined,
    paymentRequestId: string | undefined,
): Promise<WebhookOrder | null> {
    if (referenceId && /^\d{1,15}$/.test(String(referenceId))) {
        const order = await payload
            .findByID({ collection: 'orders', id: Number(referenceId), depth: 0, overrideAccess: true })
            .catch(() => null) as Record<string, any> | null
        if (order) return toWebhookOrder(order)
    }
    if (paymentRequestId && typeof paymentRequestId === 'string') {
        const { docs } = await payload.find({
            collection: 'orders',
            where: { xenditPaymentRequestId: { equals: paymentRequestId } },
            limit: 1,
            depth: 0,
            overrideAccess: true,
        })
        if (docs[0]) return toWebhookOrder(docs[0] as Record<string, any>)
    }
    return null
}

/** Ids a webhook names its order by: payment events in `data`, invoice events at the root. */
export function webhookOrderRefs(event: string, body: Record<string, any>): { referenceId?: string; paymentRequestId?: string } {
    const data: Record<string, any> = body.data ?? {}
    if (!event) return { referenceId: body.external_id, paymentRequestId: body.id }
    return { referenceId: data.reference_id, paymentRequestId: data.payment_request_id ?? data.id }
}

const toCents = (value: unknown): number | null => {
    if (value === null || value === undefined || value === '') return null
    const n = Number(value)
    return Number.isFinite(n) ? Math.round(n * 100) : null
}

/**
 * The paid amount and currency must be present and equal the order's (amounts in the same major unit as
 * `order.total`, compared in cents). A webhook that leaves out `amount` no longer skips the check.
 */
export function paidAmountMatches(order: WebhookOrder, amount: unknown, currency: unknown): boolean {
    const paid = toCents(amount)
    const expected = toCents(order.total)
    if (paid === null || expected === null || paid !== expected) return false
    return typeof currency === 'string' && currency.trim().toUpperCase() === order.currency
}

const markFailed = (payload: Payload, orderId: number) => (payload.db.drizzle as any).execute(sql`
    UPDATE orders SET payment_status = 'payment_failed', updated_at = NOW()
    WHERE id = ${orderId} AND status = 'pending'
`)

export async function handlePaymentEvent(
    payload: Payload,
    event: string,
    data: Record<string, any>,
    order: WebhookOrder,
): Promise<void> {
    const paymentRequestId: string | undefined = data.payment_request_id ?? data.id
    const channelCode: string = data.channel_code ?? ''

    // payment.failure (v2) | payment_request.expiry (v3) → mark as failed
    if (event === 'payment.failure' || event === 'payment_request.expiry') {
        await markFailed(payload, order.id)
        console.log(`[Xendit Webhook] Order ${order.id} marked payment_failed`)
        return
    }

    // payment.capture | payment.authorization (v2) | payment_request.succeeded (v3) → treat as paid.
    // data.amount is RM major unit — compared to order.total (RM). v3 captures name it request_amount.
    const amount = data.amount ?? data.request_amount ?? data.captures?.[0]?.capture_amount
    if (!paidAmountMatches(order, amount, data.currency)) {
        console.error(
            `[Xendit Webhook] Amount/currency mismatch on order ${order.id}: webhook=${amount} ${data.currency} order=${order.total} ${order.currency}. Not reconciling.`,
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
export async function handleInvoiceEvent(payload: Payload, body: Record<string, any>, order: WebhookOrder): Promise<void> {
    const invoiceId: string | undefined = body.id // inv-...
    const status: string = (body.status ?? '').toUpperCase()

    if (status === 'EXPIRED') {
        await markFailed(payload, order.id)
        console.log(`[Xendit Webhook] Invoice expired → order ${order.id} marked payment_failed`)
        return
    }

    if (status === 'PAID') {
        // paid_amount is what the buyer paid; amount the invoice total (RM major unit)
        const amount = body.paid_amount ?? body.amount
        if (!paidAmountMatches(order, amount, body.currency)) {
            console.error(
                `[Xendit Webhook] Invoice amount/currency mismatch on order ${order.id}: webhook=${amount} ${body.currency} order=${order.total} ${order.currency}. Not reconciling.`,
            )
            return
        }
        const channelCode = body.paymentChannel ?? body.payment_channel ?? body.paymentMethod ?? body.payment_method ?? ''
        console.log(`[Xendit Webhook] Invoice PAID order=${order.id} channel=${channelCode}`)
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
