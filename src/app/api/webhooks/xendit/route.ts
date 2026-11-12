import { timingSafeEqual } from 'crypto'
import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import type { Payload } from 'payload'
import { verifyXenditCallbackToken, handleAccountEvent } from './handlers/account-updated'
import {
    findWebhookOrder,
    handleInvoiceEvent,
    handlePaymentEvent,
    webhookOrderRefs,
    type WebhookOrder,
} from './handlers/payment-updated'

const ACCOUNT_EVENTS = ['account.created', 'account.updated', 'account.activated'] as const
// v2 legacy events (XenPlatform Model B)
const PAYMENT_EVENTS_V2 = ['payment.capture', 'payment.authorization', 'payment.failure'] as const
// v3 events (Model C — merchant's own Xendit account via payment_requests API)
const PAYMENT_EVENTS_V3 = ['payment_request.succeeded', 'payment_request.expiry'] as const

function safeTimingSafeEqual(a: string, b: string): boolean {
    const bufA = Buffer.from(a)
    const bufB = Buffer.from(b)
    if (bufA.length !== bufB.length) return false
    return timingSafeEqual(bufA, bufB)
}

/**
 * Verify the X-CALLBACK-TOKEN header against the shop of the order the event will update (TC-PERF-147).
 * - Account events: ECH platform level → master XENDIT_WEBHOOK_TOKEN.
 * - Payment / invoice events naming one of our orders: that order's tenant.xenditCallbackToken, nothing else
 *   (no fallback to the master token: that would bypass per-tenant security).
 * - Payment / invoice events naming no order of ours (Xendit Dashboard test pings): master token only; the
 *   handlers do nothing without an order.
 */
async function verifyCallbackToken(
    payload: Payload,
    incomingToken: string,
    event: string,
    order: WebhookOrder | null,
): Promise<boolean> {
    if (!incomingToken) return false
    if ((ACCOUNT_EVENTS as readonly string[]).includes(event) || !order) return verifyXenditCallbackToken(incomingToken)
    if (order.tenantId == null) return false
    const tenant = await payload
        .findByID({ collection: 'tenants', id: order.tenantId, depth: 0, overrideAccess: true, select: { xenditCallbackToken: true } } as any)
        .catch(() => null) as { xenditCallbackToken?: string | null } | null
    const tenantToken = tenant?.xenditCallbackToken
    if (!tenantToken) {
        console.error('[Xendit Webhook] Tenant has no xenditCallbackToken configured — rejecting')
        return false
    }
    return safeTimingSafeEqual(incomingToken, tenantToken)
}

/**
 * POST /api/webhooks/xendit
 *
 * Handles Xendit webhook events:
 * - account.* → sync tenant xenditAccountStatus (Model B XenPlatform)
 * - payment.* (v2) → reconcile/fail order payment
 * - payment_request.* (v3) → reconcile/expire order payment (Model C)
 *
 * Auth: X-CALLBACK-TOKEN — per-tenant for payment events, master env var for account events.
 * Body is parsed before token verification to enable per-tenant lookup.
 * Always returns 200 after dispatch to prevent Xendit retry storm.
 */
export async function POST(request: Request) {
    // 1. Parse body first — needed to look up tenant for per-tenant token verification
    let body: Record<string, any>
    try {
        body = await request.json()
    } catch {
        return NextResponse.json(
            { success: false, error: { code: 'BAD_REQUEST', message: 'Invalid JSON body' } },
            { status: 400 },
        )
    }

    const event: string = body.event ?? ''
    const data: Record<string, any> = body.data ?? {}
    const token = request.headers.get('x-callback-token') ?? ''

    const isAccountEvent = (ACCOUNT_EVENTS as readonly string[]).includes(event)
    const isPaymentEvent =
        (PAYMENT_EVENTS_V2 as readonly string[]).includes(event) ||
        (PAYMENT_EVENTS_V3 as readonly string[]).includes(event)
    // Invoice webhook: no event field, has external_id at root level (invoice.paid / invoice.expired)
    const isInvoiceEvent = !event && typeof body.external_id === 'string'

    // 2. Resolve the one order this event is about, then verify the token against that order's shop
    const payload = await getPayload({ config })
    let order: WebhookOrder | null = null
    if (isPaymentEvent || isInvoiceEvent) {
        const { referenceId, paymentRequestId } = webhookOrderRefs(event, body)
        order = await findWebhookOrder(payload, referenceId, paymentRequestId)
    }
    const verified = await verifyCallbackToken(payload, token, event, order)
    if (!verified) {
        return NextResponse.json(
            { success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid callback token' } },
            { status: 401 },
        )
    }

    // 3. Dispatch — the handlers update only the verified order
    try {
        if (isAccountEvent) {
            await handleAccountEvent(payload, event, data)
        } else if ((isInvoiceEvent || isPaymentEvent) && !order) {
            console.warn('[Xendit Webhook] No order for event', { event: event || 'invoice' })
        } else if (isInvoiceEvent && order) {
            await handleInvoiceEvent(payload, body, order)
        } else if (isPaymentEvent && order) {
            await handlePaymentEvent(payload, event, data, order)
        } else {
            console.log('[Xendit Webhook] Ignoring event:', event || '(no event field)')
        }
    } catch (err: unknown) {
        // Log but return 200 — avoid Xendit retry storm
        console.error('[Xendit Webhook] Handler error (returning 200):', err)
    }

    // 4. Always ACK
    return NextResponse.json({ success: true })
}
