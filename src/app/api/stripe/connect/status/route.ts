import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { withAuth } from '@/lib/auth'
import { getConnectedAccountStatus } from '@/lib/payment/stripe'

/**
 * GET /api/stripe/connect/status?tenantId=xxx
 *
 * Returns the Stripe Connect onboarding status for a tenant.
 *
 * Auth: Required (tenant owner)
 * Query: tenantId
 * Returns: { connected, chargesEnabled, payoutsEnabled, detailsSubmitted }
 */
export const GET = withAuth(async (user, request) => {
    try {
        const url = new URL(request.url)
        const tenantId = url.searchParams.get('tenantId')

        if (!tenantId) {
            return NextResponse.json(
                { success: false, error: { code: 'VALIDATION_ERROR', message: 'tenantId is required' } },
                { status: 422 },
            )
        }

        // Verify user owns this tenant
        const userTenantIds = ((user as any).tenants || []).map((t: any) =>
            typeof t.tenant === 'object' ? t.tenant.id : t.tenant
        )
        if (!userTenantIds.includes(tenantId)) {
            return NextResponse.json(
                { success: false, error: { code: 'FORBIDDEN', message: 'You do not own this tenant' } },
                { status: 403 },
            )
        }

        const payload = await getPayload({ config })

        const tenant = await payload.findByID({ collection: 'tenants', id: tenantId })
        if (!tenant) {
            return NextResponse.json(
                { success: false, error: { code: 'NOT_FOUND', message: 'Tenant not found' } },
                { status: 404 },
            )
        }

        const stripeAccountId = (tenant as any).stripeAccountId

        if (!stripeAccountId) {
            return NextResponse.json({
                success: true,
                data: {
                    connected: false,
                    chargesEnabled: false,
                    payoutsEnabled: false,
                    detailsSubmitted: false,
                },
            })
        }

        const status = await getConnectedAccountStatus(stripeAccountId)

        return NextResponse.json({
            success: true,
            data: {
                connected: true,
                accountId: status.accountId,
                chargesEnabled: status.chargesEnabled,
                payoutsEnabled: status.payoutsEnabled,
                detailsSubmitted: status.detailsSubmitted,
                onboardingComplete: status.chargesEnabled && status.payoutsEnabled && status.detailsSubmitted,
            },
        })
    } catch (error: any) {
        console.error('[Stripe Connect Status Error]', error)
        return NextResponse.json(
            { success: false, error: { code: 'INTERNAL_ERROR', message: 'Stripe status check failed' } },
            { status: 500 },
        )
    }
})
