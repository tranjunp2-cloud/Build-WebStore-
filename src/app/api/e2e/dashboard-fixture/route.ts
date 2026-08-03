import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { getCurrentUser, tenantIdForQuery } from '@/lib/auth'
import {
    DASHBOARD_FIXTURE_CAPABILITY,
    ensureDashboardFixture,
    type DashboardFixtureTenant,
} from '@/lib/e2e/dashboard-fixture'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(req: NextRequest) {
    if (process.env.APP_ENV !== 'staging') {
        return NextResponse.json(
            { error: 'Dashboard fixture is only available on staging' },
            { status: 403 },
        )
    }

    const expectedEmail = process.env.TEST_EMAIL?.trim().toLowerCase()
    if (!expectedEmail) {
        return NextResponse.json(
            { error: 'Dashboard fixture is not configured' },
            { status: 503 },
        )
    }

    if (req.headers.get('x-e2e-fixture-intent') !== DASHBOARD_FIXTURE_CAPABILITY) {
        return NextResponse.json({ error: 'Invalid fixture intent' }, { status: 400 })
    }

    const user = await getCurrentUser(req)
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (user.email?.trim().toLowerCase() !== expectedEmail) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const tenantId = tenantIdForQuery(user)
    if (tenantId === null) {
        return NextResponse.json(
            { error: 'Authenticated E2E user has no primary tenant' },
            { status: 409 },
        )
    }

    try {
        const payload = await getPayload({ config })
        const tenant = await payload.findByID({
            collection: 'tenants',
            id: tenantId,
            depth: 0,
            overrideAccess: true,
        }) as DashboardFixtureTenant
        const dashboardFixture = await ensureDashboardFixture(payload, tenant)

        return NextResponse.json({
            status: 'fixture-ready',
            setupCapability: DASHBOARD_FIXTURE_CAPABILITY,
            tenantId,
            dashboardFixture,
        })
    } catch (error: unknown) {
        console.error('[E2E Dashboard Fixture] Error:', error)
        return NextResponse.json(
            { error: 'Dashboard fixture provisioning failed' },
            { status: 500 },
        )
    }
}
