import 'server-only'
import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { withAuth } from '@/lib/auth'

type RouteContext = { params: Promise<{ id: string }> }

/**
 * DELETE /api/tenant/[id]/easyparcel-disconnect
 * Clears the tenant's EasyParcel OAuth session + identity and disables the integration.
 * Warehouse / selectedCourier are kept so a future reconnect doesn't lose local config.
 */
export const DELETE = withAuth<RouteContext>(async (user, _request, ctx) => {
    const { id: tenantId } = await ctx.params

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
    await payload.update({
        collection: 'tenants',
        id: tenantId,
        data: {
            easyParcelIntegration: {
                accessToken: null,
                refreshToken: null,
                tokenExpiresAt: null,
                tokenRefreshExpiresAt: null,
                accountName: null,
                accountEmail: null,
                enabled: false,
                testedAt: null,
            },
        } as any,
        overrideAccess: true,
    })

    return NextResponse.json({ success: true })
})
