import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { getCurrentUser } from '@/lib/auth'
import { revalidateTenantStorefront } from '@/lib/cache/revalidate-storefront'

/**
 * POST /api/v1/sso/ban-user
 *
 * Suspends all tenants belonging to the given user.
 * Called by SSO BanProductUser job (fire-and-forget, no retry).
 *
 * Auth: Bearer token (super-admin)
 * Body: { email }
 */
export async function POST(req: NextRequest) {
    try {
        const payload = await getPayload({ config })

        const authHeader = req.headers.get('authorization')
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ message: 'Authorization required' }, { status: 401 })
        }
        const callerUser = await getCurrentUser(req)
        if (!callerUser) return NextResponse.json({ message: 'Invalid token' }, { status: 401 })
        if (!callerUser.roles?.includes('super-admin')) {
            return NextResponse.json({ message: 'Insufficient permissions' }, { status: 403 })
        }

        const { email } = await req.json()
        if (!email) return NextResponse.json({ message: 'email is required' }, { status: 400 })

        const userResult = await payload.find({
            collection: 'users',
            where: { email: { equals: email } },
            limit: 1,
            depth: 1,
        })
        if (userResult.docs.length === 0) {
            return NextResponse.json({ message: 'User not found' }, { status: 404 })
        }

        const user = userResult.docs[0]
        const tenantEntries = user.tenants as Array<{ tenant: string | { id: string } }> | undefined
        const tenantIds = (tenantEntries || [])
            .map(t => (typeof t.tenant === 'string' ? t.tenant : t.tenant?.id))
            .filter(Boolean) as string[]

        let updated = 0
        for (const tenantId of tenantIds) {
            const tenant = await payload.update({ collection: 'tenants', id: tenantId, data: { status: 'suspended' } })
            // #2179: post-commit bust, so no storefront read between hook and commit keeps the old status cached
            revalidateTenantStorefront(tenant)
            updated++
        }

        console.log(`[V2][SSO BanUser] Suspended ${updated} tenant(s) for ${email}`)
        return NextResponse.json({ message: 'User banned', tenantsUpdated: updated }, { status: 200 })
    } catch (error) {
        console.error('[V2][SSO BanUser Error]', error)
        return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
    }
}
