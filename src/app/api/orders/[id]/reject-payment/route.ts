import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth'
import { withFeatureGuard } from '@/lib/subscriptions/feature-guard'
import { parseRequest } from '@/lib/validations/helpers'
import { rejectPaymentSchema } from '@/lib/validations/orders'
import { rejectPaymentAs } from '@/lib/orders/reject-payment'

type RouteContext = { params: Promise<{ id: string }> }

/**
 * PATCH /api/orders/[id]/reject-payment
 * Seller rejects a bank-transfer payment proof.
 * Guards: paymentMethod==='bank_transfer' + paymentStatus==='pending_verification'
 * Rotates magicLinkSecret so old upload links are invalidated.
 * The rejection (new upload link, email) is lib/orders/reject-payment.ts, shared with the AI copilot.
 */
export const PATCH = withFeatureGuard('order_management')(withAuth<RouteContext>(async (user, request, ctx) => {
    try {
        const { id } = await ctx.params

        const { data, errorResponse } = await parseRequest(request, rejectPaymentSchema)
        if (errorResponse) return errorResponse

        const result = await rejectPaymentAs(user, id, data!)
        return NextResponse.json(result.body, { status: result.status })
    } catch (error: any) {
        console.error('[reject-payment] error', error)
        return NextResponse.json(
            { success: false, error: { code: 'INTERNAL_ERROR', message: 'Rejection failed' } },
            { status: 500 }
        )
    }
}))
