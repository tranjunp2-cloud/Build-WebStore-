import { sql } from 'drizzle-orm'
import { getPayload, type User } from 'payload'
import config from '@payload-config'
import { type ActionResult, respond } from './action-result'
import { sendPaymentApprovedEmails } from './payment-proof-emails'

/**
 * A seller approves a bank-transfer payment proof, as `user` (access-controlled read). The one
 * implementation of PATCH /api/orders/[id]/approve-payment and of the copilot. Needs
 * paymentMethod 'bank_transfer', paymentStatus 'pending_verification' and an order that is not
 * cancelled. A pending order becomes confirmed; the buyer gets the payment (and confirmation) email.
 */
export async function approvePaymentAs(user: User, id: string): Promise<ActionResult> {
    const payload = await getPayload({ config })
    const orderId = Number.isFinite(Number(id)) ? Number(id) : id

    const order = await payload.findByID({
        collection: 'orders',
        id: orderId,
        depth: 2,
        user,
        overrideAccess: false,
    })

    if (!order) {
        return respond(
            { success: false, error: { code: 'NOT_FOUND', message: 'Order not found' } },
            { status: 404 }
        )
    }

    if (
        order.paymentMethod !== 'bank_transfer' ||
        order.paymentStatus !== 'pending_verification' ||
        (order.status as string) === 'cancelled'
    ) {
        return respond(
            { success: false, error: { code: 'INVALID_STATE', message: 'Order is not awaiting payment verification' } },
            { status: 422 }
        )
    }

    const newStatus = (order.status as string) === 'pending' ? 'confirmed' : (order.status as string)

    // Atomic CAS: prevents concurrent double-approve AND cancel+approve race.
    // If two sellers click Approve simultaneously, only the first CAS succeeds (one write wins).
    // If cancel CAS already set status='cancelled', the WHERE clause excludes it → 0 rows → 409.
    const db = (payload.db.drizzle as any)
    const casResult = await db.execute(sql`
        UPDATE orders
        SET payment_status = 'paid',
            payment_verified_at = NOW(),
            payment_verified_by_id = ${user.id},
            verification_source = 'manual',
            status = ${newStatus},
            updated_at = NOW()
        WHERE id = ${orderId}
          AND payment_status = 'pending_verification'
          AND status NOT IN ('cancelled', 'refunded')
        RETURNING id, status, payment_status
    `)

    if (!casResult.rows?.length) {
        // CAS missed — concurrent cancel or double-approve
        const recheck = await payload.findByID({
            collection: 'orders',
            id: orderId,
            depth: 0,
            overrideAccess: true,
        })
        if ((recheck as any)?.status === 'cancelled') {
            return respond(
                { success: false, error: { code: 'CONFLICT', message: 'Order was cancelled before payment could be verified' } },
                { status: 409 }
            )
        }
        if ((recheck as any)?.paymentStatus === 'paid') {
            return respond({ success: true, data: recheck })
        }
        return respond(
            { success: false, error: { code: 'INVALID_STATE', message: 'Order is not awaiting payment verification' } },
            { status: 422 }
        )
    }

    // Fetch full updated order for email + response (CAS only returns id/status/payment_status)
    const updated = await payload.findByID({
        collection: 'orders',
        id: orderId,
        depth: 2,
        overrideAccess: true,
    })

    await sendPaymentApprovedEmails(payload, updated, newStatus, orderId)

    return respond({ success: true, data: updated })
}
