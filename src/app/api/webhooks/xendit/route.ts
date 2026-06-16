import { timingSafeEqual } from 'crypto'
import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import type { Payload } from 'payload'
import { verifyXenditCallbackToken, handleAccountEvent } from './handlers/account-updated'
import { handlePaymentEvent, handleInvoiceEvent } from './handlers/payment-updated'

const ACCOUNT_EVENTS = ['account.created', 'account.updated', 'account.activated'] as const
// v2 legacy events (XenPlatform Model B)
const PAYMENT_EVENTS_V2 = ['payment.capture', 'payment.authorization', 'payment.failure'] as const
// v3 events (Model C — merchant's own Xendit account via payment_requests API)
const PAYMENT_EVENTS_V3 = ['payment_request.succeeded', 'payment_request.expiry'] as const

/**
 * Verify the X-CALLBACK-TOKEN header.
 *
 * Model C (payment events): look up order via reference_id → find tenant →
 *   verify against tenant.xenditCallbackToken (per-merchant).
 * Model B (account events) + fallback: verify against master XENDIT_WEBHOOK_TOKEN env var.
 */
function safeTimingSafeEqual(a: string, b: string): boolean {
    const bufA = Buffer.from(a)
    const bufB = Buffer.from(b)
    if (bufA.length !== bufB.length) return false
    return timingSafeEqual(bufA, bufB)
}

async function resolveCallbackToken(
    payload: Payload,
    incomingToken: string,
    event: string,
    data: Record<string, any>,
    body: Record<string, any>,
): Promise<boolean> {
    if (!incomingToken) return false

    // Account events are ECH-platform-level → verify against master token
    if ((ACCOUNT_EVENTS as readonly string[]).includes(event)) {
        return verifyXenditCallbackToken(incomingToken)
    }

    // Invoice webhooks use external_id at root; payment_request webhooks use data.reference_id
    // Payment events → try per-tenant token (Model C)
    // Path 1: order id is numeric (real payment)
    const referenceId: string | undefined = data.reference_id ?? body.external_id
    if (referenceId && !isNaN(Number(referenceId))) {
        try {
            const order = await payload
                .findByID({ collection: 'orders', id: Number(referenceId), depth: 1, overrideAccess: true })
                .catch(() => null)
            if (order) {
                const tenantId =
                    typeof (order as any).tenant === 'object'
                        ? (order as any).tenant?.id
                        : (order as any).tenant
                if (tenantId) {
                    const tenant = await payload
                        .findByID({ collection: 'tenants', id: tenantId, depth: 0, overrideAccess: true })
                        .catch(() => null)
                    const tenantToken: string | undefined = (tenant as any)?.xenditCallbackToken
                    if (tenantToken) {
                        return safeTimingSafeEqual(incomingToken, tenantToken)
                    }
                    // Tenant found but has no webhook token configured — reject immediately.
                    // Do NOT fall through to master token; that would bypass per-tenant security.
                    console.error('[Xendit Webhook] Tenant has no xenditCallbackToken configured — rejecting')
                    return false
                }
            }
        } catch {
            // fall through
        }
    }

    // Real invoice events always have a numeric external_id (String(order.id)).
    // Non-numeric ids are Xendit Dashboard test pings — only accept via master platform token.
    // Path 2 (tenant token scan for non-numeric ids) is removed: it allowed any tenant to validate
    // events for other tenants' orders by supplying their own token with a non-numeric external_id.
    return verifyXenditCallbackToken(incomingToken)
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

    // 2. Verify callback token
    const payload = await getPayload({ config })
    const verified = await resolveCallbackToken(payload, token, event, data, body)
    if (!verified) {
        return NextResponse.json(
            { success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid callback token' } },
            { status: 401 },
        )
    }

    // 3. Dispatch
    try {
        const isAccountEvent = (ACCOUNT_EVENTS as readonly string[]).includes(event)
        const isPaymentEvent =
            (PAYMENT_EVENTS_V2 as readonly string[]).includes(event) ||
            (PAYMENT_EVENTS_V3 as readonly string[]).includes(event)
        // Invoice webhook: no event field, has external_id at root level (invoice.paid / invoice.expired)
        const isInvoiceEvent = !event && typeof body.external_id === 'string'

        if (isAccountEvent) {
            await handleAccountEvent(payload, event, data)
        } else if (isInvoiceEvent) {
            await handleInvoiceEvent(payload, body)
        } else if (isPaymentEvent) {
            await handlePaymentEvent(payload, event, data)
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
