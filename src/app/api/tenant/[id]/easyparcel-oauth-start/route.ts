import { NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { withAuth } from '@/lib/auth'
import { EP_OAUTH_BASE } from '@/lib/shipping/easyparcel/types'

type RouteContext = { params: Promise<{ id: string }> }

export const GET = withAuth<RouteContext>(async (user, _request, ctx) => {
    const { id: tenantId } = await ctx.params

    // Verify user owns this tenant (super-admin bypasses ownership check)
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

    const clientId = process.env.EASYPARCEL_CLIENT_ID ?? ''
    const redirectUri = process.env.EASYPARCEL_REDIRECT_URI ?? ''
    if (!clientId || !redirectUri) {
        return NextResponse.json(
            { success: false, error: { code: 'CONFIG_ERROR', message: 'EasyParcel OAuth not configured' } },
            { status: 400 },
        )
    }

    const nonce = randomBytes(16).toString('hex')
    const state = `${tenantId}:${nonce}`

    const url = new URL(`${EP_OAUTH_BASE}/oauth/login`)
    url.searchParams.set('client_id', clientId)
    url.searchParams.set('redirect_uri', redirectUri)
    url.searchParams.set('state', state)

    const response = NextResponse.redirect(url.toString())
    response.cookies.set(`ep_state_${tenantId}`, nonce, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 300,
        path: '/',
    })
    return response
})
