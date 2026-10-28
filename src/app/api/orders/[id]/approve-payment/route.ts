import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth'
import { withFeatureGuard } from '@/lib/subscriptions/feature-guard'
import { approvePaymentAs } from '@/lib/orders/approve-payment'

type RouteContext = { params: Promise<{ id: string }> }

/**
 * PATCH /api/orders/[id]/approve-payment
 * Seller approves a bank-transfer payment proof.
 * Guards: paymentMethod==='bank_transfer' + paymentStatus==='pending_verification' + status !== 'cancelled'
 * The approval (CAS, emails) is lib/orders/approve-payment.ts, shared with the AI copilot.
 */
export const PATCH = withFeatureGuard('order_management')(withAuth<RouteContext>(async (user, _request, ctx) => {
    try {
        const { id } = await ctx.params
        const result = await approvePaymentAs(user, id)
        return NextResponse.json(result.body, { status: result.status })
    } catch (error: any) {
        console.error('[approve-payment] error', error)
        return NextResponse.json(
            { success: false, error: { code: 'INTERNAL_ERROR', message: 'Approval failed' } },
            { status: 500 }
        )
    }
}))
