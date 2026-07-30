/**
 * E2E Test User Provisioning — idempotent endpoint for CI.
 *
 * POST /api/e2e/ensure-test-user
 *   headers: Authorization: Bearer {E2E_SETUP_SECRET}
 *   body: { email: string, password: string, tenantSlug?: `e2e-${string}`, tenantName?: string,
 *           seedDashboardFixture?: boolean }
 *
 * Creates or syncs a dedicated E2E test user on staging.
 * - If user exists: updates password to match CI secret
 * - If not: creates with tenant-owner role + active E2E tenant
 *
 * Guarded by E2E_SETUP_SECRET env var. Disabled if secret not set.
 * NEVER enable this in production — staging only.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getPayload, type Payload } from 'payload'
import config from '@payload-config'
import { normalizeDashboardBlocks } from '@/lib/dashboard-utils'

export const dynamic = 'force-dynamic'

const E2E_TENANT_NAME = 'E2E Test Workspace'
const E2E_TENANT_SLUG = 'e2e-test'
const E2E_DASHBOARD_SITE_NAME = 'E2E Dashboard Fixture'
const E2E_DASHBOARD_ORDER_PREFIX = 'E2E-DASHBOARD-PENDING'
const E2E_DASHBOARD_ORDER_TOTAL = 107.8
const E2E_SETUP_CAPABILITY = 'dashboard-fixture-v2'

type DashboardFixtureTenant = {
    id: string | number
    settings?: unknown
}

function dashboardPreferencesWithOrders(raw: unknown) {
    const savedPreferences = Array.isArray(raw)
        ? raw.filter((item): item is string => typeof item === 'string')
        : undefined
    const preferences = normalizeDashboardBlocks(savedPreferences)
    return preferences.includes('orders') ? preferences : [...preferences, 'orders' as const]
}

async function ensureDashboardFixture(payload: Payload, tenant: DashboardFixtureTenant) {
    const tenantId = tenant.id
    const orderNumber = `${E2E_DASHBOARD_ORDER_PREFIX}-${String(tenantId)}`
    const settings = tenant.settings && typeof tenant.settings === 'object' && !Array.isArray(tenant.settings)
        ? tenant.settings as Record<string, unknown>
        : {}
    await payload.update({
        collection: 'tenants',
        id: tenantId,
        data: {
            settings: {
                ...settings,
                dashboardPreferences: dashboardPreferencesWithOrders(settings.dashboardPreferences),
            },
        },
        overrideAccess: true,
    })
    const sitesResult = await payload.find({
        collection: 'sites',
        where: {
            and: [
                { tenant: { equals: tenantId } },
                { name: { equals: E2E_DASHBOARD_SITE_NAME } },
            ],
        },
        limit: 1,
        depth: 0,
        overrideAccess: true,
    })

    let siteId: string | number
    if (sitesResult.docs.length > 0) {
        siteId = sitesResult.docs[0].id
        await payload.update({
            collection: 'sites',
            id: siteId,
            data: { generationStatus: 'completed' },
            overrideAccess: true,
        })
    } else {
        const site = await payload.create({
            collection: 'sites',
            data: {
                tenant: tenantId,
                name: E2E_DASHBOARD_SITE_NAME,
                status: 'published',
                siteType: 'ecommerce',
                generationStatus: 'completed',
            },
            overrideAccess: true,
        })
        siteId = site.id
    }

    const productToken = String(tenantId)
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, '-')
    const productData = {
        tenant: tenantId,
        site: siteId,
        name: 'E2E Dashboard Product',
        slug: `e2e-dashboard-product-${productToken}`,
        price: 49.9,
        sku: `E2E-DASHBOARD-PRODUCT-${productToken}`.toUpperCase(),
        inventory: 10,
        weight: 0.5,
        hasVariants: false,
        seo: {
            title: 'E2E Dashboard Product',
            description: 'Deterministic product fixture for dashboard E2E tests.',
        },
        status: 'active' as const,
    }
    const productsResult = await payload.find({
        collection: 'products',
        where: {
            and: [
                { tenant: { equals: tenantId } },
                { slug: { equals: productData.slug } },
            ],
        },
        limit: 1,
        depth: 0,
        overrideAccess: true,
    })

    let productId: string | number
    if (productsResult.docs.length > 0) {
        productId = productsResult.docs[0].id
        await payload.update({
            collection: 'products',
            id: productId,
            data: productData,
            overrideAccess: true,
        })
    } else {
        const product = await payload.create({
            collection: 'products',
            data: productData,
            overrideAccess: true,
        })
        productId = product.id
    }

    // Recreate the dedicated fixture so createdAt always belongs to the current
    // dashboard period and a failed prior run cannot leak status into this one.
    const previousOrders = await payload.find({
        collection: 'orders',
        where: {
            and: [
                { tenant: { equals: tenantId } },
                { orderNumber: { equals: orderNumber } },
            ],
        },
        limit: 1,
        depth: 0,
        overrideAccess: true,
    })
    for (const order of previousOrders.docs) {
        await payload.delete({
            collection: 'orders',
            id: order.id,
            overrideAccess: true,
        })
    }

    const order = await payload.create({
        collection: 'orders',
        data: {
            tenant: tenantId,
            site: siteId,
            orderNumber,
            items: [{
                product: productId,
                productName: 'E2E Dashboard Product',
                quantity: 2,
                unitPrice: 49.9,
            }],
            subtotal: 99.8,
            shippingFee: 8,
            tax: 0,
            total: E2E_DASHBOARD_ORDER_TOTAL,
            currency: 'MYR',
            status: 'pending',
            paymentMethod: 'cod',
            paymentStatus: 'unpaid',
            customerName: 'E2E Dashboard Buyer',
            customerEmail: 'dashboard-fixture@example.invalid',
        },
        overrideAccess: true,
    })

    return {
        orderId: order.id,
        orderNumber,
        orderTotal: E2E_DASHBOARD_ORDER_TOTAL,
    }
}

export async function POST(req: NextRequest) {
    // Guard 1: endpoint must be explicitly enabled via env var
    const expectedSecret = process.env.E2E_SETUP_SECRET
    if (!expectedSecret) {
        return NextResponse.json(
            { error: 'E2E setup disabled — E2E_SETUP_SECRET not configured' },
            { status: 503 },
        )
    }

    // Guard 2: block on production environment
    if (process.env.NODE_ENV === 'production' && process.env.APP_ENV !== 'staging') {
        return NextResponse.json(
            { error: 'E2E setup forbidden in production' },
            { status: 403 },
        )
    }

    // Guard 3: verify bearer token
    const authHeader = req.headers.get('authorization') || ''
    const token = authHeader.replace(/^Bearer\s+/i, '')
    if (token !== expectedSecret) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse body
    let body: {
        email?: string
        password?: string
        tenantSlug?: string
        tenantName?: string
        seedDashboardFixture?: boolean
    }
    try {
        body = await req.json()
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const { email, password } = body
    if (!email || !password) {
        return NextResponse.json(
            { error: 'email and password are required' },
            { status: 400 },
        )
    }

    if (password.length < 8) {
        return NextResponse.json(
            { error: 'password must be at least 8 characters' },
            { status: 400 },
        )
    }

    const requestedTenantSlug = body.tenantSlug?.trim().toLowerCase()
    if (requestedTenantSlug && !/^e2e-[a-z0-9-]{3,58}$/.test(requestedTenantSlug)) {
        return NextResponse.json(
            { error: 'tenantSlug must start with e2e- and contain only lowercase letters, numbers, or hyphens' },
            { status: 400 },
        )
    }
    const tenantSlug = requestedTenantSlug || E2E_TENANT_SLUG
    const tenantName = body.tenantName?.trim().slice(0, 100) || E2E_TENANT_NAME

    try {
        const payload = await getPayload({ config })

        // Step 1: find or create E2E tenant
        const tenantsResult = await payload.find({
            collection: 'tenants',
            where: { slug: { equals: tenantSlug } },
            limit: 1,
            overrideAccess: true,
        })

        let tenant: DashboardFixtureTenant
        if (tenantsResult.docs.length > 0) {
            tenant = tenantsResult.docs[0]
        } else {
            tenant = await payload.create({
                collection: 'tenants',
                overrideAccess: true,
                data: {
                    name: tenantName,
                    slug: tenantSlug,
                    plan: 'free',
                    onboardingCompleted: true,
                },
            })
        }
        const tenantId = tenant.id

        // Step 2: ensure the isolated benchmark tenant can pass the same
        // subscription gate as a tenant provisioned through the SSO flow.
        const subscriptionsResult = await payload.find({
            collection: 'plan-subscriptions',
            where: { and: [{ tenant: { equals: tenantId } }, { name: { equals: 'main' } }] },
            limit: 1,
            sort: '-createdAt',
            overrideAccess: true,
        })
        const subscriptionData = {
            plan: 'FREEMIUM' as const,
            status: 'active' as const,
            startsAt: new Date().toISOString(),
            endsAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
            canceledAt: null,
            canceledImmediately: false,
            packCode: 'FREEMIUM',
        }
        if (subscriptionsResult.docs.length > 0) {
            await payload.update({
                collection: 'plan-subscriptions',
                id: subscriptionsResult.docs[0].id,
                overrideAccess: true,
                data: subscriptionData,
            })
        } else {
            await payload.create({
                collection: 'plan-subscriptions',
                overrideAccess: true,
                data: {
                    tenant: tenantId,
                    name: 'main',
                    ...subscriptionData,
                },
            })
        }

        const dashboardFixture = body.seedDashboardFixture === true
            ? await ensureDashboardFixture(payload, tenant)
            : undefined

        // Step 3: find or create user
        const usersResult = await payload.find({
            collection: 'users',
            where: { email: { equals: email } },
            limit: 1,
            overrideAccess: true,
        })

        if (usersResult.docs.length > 0) {
            // User exists — sync password and ensure tenant association
            const existingUser = usersResult.docs[0]
            const existingTenantLink = (existingUser.tenants || []).find((t: { tenant: unknown }) => {
                const tid = typeof t.tenant === 'object' && t.tenant !== null
                    ? (t.tenant as { id: string | number }).id
                    : t.tenant
                return tid === tenantId
            })

            const tenantsUpdate = existingTenantLink
                ? existingUser.tenants // keep as-is
                : [
                    ...(existingUser.tenants || []),
                    { tenant: tenantId, role: 'owner' as const, status: 'active' as const, permissions: [] },
                ]

            await payload.update({
                collection: 'users',
                id: existingUser.id,
                overrideAccess: true,
                data: {
                    password,
                    tenants: tenantsUpdate,
                    roles: existingUser.roles?.includes('tenant-owner')
                        ? existingUser.roles
                        : [...(existingUser.roles || []), 'tenant-owner'],
                },
            })

            return NextResponse.json({
                status: 'updated',
                setupCapability: E2E_SETUP_CAPABILITY,
                userId: existingUser.id,
                tenantId,
                action: 'password synced + tenant ensured',
                ...(dashboardFixture ? { dashboardFixture } : {}),
            })
        }

        // Create new user
        const newUser = await payload.create({
            collection: 'users',
            overrideAccess: true,
            data: {
                email,
                password,
                firstName: 'E2E',
                lastName: 'Bot',
                roles: ['tenant-owner'],
                tenants: [
                    {
                        tenant: tenantId,
                        role: 'owner',
                        status: 'active',
                        permissions: [],
                    },
                ],
            },
        })

        return NextResponse.json({
            status: 'created',
            setupCapability: E2E_SETUP_CAPABILITY,
            userId: newUser.id,
            tenantId,
            ...(dashboardFixture ? { dashboardFixture } : {}),
        })
    } catch (error: unknown) {
        console.error('[E2E Setup] Error:', error)
        const message = error instanceof Error ? error.message : 'Unknown error'
        return NextResponse.json({ error: message }, { status: 500 })
    }
}
