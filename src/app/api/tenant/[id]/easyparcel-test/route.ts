import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { withAuth } from '@/lib/auth'
import { walletBalance, getAccountInfo } from '@/lib/shipping/easyparcel/client'
import { getValidToken } from '@/lib/shipping/easyparcel/token-manager'
import { mapSubdivisionName } from '@/lib/shipping/easyparcel/normalize'
import { EasyParcelError } from '@/lib/shipping/easyparcel/types'

type RouteContext = { params: Promise<{ id: string }> }

// Simple in-memory rate limiter: 3 calls per minute per tenant
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT = 3
const WINDOW_MS = 60_000

function checkRateLimit(tenantId: string): boolean {
    const now = Date.now()
    const entry = rateLimitMap.get(tenantId)
    if (!entry || now >= entry.resetAt) {
        rateLimitMap.set(tenantId, { count: 1, resetAt: now + WINDOW_MS })
        return true
    }
    if (entry.count >= RATE_LIMIT) return false
    entry.count++
    return true
}

/**
 * POST /api/tenant/[id]/easyparcel-test
 * Tests EP OAuth connection by fetching wallet balance.
 * On success, updates tenant.easyParcelIntegration.testedAt.
 */
export const POST = withAuth<RouteContext>(async (user, request, ctx) => {
    try {
        const { id: tenantId } = await ctx.params

        // Optional: when the merchant clicks "Sync from EasyParcel", persist the pulled pickup
        // address into the local warehouse (overwriting local edits — that is the merchant's intent).
        let syncWarehouse = false
        try {
            const body = await request.json()
            syncWarehouse = body?.syncWarehouse === true
        } catch { /* no body — plain test connection */ }

        // Verify user owns this tenant
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

        // Rate limit check
        if (!checkRateLimit(tenantId)) {
            return NextResponse.json(
                { success: false, error: { code: 'RATE_LIMITED', message: 'Too many test requests. Try again in a minute.' } },
                { status: 429 },
            )
        }

        const payload = await getPayload({ config })
        const tenantDoc = await payload.findByID({
            collection: 'tenants',
            id: tenantId,
            depth: 0,
            overrideAccess: true,
        })
        const tenantEp = (tenantDoc as any)?.easyParcelIntegration ?? {}

        // Require OAuth tokens — apiKey/authKey no longer accepted
        if (!tenantEp.accessToken) {
            return NextResponse.json(
                { success: false, error: { code: 'EP_NOT_CONNECTED', message: 'EasyParcel not connected. Please connect via OAuth.' } },
                { status: 400 },
            )
        }

        let token: string
        try {
            token = await getValidToken(tenantEp, tenantId, payload)
        } catch (err) {
            if (err instanceof EasyParcelError && err.code === 'AUTH_EXPIRED') {
                return NextResponse.json(
                    { success: false, error: { code: 'EP_NOT_CONNECTED', message: 'EasyParcel not connected. Please connect via OAuth.' } },
                    { status: 400 },
                )
            }
            throw err
        }

        const walletRes = await walletBalance(token)
        const mainWallet = walletRes.data?.wallet?.[0]
        const balance = mainWallet?.balance != null ? String(mainWallet.balance) : '0'
        const currency = mainWallet?.currency ?? 'MYR'

        // Best-effort: pull live identity + default pickup address for the "Sync from EasyParcel"
        // flow. Non-critical — wallet success alone already proves the connection.
        let accountName: string | undefined
        let accountEmail: string | undefined
        let pickupAddress: Record<string, string> | undefined
        try {
            const info = await getAccountInfo(token)
            accountName = info.data?.account?.name?.trim() || undefined
            accountEmail = info.data?.address?.pickup_address?.email?.trim() || undefined
            const pa = info.data?.address?.pickup_address
            if (pa && (pa.name || pa.address1 || pa.postcode)) {
                pickupAddress = {
                    name: pa.name?.trim() || '',
                    phone: pa.phone_number?.trim() || '',
                    address1: pa.address1?.trim() || '',
                    address2: pa.address2?.trim() || '',
                    city: pa.city?.trim() || '',
                    state: pa.province_code ? mapSubdivisionName(pa.province_code.trim()) : '',
                    postcode: pa.postcode?.trim() || '',
                    country: 'MY',
                }
            }
        } catch { /* non-critical — proceed without identity / pickup */ }

        const warehouseApplied = syncWarehouse && !!pickupAddress
        const syncedWarehouses = warehouseApplied
            ? [{
                id: crypto.randomUUID(),
                label: pickupAddress!.name || 'Pickup address',
                phone: pickupAddress!.phone || '',
                address1: pickupAddress!.address1 || '',
                address2: pickupAddress!.address2 || '',
                city: pickupAddress!.city || '',
                state: pickupAddress!.state || '',
                postcode: pickupAddress!.postcode || '',
                country: 'MY',
                isDefault: true,
            }]
            : undefined
        await payload.update({
            collection: 'tenants',
            id: tenantId,
            data: {
                easyParcelIntegration: {
                    testedAt: new Date().toISOString(),
                    ...(accountName !== undefined ? { accountName } : {}),
                    ...(accountEmail !== undefined ? { accountEmail } : {}),
                    ...(syncedWarehouses ? { warehouses: syncedWarehouses } : {}),
                },
            } as any,
            overrideAccess: true,
        })

        return NextResponse.json({
            success: true,
            data: { balance, currency, accountName, accountEmail, pickupAddress, warehouseApplied },
        })
    } catch (error: unknown) {
        console.error('[EasyParcel Test Error]', error instanceof Error ? error.message : 'unknown')
        return NextResponse.json(
            { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to test connection' } },
            { status: 500 },
        )
    }
})
