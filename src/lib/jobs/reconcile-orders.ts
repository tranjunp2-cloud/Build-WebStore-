import type { Payload } from 'payload'
import { reconcileOrderPaid } from '@/lib/payment/reconcile-order-paid'
import { retrieveCheckoutSession } from '@/lib/payment/stripe'
import { getPaymentRequest } from '@/lib/payment/xendit'

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
            // Heal only when payment is actually CAPTURED — gate strictly on payment_status==='paid',
            // not session.status==='complete' (which async methods can reach while still unpaid).
            if (session && session.payment_status === 'paid') {
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

    // ── Xendit reconcile pass ──
    // Poll pending Xendit orders whose webhook may have been missed.
    const xenditResult = await payload.find({
        collection: 'orders',
        where: {
            and: [
                { status: { equals: 'pending' } },
                { paymentProvider: { equals: 'xendit' } },
                { xenditPaymentRequestId: { not_equals: null } },
                { createdAt: { less_than: fifteenMinAgo } },
            ],
        },
        depth: 1,
        limit: opts.limit,
        overrideAccess: true,
    })

    let xenditReconciled = 0, xenditSkipped = 0, xenditErrors = 0

    for (const order of xenditResult.docs as any[]) {
        if (Date.now() > deadline) { timedOut = true; break }
        try {
            const tenant = typeof order.tenant === 'object' ? order.tenant : null
            const forUserId: string | undefined = (tenant as any)?.xenditAccountId
            if (!forUserId) { xenditSkipped++; continue }
            const pr = await getPaymentRequest(order.xenditPaymentRequestId, forUserId)
            if (pr.status === 'SUCCEEDED' || pr.status === 'CAPTURED') {
                const r = await reconcileOrderPaid(payload, {
                    orderId: Number(order.id),
                    xenditData: { paymentRequestId: pr.id, channelCode: order.xenditChannelCode ?? '' },
                    source: 'cron',
                })
                if (r.status === 'reconciled') xenditReconciled++
                else xenditSkipped++
            } else {
                // FAILED/EXPIRED — payment-expiry cron handles cancel+restock.
                xenditSkipped++
            }
        } catch (e: unknown) {
            payload.logger.error({ err: e, orderId: order.id }, 'reconcile-orders xendit failed')
            xenditErrors++
        }
    }

    if (xenditResult.totalDocs > opts.limit) {
        console.error(`[reconcile-orders] xendit batch limit ${opts.limit} of ${xenditResult.totalDocs}`)
    }

    return {
        reconciled,
        skipped,
        errors,
        timedOut,
        total: result.totalDocs,
        xendit: { reconciled: xenditReconciled, skipped: xenditSkipped, errors: xenditErrors, total: xenditResult.totalDocs },
    }
}
