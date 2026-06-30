import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { withAuth } from '@/lib/auth'
import { courierList, quotations, walletBalance } from '@/lib/shipping/easyparcel/client'
import { getValidToken } from '@/lib/shipping/easyparcel/token-manager'
import { mapSubdivisionCode } from '@/lib/shipping/easyparcel/normalize'
import { getDefaultWarehouse } from '@/lib/shipping/easyparcel/warehouse'
import { EasyParcelError } from '@/lib/shipping/easyparcel/types'

// Representative destination for the COD-capability probe. COD is a courier-level capability, so any
// valid MY route surfaces which couriers offer it; we use Kuala Lumpur as a neutral default.
const COD_PROBE_DEST = { postcode: '50000', subdivision_code: 'MY-14', country: 'MY' }
const COD_PROBE_WEIGHT_KG = 1
const COD_PROBE_VALUE_RM = 100

type CourierItem = { id: string; name: string; fullName: string; logo: string | null; priceFrom?: number | null }

/**
 * Returns the COD-supporting couriers by running one sample quotation from the merchant's warehouse.
 * Built directly from the (verified) quotation response — courier.courier_id + courier_name — so it
 * does not depend on the courier/list endpoint. Returns null when it can't be determined (no
 * warehouse / quote failed), so the caller can fall back to the full courier list.
 */
async function codCouriersFromQuote(
    token: string,
    warehouse: { postcode?: string; state?: string },
): Promise<CourierItem[] | null> {
    const postcode = warehouse?.postcode?.trim()
    const state = warehouse?.state?.trim()
    if (!postcode || !state) return null
    try {
        const resp = await quotations(token, {
            sender: { postcode, subdivision_code: mapSubdivisionCode(state), country: 'MY' },
            receiver: COD_PROBE_DEST,
            parcel_value: COD_PROBE_VALUE_RM,
            weight: COD_PROBE_WEIGHT_KG,
        })
        const items = resp.data?.[0]?.quotations ?? []
        if (items.length === 0) return null
        const byId = new Map<string, CourierItem>()
        for (const it of items) {
            const cod = it.features?.find((f) => f.cod != null)?.cod
            if (!cod?.available) continue
            const price = parseFloat(it.pricing?.total_amount ?? '')
            const existing = byId.get(it.courier.courier_id)
            if (!existing) {
                byId.set(it.courier.courier_id, {
                    id: it.courier.courier_id,
                    name: it.courier.courier_name,
                    fullName: it.courier.courier_name,
                    logo: null,
                    priceFrom: Number.isFinite(price) ? price : null,
                })
            } else if (Number.isFinite(price) && (existing.priceFrom == null || price < existing.priceFrom)) {
                existing.priceFrom = price
            }
        }
        return [...byId.values()]
    } catch {
        return null
    }
}

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

        // Prefer the COD-only list derived from a sample quotation. Fall back to the full courier
        // list (best-effort) when COD can't be determined, so the picker is never empty.
        const codCouriers = await codCouriersFromQuote(token, getDefaultWarehouse(tenantEp))
        if (codCouriers && codCouriers.length > 0) {
            return NextResponse.json({ success: true, data: { couriers: codCouriers, codFiltered: true, wallet } })
        }

        const res = await courierList(token, 'MY')
        const couriers = (res.data ?? []).map((c) => ({
            id: c.courier_id,
            name: c.short_name || c.courier_name,
            fullName: c.courier_name,
            logo: c.courier_logo ?? null,
        }))

        return NextResponse.json({ success: true, data: { couriers, codFiltered: false, wallet } })
    } catch (error: unknown) {
        console.error('[EasyParcel Couriers Error]', error instanceof Error ? error.message : 'unknown')
        return NextResponse.json(
            { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to load couriers' } },
            { status: 500 },
        )
    }
})
