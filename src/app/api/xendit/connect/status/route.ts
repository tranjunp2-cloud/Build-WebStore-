import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { withAuth } from '@/lib/auth'
import { getAccountById, mapXenditAccountStatus } from '@/lib/payment/xendit'
import type { TenantMembership } from '@/lib/normalize-tenants'

/**
 * GET /api/xendit/connect/status?tenantId=...&refresh=1
 *
 * Returns cached Xendit account status from DB. With `?refresh=1`, fetches
 * live status from Xendit API and persists the result. Auth: Required (tenant owner).
 */
export const GET = withAuth(async (user, request) => {
    try {
        const url = new URL(request.url)
        const tenantId = url.searchParams.get('tenantId')
        const refresh = url.searchParams.get('refresh') === '1'

        if (!tenantId) {
            return NextResponse.json(
                { success: false, error: { code: 'VALIDATION_ERROR', message: 'tenantId is required' } },
                { status: 422 },
            )
        }

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
        const tenant = await payload.findByID({
            collection: 'tenants',
            id: tenantId,
        })

        if (!tenant) {
            return NextResponse.json(
                { success: false, error: { code: 'NOT_FOUND', message: 'Tenant not found' } },
                { status: 404 },
            )
        }

        // Refresh path: fetch live status from Xendit and persist
        if (refresh && tenant.xenditAccountId) {
            try {
                const account = await getAccountById(tenant.xenditAccountId as string)
                const status = mapXenditAccountStatus(account.status)
                const onboardingComplete = status === 'LIVE'

                await payload.update({
                    collection: 'tenants',
                    id: tenantId,
                    data: { xenditAccountStatus: status, xenditOnboardingComplete: onboardingComplete },
                    overrideAccess: true,
                })

                return NextResponse.json({
                    success: true,
                    data: {
                        xenditAccountId: tenant.xenditAccountId,
                        status,
                        onboardingComplete,
                    },
                })
            } catch (error: unknown) {
                // Refresh failure: log and fall back to cached data (do not 500)
                console.error('[xendit-connect-status] refresh failed, falling back to cache:', error)
            }
        }

        // Cached path (default or refresh fallback)
        return NextResponse.json({
            success: true,
            data: {
                xenditAccountId: tenant.xenditAccountId ?? null,
                status: tenant.xenditAccountStatus ?? 'NOT_CONNECTED',
                onboardingComplete: tenant.xenditOnboardingComplete ?? false,
            },
        })
    } catch (error: unknown) {
        console.error('[xendit-connect-status]', error)
        return NextResponse.json(
            { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch Xendit status' } },
            { status: 500 },
        )
    }
})
