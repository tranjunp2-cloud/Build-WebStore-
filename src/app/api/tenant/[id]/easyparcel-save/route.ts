import { NextResponse, after } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { withAuth } from '@/lib/auth'
import { hasUsablePhone } from '@/lib/shipping/easyparcel/phone'
import { getDefaultWarehouse, isWarehouseComplete, normalizeWarehouses } from '@/lib/shipping/easyparcel/warehouse'
import { withTenantRowLock } from '@/lib/payload/tenant-row-lock'
import { notifyStepComplete } from '@/lib/sso/sso-api-client'

type RouteContext = { params: Promise<{ id: string }> }

export const maxDuration = 60

const MAX_WAREHOUSES = 20
const MAX_WAREHOUSE_FIELD_LENGTH = 200

function invalidWarehouse(message: string) {
    return NextResponse.json(
        { success: false, error: { code: 'INVALID_WAREHOUSE', message } },
        { status: 400 },
    )
}

function invalidRequest(message: string) {
    return NextResponse.json(
        { success: false, error: { code: 'INVALID_REQUEST', message } },
        { status: 400 },
    )
}

/**
 * POST /api/tenant/[id]/easyparcel-save
 * Persist the merchant-editable EasyParcel settings (enabled / warehouses).
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

        const body: unknown = await request.json().catch(() => null)
        if (!body || typeof body !== 'object' || Array.isArray(body)) {
            return invalidRequest('Request body must be a JSON object.')
        }
        const input = body as Record<string, unknown>
        if (typeof input.enabled !== 'boolean') {
            return invalidRequest('Enabled must be a boolean.')
        }
        if (!Array.isArray(input.warehouses)) {
            return invalidRequest('Warehouses must be an array.')
        }
        const enabled = input.enabled
        const submittedWarehouses = input.warehouses
        if (submittedWarehouses.length > MAX_WAREHOUSES) {
            return invalidWarehouse(`A maximum of ${MAX_WAREHOUSES} pickup addresses is allowed.`)
        }
        if (submittedWarehouses.some((warehouse: unknown) => (
            !warehouse || typeof warehouse !== 'object' || Array.isArray(warehouse)
        ))) {
            return invalidWarehouse('Each warehouse must be an object.')
        }
        if (submittedWarehouses.some((warehouse: unknown) => (
            typeof warehouse === 'object' && warehouse !== null && Object.values(warehouse).some((value) => (
                typeof value === 'string' && value.length > MAX_WAREHOUSE_FIELD_LENGTH
            ))
        ))) {
            return invalidWarehouse('Warehouse fields are too long.')
        }

        const invalidPhone = submittedWarehouses.some((warehouse) => {
            const phone = (warehouse as Record<string, unknown>).phone
            if (phone == null || phone === '') return false
            return typeof phone !== 'string' || !hasUsablePhone(phone)
        })
        if (invalidPhone) return invalidWarehouse('Enter a valid Malaysian warehouse phone number.')
        const invalidPostcode = submittedWarehouses.some((warehouse) => {
            const postcode = (warehouse as Record<string, unknown>).postcode
            if (postcode == null || postcode === '') return false
            return typeof postcode !== 'string' || !/^\d{5}$/.test(postcode.trim())
        })
        if (invalidPostcode) return invalidWarehouse('Warehouse postcode must contain exactly 5 digits.')

        const usedIds = new Set<string>()
        const warehouses = normalizeWarehouses(submittedWarehouses).map((warehouse) => {
            const id = warehouse.id && !usedIds.has(warehouse.id)
                ? warehouse.id
                : crypto.randomUUID()
            usedIds.add(id)
            return { ...warehouse, id }
        })

        // Guard: can only activate (enabled=true) when the default pickup address is complete.
        // Courier selection is fully automatic (cheapest that serves the route) — no allowlist needed.
        if (enabled && !isWarehouseComplete(getDefaultWarehouse({ warehouses }))) {
            return NextResponse.json(
                { success: false, error: { code: 'EP_NOT_READY', message: 'A complete default pickup address is required to activate.' } },
                { status: 400 },
            )
        }

        const payload = await getPayload({ config })
        const saveResult = await withTenantRowLock(payload, tenantId, async (req) => {
            const currentTenant = await payload.findByID({
                collection: 'tenants',
                id: tenantId,
                depth: 0,
                overrideAccess: true,
                showHiddenFields: true,
                req,
            })
            const currentIntegration = (currentTenant as { easyParcelIntegration?: Record<string, unknown> })
                .easyParcelIntegration
            const connected = Boolean(currentIntegration?.accessToken && currentIntegration?.refreshToken)
            if (!connected) {
                return NextResponse.json(
                    { success: false, error: { code: 'EP_NOT_CONNECTED', message: 'Reconnect EasyParcel before saving settings.' } },
                    { status: 409 },
                )
            }

            await payload.update({
                collection: 'tenants',
                id: tenantId,
                data: {
                    easyParcelIntegration: {
                        enabled,
                        warehouse: null,
                        warehouses,
                    },
                } as any,
                overrideAccess: true,
                req,
            })

            return null
        })
        if (saveResult) return saveResult

        if (enabled) {
            const _notifyStep2 = () =>
                notifyStepComplete(payload, user.id, 2).catch((err) =>
                    console.error('[EasyParcelSave] SSO step 2 notify failed:', err),
                )
            try {
                after(_notifyStep2)
            } catch (scheduleError) {
                console.warn('[EasyParcelSave] after() unavailable; running SSO step 2 notification immediately:', scheduleError instanceof Error ? scheduleError.message : 'unknown')
                void _notifyStep2()
            }
        }

        return NextResponse.json({ success: true, data: { enabled, warehouses } })
    } catch (error: unknown) {
        console.error('[EasyParcel Save Error]', error instanceof Error ? error.message : 'unknown')
        return NextResponse.json(
            { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to save EasyParcel settings' } },
            { status: 500 },
        )
    }
})
