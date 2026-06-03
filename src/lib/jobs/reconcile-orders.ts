import type { Payload } from 'payload'
import { reconcileOrderPaid } from '@/lib/payment/reconcile-order-paid'
import { retrieveCheckoutSession } from '@/lib/payment/stripe'

/**
 * Reconcile cron (AC-6) — SELF-HEAL ONLY.
 *
 * Finds Stripe orders stuck at 'pending' past the webhook grace window, asks Stripe whether the
 * session was actually paid, and heals pending→paid via the shared idempotent `reconcileOrderPaid()`.
 *
 * Cancelling stale/abandoned orders is intentionally NOT this job's responsibility — the
 * `payment-expiry` cron owns that (it cancels Stripe + BT orders past `paymentExpiresAt`).
 * Single responsibility: this job only RECOVERS paid-but-unwebhooked orders.
 */
export async function reconcileOrdersJob(payload: Payload, opts = { limit: 50 }) {
    const now = Date.now()
    // Each order costs one sequential Stripe round-trip; the route's maxDuration is 60s. Stop a few
    // seconds early so a backlog never gets killed mid-loop (silently skipping the tail every run).
    // Limit defaults to 50 (50 × ~300ms ≈ 15s); the cron runs every 10 min so a backlog drains quickly.
    const deadline = now + 50 * 1000
    // Only consider orders older than the 15-min webhook grace window (avoid racing fresh webhooks).
    const fifteenMinAgo = new Date(now - 15 * 60 * 1000).toISOString()

    const result = await payload.find({
        collection: 'orders',
        where: {
            and: [
                { status: { equals: 'pending' } },
                { paymentMethod: { in: ['card', 'fpx'] } },
                { createdAt: { less_than: fifteenMinAgo } },
            ],
        },
        depth: 1,           // resolve tenant.stripeAccountId
        limit: opts.limit,
        overrideAccess: true,
    })

    let reconciled = 0, skipped = 0, errors = 0, timedOut = false

    for (const order of result.docs as any[]) {
        if (Date.now() > deadline) {
            timedOut = true
            console.error(`[reconcile-orders] time budget reached — processed before tail; ${result.docs.length - reconciled - skipped - errors} orders deferred to next run`)
            break
        }
        try {
            const connectedAccountId = order.tenant?.stripeAccountId
            const sessionId = order.stripeSessionId

            // No session/account to check → leave it for payment-expiry to cancel when it expires.
            if (!sessionId || !connectedAccountId) {
                skipped++
                continue
            }

            const session = await retrieveCheckoutSession(sessionId, connectedAccountId)
            if (session && (session.payment_status === 'paid' || session.status === 'complete')) {
                const r = await reconcileOrderPaid(payload, {
                    orderId: Number(order.id),
                    session,
                    connectedAccountId,
                    source: 'cron',
                })
                if (r.status === 'reconciled') reconciled++
                else skipped++
            } else {
                // Not paid at Stripe (or transient error) — not this job's concern to cancel.
                skipped++
            }
        } catch (e: unknown) {
            payload.logger.error({ err: e, orderId: order.id }, 'reconcile-orders failed')
            errors++
        }
    }

    if (result.totalDocs > opts.limit) {
        console.error(`[reconcile-orders] batch limit ${opts.limit} of ${result.totalDocs}`)
    }

    return { reconciled, skipped, errors, timedOut, total: result.totalDocs }
}
