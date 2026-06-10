import type { Payload } from 'payload'
import type { PaymentWebhookEvent } from '@/lib/payment/types'
import { verifyConnectedAccountOwnership } from './verify-account-ownership'
import { reconcileOrderPaid } from '@/lib/payment/reconcile-order-paid'

/**
 * Handle Stripe `checkout.session.completed` (Direct Charges).
 *
 * Webhook-specific guards live here (connected-account context, client_reference_id validation,
 * IDOR ownership). The actual "order is now paid" transition + stock + emails + notification is
 * delegated to the shared, idempotent `reconcileOrderPaid()` — the single source of truth also
 * used by the active-reconcile endpoint (confirm polling) and the reconcile cron.
 */
export async function handleCheckoutCompleted(
    payload: Payload,
    event: PaymentWebhookEvent,
) {
    const session = event.data

    // Direct Charges: every legitimate checkout.session.completed must carry a connectedAccountId.
    if (!event.connectedAccountId) {
        console.error('[Stripe Webhook] SECURITY: checkout.session.completed without connectedAccountId — rejecting')
        return
    }

    const orderId = session.client_reference_id
    if (!orderId) {
        console.warn('[Stripe Webhook] checkout.session.completed without client_reference_id')
        return
    }
    if (!/^\d+$/.test(orderId)) {
        console.warn('[Stripe Webhook] invalid client_reference_id (non-numeric):', orderId)
        return
    }
    const orderIdInt = parseInt(orderId, 10)

    // IDOR guard: the connected Stripe account firing this webhook must own the order's tenant.
    const preCheckResult = await payload.find({
        collection: 'orders',
        where: { id: { equals: orderIdInt } },
        depth: 0,
        limit: 1,
        overrideAccess: true,
    }).catch(() => null)
    const preCheckDoc = preCheckResult?.docs[0] as any
    if (!preCheckDoc) {
        console.warn(`[Stripe Webhook] connected-account event for unknown order ${orderIdInt} — skipping`)
        return
    }
    const ownerTenantId = typeof preCheckDoc.tenant === 'object' ? preCheckDoc.tenant.id : preCheckDoc.tenant
    if (!ownerTenantId) {
        console.warn(`[Stripe Webhook] connected-account event for order ${orderIdInt} with no tenant — skipping`)
        return
    }
    const allowed = await verifyConnectedAccountOwnership(
        payload, event.connectedAccountId, ownerTenantId, `checkout.session.completed order ${orderIdInt}`,
    )
    if (!allowed) return

    // Capture gate: checkout.session.completed can fire for a delayed-notification method while the
    // session is still unpaid (payment_status !== 'paid'). Only reconcile once payment is captured —
    // the async success arrives later as checkout.session.async_payment_succeeded.
    if (session.payment_status && session.payment_status !== 'paid') {
        console.log(`[Stripe Webhook] order ${orderIdInt} completed but payment_status=${session.payment_status} — awaiting capture`)
        return
    }

    try {
        await reconcileOrderPaid(payload, {
            orderId: orderIdInt,
            session,
            connectedAccountId: event.connectedAccountId,
            source: 'webhook',
        })
    } catch (err: unknown) {
        console.error(`[Stripe Webhook] Failed to reconcile order ${orderId}:`, err instanceof Error ? err.message : err)
    }
}
