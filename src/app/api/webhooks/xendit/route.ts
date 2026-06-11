import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { verifyXenditCallbackToken, handleAccountEvent } from './handlers/account-updated'
import { handlePaymentEvent } from './handlers/payment-updated'

const ACCOUNT_EVENTS = ['account.created', 'account.updated', 'account.activated'] as const
const PAYMENT_EVENTS = ['payment.capture', 'payment.authorization', 'payment.failure'] as const

/**
 * POST /api/webhooks/xendit
 *
 * Handles Xendit webhook events:
 * - account.created / account.updated / account.activated → sync tenant xenditAccountStatus
 *
 * Auth: X-CALLBACK-TOKEN header (timing-safe compare vs XENDIT_WEBHOOK_TOKEN env var).
 * Always returns 200 after successful dispatch to prevent Xendit retry storm.
 * No withAuth — webhook endpoint has no user session.
 */
export async function POST(request: Request) {
    // 1. Verify callback token
    const token = request.headers.get('x-callback-token')
    if (!verifyXenditCallbackToken(token)) {
        return NextResponse.json(
            { success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid callback token' } },
            { status: 401 },
        )
    }

    // 2. Parse body
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

    // 3. Dispatch
    try {
        const payload = await getPayload({ config })

        if ((ACCOUNT_EVENTS as readonly string[]).includes(event)) {
            await handleAccountEvent(payload, event, data)
        } else if ((PAYMENT_EVENTS as readonly string[]).includes(event)) {
            await handlePaymentEvent(payload, event, data)
        } else {
            console.log('[Xendit Webhook] Ignoring event:', event)
        }
    } catch (err: unknown) {
        // Log but return 200 — avoid Xendit retry storm
        console.error('[Xendit Webhook] Handler error (returning 200):', err)
    }

    // 4. Always ACK
    return NextResponse.json({ success: true })
}
