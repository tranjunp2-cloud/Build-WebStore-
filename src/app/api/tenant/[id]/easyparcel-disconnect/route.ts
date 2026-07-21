import 'server-only'
import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { withAuth } from '@/lib/auth'
import { withTenantRowLock } from '@/lib/payload/tenant-row-lock'

type RouteContext = { params: Promise<{ id: string }> }

/**
 * DELETE /api/tenant/[id]/easyparcel-disconnect
 * Clears the tenant's EasyParcel OAuth session, identity, and pickup addresses,
 * then disables the integration so a reconnect starts with the new account's data.
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
    await withTenantRowLock(payload, tenantId, async (req) => {
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
                    warehouse: null,
                    warehouses: [],
                },
            } as any,
            overrideAccess: true,
            req,
        })
    })

    return NextResponse.json({ success: true })
})
