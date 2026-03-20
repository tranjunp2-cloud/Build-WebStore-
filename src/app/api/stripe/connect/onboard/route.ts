import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { withAuth } from '@/lib/auth'
import {
    createConnectedAccount,
    createAccountLink,
} from '@/lib/payment/stripe'

/**
 * POST /api/stripe/connect/onboard
 *
 * Initiates Stripe Connect onboarding for a merchant.
 * Creates a Standard connected account and returns the onboarding URL.
 *
 * Auth: Required (tenant owner)
 * Body: { tenantId }
 * Returns: { accountId, onboardingUrl }
 */
export const POST = withAuth(async (user, request) => {
    try {
        const body = await request.json()
        const { tenantId } = body

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

        const baseUrl = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000'

        // Check if already has a Stripe account
        if ((tenant as any).stripeAccountId) {
            // Already has account — just create a new onboarding link (for retry/refresh)
            const accountLinkUrl = await createAccountLink(
                (tenant as any).stripeAccountId,
                `${baseUrl}/settings?stripe=refresh`,
                `${baseUrl}/settings?stripe=complete`,
            )

            return NextResponse.json({
                success: true,
                data: {
                    accountId: (tenant as any).stripeAccountId,
                    onboardingUrl: accountLinkUrl,
                },
            })
        }

        // Create new connected account
        const accountId = await createConnectedAccount(
            user.email || '',
            (tenant as any).name || 'Merchant',
        )

        // Save to tenant
        await payload.update({
            collection: 'tenants',
            id: tenantId,
            data: {
                stripeAccountId: accountId,
                stripeOnboardingComplete: false,
            } as any,
        })

        // Create onboarding link
        const accountLinkUrl = await createAccountLink(
            accountId,
            `${baseUrl}/settings?stripe=refresh`,
            `${baseUrl}/settings?stripe=complete`,
        )

        return NextResponse.json({
            success: true,
            data: {
                accountId,
                onboardingUrl: accountLinkUrl,
            },
        })
    } catch (error: any) {
        console.error('[Stripe Connect Onboard Error]', error)
        return NextResponse.json(
            { success: false, error: { code: 'INTERNAL_ERROR', message: error.message } },
            { status: 500 },
        )
    }
})
