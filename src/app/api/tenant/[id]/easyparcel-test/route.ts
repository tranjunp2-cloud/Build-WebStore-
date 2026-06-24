import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { withAuth } from '@/lib/auth'
import { walletBalance } from '@/lib/shipping/easyparcel/client'
import { getValidToken } from '@/lib/shipping/easyparcel/token-manager'
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
export const POST = withAuth<RouteContext>(async (user, _request, ctx) => {
    try {
        const { id: tenantId } = await ctx.params

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

        // Decode JWT payload for debugging (no verification — just inspect claims)
        try {
            const parts = token.split('.')
            if (parts.length === 3) {
                const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf-8'))
                console.log('[EP Token Claims]', JSON.stringify({ sub: payload.sub, account_id: payload.account_id, scope: payload.scope, iat: payload.iat, exp: payload.exp }))
            } else {
                console.log('[EP Token] Not a JWT — format:', token.slice(0, 20) + '...')
            }
        } catch { /* non-critical */ }

        let walletRes
        try {
            walletRes = await walletBalance(token)
        } catch (walletErr) {
            if (walletErr instanceof EasyParcelError && walletErr.code === 'HTTP_ERROR') {
                const raw = walletErr.raw as { status?: number; body?: unknown } | undefined
                console.error('[EasyParcel Wallet Error]', raw?.status, JSON.stringify(raw?.body))
                const epReason = (raw?.body as any)?.reason ?? (raw?.body as any)?.data ?? 'Unknown'
                return NextResponse.json(
                    { success: false, error: { code: 'EP_WALLET_ERROR', message: `EP API error: ${epReason}`, epStatus: raw?.status, epBody: raw?.body } },
                    { status: 502 },
                )
            }
            throw walletErr
        }

        const balance = walletRes.data?.current_balance ?? '0'
        const currency = walletRes.data?.currency_code ?? 'MYR'
        const accountId = walletRes.data?.account_id
        const accountName = accountId ? `EP #${accountId} · ${currency}` : undefined

        await payload.update({
            collection: 'tenants',
            id: tenantId,
            data: {
                easyParcelIntegration: {
                    testedAt: new Date().toISOString(),
                    ...(accountName ? { accountName } : {}),
                },
            } as any,
            overrideAccess: true,
        })

        return NextResponse.json({ success: true, data: { balance, currency, accountName } })
    } catch (error: unknown) {
        console.error('[EasyParcel Test Error]', error instanceof Error ? error.message : 'unknown')
        return NextResponse.json(
            { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to test connection' } },
            { status: 500 },
        )
    }
})
