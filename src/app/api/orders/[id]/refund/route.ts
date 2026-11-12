import { NextResponse } from 'next/server'
import type { User } from 'payload'
import { withAuth } from '@/lib/auth'
import { withFeatureGuard } from '@/lib/subscriptions/feature-guard'
import { normalizeRefundNote, normalizeRefundReason, refundOrderAs } from '@/lib/orders/refund-order'

type RouteContext = { params: Promise<{ id: string }> }

/**
 * POST /api/orders/[id]/refund
 *
 * Initiates a refund for a paid order (Stripe, Xendit, bank_transfer, or COD).
 * Updates order status via SQL CAS, restocks inventory (best-effort), and fires a refund email.
 * Auth required — only the tenant owner can refund their own orders (IDOR protection).
 * The refund itself is lib/orders/refund-order.ts, shared with the AI copilot.
 *
 * Returns: { success, data: { refundId }, restock: RestockResult[] }
 */
export const POST = withFeatureGuard('order_management')(withAuth<RouteContext>(async (user: User, request: Request, ctx: RouteContext) => {
    const { id } = await ctx.params

    // Parse optional reason from body (guard non-JSON or missing body gracefully)
    let rawReason: unknown
    try {
        const ct = request.headers.get('content-type') ?? ''
        if (ct.includes('application/json')) rawReason = (await request.json())?.reason
    } catch {
        // Non-JSON or empty body — keep default reason
    }

    const result = await refundOrderAs(user, id, normalizeRefundReason(rawReason), normalizeRefundNote(rawReason))
    return NextResponse.json(result.body, { status: result.status })
}))
