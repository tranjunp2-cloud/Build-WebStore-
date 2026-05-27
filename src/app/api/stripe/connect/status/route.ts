import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { withAuth } from '@/lib/auth'
import { getConnectedAccountStatus } from '@/lib/payment/stripe'
import type { TenantMembership } from '@/lib/normalize-tenants'

/** Minimal shape of a tenant document for Stripe Connect status check. */
interface TenantDoc {
    id: string | number
    stripeAccountId?: string | null
    stripeOnboardingComplete?: boolean
}

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
        const userTenantIds = ((user.tenants ?? []) as TenantMembership[]).map((t) =>
            String(typeof t.tenant === 'object' ? t.tenant.id : t.tenant)
        )
        if (!userTenantIds.includes(String(tenantId))) {
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

        const tenantTyped = tenant as unknown as TenantDoc
        const stripeAccountId = tenantTyped.stripeAccountId

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
        const onboardingComplete = status.chargesEnabled && status.detailsSubmitted

        // Only flip false→true; downgrades handled by account.updated webhook to avoid racing the UI.
        if (onboardingComplete && tenantTyped.stripeOnboardingComplete !== true) {
            await payload.update({
                collection: 'tenants',
                id: tenantId,
                // Payload update data type is overly strict; cast required until generated types exist
                data: { stripeOnboardingComplete: true } as Record<string, unknown>,
            })
        }

        const dbOnboardingComplete = tenantTyped.stripeOnboardingComplete === true

        return NextResponse.json({
            success: true,
            data: {
                connected: true,
                accountId: status.accountId,
                email: status.email,
                chargesEnabled: status.chargesEnabled,
                payoutsEnabled: status.payoutsEnabled,
                detailsSubmitted: status.detailsSubmitted,
                onboardingComplete: onboardingComplete || dbOnboardingComplete,
            },
        })
    } catch (error: unknown) {
        console.error('[Stripe Connect Status Error]', error)
        return NextResponse.json(
            { success: false, error: { code: 'INTERNAL_ERROR', message: 'Stripe status check failed' } },
            { status: 500 },
        )
    }
})
