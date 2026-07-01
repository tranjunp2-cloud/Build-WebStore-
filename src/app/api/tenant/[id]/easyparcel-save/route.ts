import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { withAuth } from '@/lib/auth'
import { getDefaultWarehouse, isWarehouseComplete, type Warehouse } from '@/lib/shipping/easyparcel/warehouse'

type RouteContext = { params: Promise<{ id: string }> }

/**
 * POST /api/tenant/[id]/easyparcel-save
 * Persist the merchant-editable EasyParcel settings (enabled / warehouses / selectedCourier).
 * Uses overrideAccess after an explicit ownership check — the client can't PATCH /api/tenants
 * directly because the group holds server-only token fields guarded by field access.
 */
export const POST = withAuth<RouteContext>(async (user, request, ctx) => {
    try {
        const { id: tenantId } = await ctx.params

        // Ownership guard (same as the other easyparcel tenant routes)
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

        const body = await request.json().catch(() => ({}))
        const enabled = body?.enabled === true
        const warehouses: Warehouse[] = Array.isArray(body?.warehouses) ? body.warehouses : []
        const selectedCourier = typeof body?.selectedCourier === 'string' ? body.selectedCourier : ''

        // Guard: can only activate (enabled=true) when the default pickup is complete + a courier is set.
        if (enabled && (!isWarehouseComplete(getDefaultWarehouse({ warehouses })) || !selectedCourier)) {
            return NextResponse.json(
                { success: false, error: { code: 'EP_NOT_READY', message: 'A complete default pickup address and a courier are required to activate.' } },
                { status: 400 },
            )
        }

        const payload = await getPayload({ config })
        await payload.update({
            collection: 'tenants',
            id: tenantId,
            data: { easyParcelIntegration: { enabled, warehouses, selectedCourier } } as any,
            overrideAccess: true,
        })

        return NextResponse.json({ success: true })
    } catch (error: unknown) {
        console.error('[EasyParcel Save Error]', error instanceof Error ? error.message : 'unknown')
        return NextResponse.json(
            { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to save EasyParcel settings' } },
            { status: 500 },
        )
    }
})
