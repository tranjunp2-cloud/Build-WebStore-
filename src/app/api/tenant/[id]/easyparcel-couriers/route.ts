import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { withAuth } from '@/lib/auth'
import { courierList, walletBalance } from '@/lib/shipping/easyparcel/client'
import { getValidToken } from '@/lib/shipping/easyparcel/token-manager'
import { EasyParcelError } from '@/lib/shipping/easyparcel/types'

type RouteContext = { params: Promise<{ id: string }> }

/**
 * GET /api/tenant/[id]/easyparcel-couriers
 * Returns the live courier list for the tenant's connected EP account (country MY).
 * Best-effort: the settings UI falls back to a static list if this fails.
 */
export const GET = withAuth<RouteContext>(async (user, _request, ctx) => {
    try {
        const { id: tenantId } = await ctx.params

        // Verify user owns this tenant (same guard as easyparcel-test)
        const isSuperAdmin = (user as any).roles?.includes('super-admin')
        if (!isSuperAdmin) {
            const userTenantIds: string[] = ((user as any).tenants ?? []).map((t: any) => {
                const tenant = t.tenant
                if (tenant && typeof tenant === 'object') return String(tenant.id)
                return String(tenant)
            })
            if (!userTenantIds.includes(String(tenantId))) {
                return NextResponse.json(
                    { success: false, error: { code: 'FORBIDDEN', message: 'Access denied' } },
                    { status: 403 },
                )
            }
        }

        const payload = await getPayload({ config })
        const tenantDoc = await payload.findByID({ collection: 'tenants', id: tenantId, depth: 0, overrideAccess: true })
        const tenantEp = (tenantDoc as any)?.easyParcelIntegration ?? {}

        if (!tenantEp.accessToken) {
            return NextResponse.json(
                { success: false, error: { code: 'EP_NOT_CONNECTED', message: 'EasyParcel not connected.' } },
                { status: 400 },
            )
        }

        let token: string
        try {
            token = await getValidToken(tenantEp, tenantId, payload)
        } catch (err) {
            if (err instanceof EasyParcelError && err.code === 'AUTH_EXPIRED') {
                return NextResponse.json(
                    { success: false, error: { code: 'EP_NOT_CONNECTED', message: 'EasyParcel not connected.' } },
                    { status: 400 },
                )
            }
            throw err
        }

        // Wallet balance (best-effort) so the settings UI can show it without a separate test call.
        let wallet: { balance: string; currency: string } | null = null
        try {
            const w = await walletBalance(token)
            const main = w.data?.wallet?.[0]
            if (main?.balance != null) wallet = { balance: String(main.balance), currency: main.currency ?? 'MYR' }
        } catch { /* non-critical */ }

        // Show ALL couriers the EP account offers for MY — the seller picks their preferred one. COD is
        // route-dependent (West-MY domestic only) and can't be reliably determined here, so it is
        // validated at checkout against the buyer's real destination, not filtered at settings.
        const res = await courierList(token, 'MY')
        const couriers = (res.data ?? []).map((c) => ({
            id: c.courier_id,
            name: c.short_name || c.courier_name,
            fullName: c.courier_name,
            logo: c.courier_logo ?? null,
        }))

        return NextResponse.json({ success: true, data: { couriers, wallet } })
    } catch (error: unknown) {
        console.error('[EasyParcel Couriers Error]', error instanceof Error ? error.message : 'unknown')
        return NextResponse.json(
            { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to load couriers' } },
            { status: 500 },
        )
    }
})
