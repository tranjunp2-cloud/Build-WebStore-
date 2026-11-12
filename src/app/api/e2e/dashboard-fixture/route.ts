import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import { z } from 'zod'
import config from '@payload-config'
import { getCurrentUser, tenantIdForQuery } from '@/lib/auth'
import {
    DASHBOARD_FIXTURE_CAPABILITY,
    ensureDashboardFixture,
    type DashboardFixtureTenant,
} from '@/lib/e2e/dashboard-fixture'
import {
    DASHBOARD_SHIPPING_FIXTURE_CAPABILITY,
    DashboardShippingPrerequisiteError,
    prepareDashboardEasyParcelOnlyState,
} from '@/lib/e2e/dashboard-shipping-fixture'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const fixtureActionSchema = z.object({
    action: z.literal('prepare-gh1700-easyparcel-only'),
}).strict()

async function readFixtureAction(req: NextRequest) {
    const rawBody = await req.text()
    if (!rawBody.trim()) return null
    try {
        return fixtureActionSchema.parse(JSON.parse(rawBody))
    } catch {
        return undefined
    }
}

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
        const fixtureAction = await readFixtureAction(req)
        if (fixtureAction === undefined) {
            return NextResponse.json({ error: 'Invalid dashboard fixture action' }, { status: 400 })
        }
        if (fixtureAction) {
            const result = await prepareDashboardEasyParcelOnlyState(payload, tenantId)
            return NextResponse.json({
                status: 'shipping-state-ready',
                ...result,
                shippingSetupCapability: DASHBOARD_SHIPPING_FIXTURE_CAPABILITY,
            })
        }
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
            tenantSlug: tenant.slug,
            dashboardFixture,
        })
    } catch (error: unknown) {
        if (error instanceof DashboardShippingPrerequisiteError) {
            return NextResponse.json(
                {
                    error: 'Dashboard shipping fixture prerequisites not met',
                    code: error.code,
                },
                { status: 409 },
            )
        }
        console.error('[E2E Dashboard Fixture] Error:', error)
        return NextResponse.json(
            { error: 'Dashboard fixture provisioning failed' },
            { status: 500 },
        )
    }
}
