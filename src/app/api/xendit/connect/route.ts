import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { withAuth } from '@/lib/auth'
import { createManagedAccount, getOnboardingUrl } from '@/lib/payment/xendit'
import { XenditError, xenditFetch } from '@/lib/payment/xendit-client'
import type { TenantMembership } from '@/lib/normalize-tenants'

/**
 * POST /api/xendit/connect
 *
 * Creates a Xendit MANAGED sub-account for the tenant (idempotent) and returns
 * the hosted onboarding URL. Auth: Required (tenant owner). Body: { tenantId }.
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

        // Idempotency: if sub-account already created, just return a fresh onboarding URL
        if (tenant.xenditAccountId) {
            try {
                const onboardingUrl = await getOnboardingUrl(tenant.xenditAccountId as string)
                return NextResponse.json({
                    success: true,
                    data: {
                        xenditAccountId: tenant.xenditAccountId,
                        status: tenant.xenditAccountStatus,
                        onboardingUrl,
                    },
                })
            } catch (error: unknown) {
                console.error('[xendit-connect] getOnboardingUrl (idempotent path):', error)
                if (error instanceof XenditError) {
                    return NextResponse.json(
                        { success: false, error: { code: error.code, message: error.message } },
                        { status: 500 },
                    )
                }
                return NextResponse.json(
                    { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to retrieve onboarding URL' } },
                    { status: 500 },
                )
            }
        }

        // Create path: create sub-account, persist, then fetch onboarding URL
        const subAccountEmail = user.email as string
        let account
        try {
            account = await createManagedAccount({
                email: subAccountEmail,
                businessName: tenant.name as string,
            })
        } catch (createErr) {
            if (!(createErr instanceof XenditError) || createErr.status !== 409) throw createErr

            // 409: try to recover — check if it's one of our existing sub-accounts
            const userEmail = (user.email as string ?? '').toLowerCase()
            const raw = await xenditFetch<unknown>('/v2/accounts', { method: 'GET' })
            const list = Array.isArray(raw) ? raw : ((raw as { data?: unknown[] })?.data ?? [])
            const existing = (list as Array<{ id: string; email?: string }>).find(
                (a) => (a.email ?? '').toLowerCase() === subAccountEmail.toLowerCase(),
            )
            if (existing) {
                // Our sub-account existed in Xendit but wasn't in DB — recover
                account = existing
            } else {
                // Email conflicts with a non-platform Xendit account (e.g. personal account)
                return NextResponse.json(
                    {
                        success: false,
                        error: {
                            code: 'DUPLICATE_EMAIL',
                            message: `Email ${subAccountEmail} is already registered with Xendit. Set a different "Xendit Business Email" in the payment settings and try again.`,
                        },
                    },
                    { status: 409 },
                )
            }
        }

        // Persist BEFORE fetching the onboarding URL (race-safe)
        await payload.update({
            collection: 'tenants',
            id: tenantId,
            data: { xenditAccountId: account.id, xenditAccountStatus: 'INVITED' },
            overrideAccess: true,
        })

        const onboardingUrl = await getOnboardingUrl(account.id)

        return NextResponse.json({
            success: true,
            data: {
                xenditAccountId: account.id,
                status: 'INVITED',
                onboardingUrl,
            },
        })
    } catch (error: unknown) {
        console.error('[xendit-connect]', error)
        if (error instanceof XenditError) {
            return NextResponse.json(
                { success: false, error: { code: error.code, message: error.message } },
                { status: 500 },
            )
        }
        return NextResponse.json(
            { success: false, error: { code: 'INTERNAL_ERROR', message: 'Xendit connect failed' } },
            { status: 500 },
        )
    }
})
