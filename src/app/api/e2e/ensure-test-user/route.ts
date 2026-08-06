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
 * - Ensures the tenant has the Site prerequisite required by product/category flows
 *
 * Guarded by E2E_SETUP_SECRET env var. Disabled if secret not set.
 * NEVER enable this in production — staging only.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import {
    DASHBOARD_FIXTURE_CAPABILITY,
    ensureDashboardFixture,
    type DashboardFixtureTenant,
} from '@/lib/e2e/dashboard-fixture'
import { normalizeTenants, type TenantMembership } from '@/lib/normalize-tenants'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const E2E_TENANT_NAME = 'E2E Test Workspace'
const E2E_TENANT_SLUG = 'e2e-test'
const E2E_PRODUCT_CATEGORY_NAME = 'E2E AI Products'
const E2E_PRODUCT_CATEGORY_SLUG = 'e2e-ai-products'
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
    const rawBody = body as Record<string, unknown>
    if (
        'tenantId' in rawBody
        || 'categoryId' in rawBody
        || 'categoryName' in rawBody
        || 'categorySlug' in rawBody
    ) {
        return NextResponse.json(
            { error: 'tenant/category IDs and category overrides are not accepted' },
            { status: 400 },
        )
    }
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

        // Step 3: ensure the tenant has the Site prerequisite used by product/category E2E.
        // Keep this in the guarded setup endpoint: a fresh tenant cannot create its first
        // category through the dashboard because Categories.site is required.
        const sitesResult = await payload.find({
            collection: 'sites',
            where: { tenant: { equals: tenantId } },
            limit: 1,
            overrideAccess: true,
        })
        const site = sitesResult.docs[0] ?? await payload.create({
            collection: 'sites',
            overrideAccess: true,
            data: {
                tenant: tenantId,
                name: `${tenantName} Site`,
                status: 'draft',
                siteType: 'ecommerce',
            },
        })

        // Step 4: ensure the deterministic active category used by Product persistence E2E.
        // Soft-deleted history is excluded because the per-tenant slug index is unique only for
        // active rows. A concurrent setup winner is recovered by re-reading that active row.
        const findActiveProductCategory = () => payload.find({
            collection: 'categories',
            where: {
                and: [
                    { tenant: { equals: tenantId } },
                    { slug: { equals: E2E_PRODUCT_CATEGORY_SLUG } },
                    { deletedAt: { exists: false } },
                ],
            },
            limit: 1,
            sort: '-createdAt',
            overrideAccess: true,
        })
        let category = (await findActiveProductCategory()).docs[0]
        if (category) {
            category = await payload.update({
                collection: 'categories',
                id: category.id,
                overrideAccess: true,
                data: {
                    tenant: tenantId,
                    site: site.id,
                    name: E2E_PRODUCT_CATEGORY_NAME,
                    slug: E2E_PRODUCT_CATEGORY_SLUG,
                },
            })
        } else {
            try {
                category = await payload.create({
                    collection: 'categories',
                    overrideAccess: true,
                    data: {
                        tenant: tenantId,
                        site: site.id,
                        name: E2E_PRODUCT_CATEGORY_NAME,
                        slug: E2E_PRODUCT_CATEGORY_SLUG,
                    },
                })
            } catch (createError) {
                category = (await findActiveProductCategory()).docs[0]
                if (!category) throw createError
            }
        }

        // Step 5: optionally seed dashboard fixtures
        const dashboardFixture = body.seedDashboardFixture === true
            ? await ensureDashboardFixture(payload, tenant)
            : undefined

        // Step 6: find or create user
        const usersResult = await payload.find({
            collection: 'users',
            where: { email: { equals: email } },
            limit: 1,
            overrideAccess: true,
        })

        if (usersResult.docs.length > 0) {
            // User exists — sync password and make the provisioned fixture tenant primary.
            // Dashboard Product actions resolve tenant context from `user.tenants[0]`, so merely
            // appending this link can provision the category in a tenant the E2E session never uses.
            const existingUser = usersResult.docs[0]
            const existingTenantLinks = (existingUser.tenants || []) as TenantMembership[]
            const tenantLinkId = (link: (typeof existingTenantLinks)[number]) => (
                typeof link.tenant === 'object' && link.tenant !== null
                    ? link.tenant.id
                    : link.tenant
            )
            const existingTenantLink = existingTenantLinks.find(link => (
                String(tenantLinkId(link)) === String(tenantId)
            ))
            const primaryTenantLink = {
                ...(existingTenantLink ?? {}),
                tenant: tenantId,
                role: 'owner' as const,
                status: 'active' as const,
                permissions: existingTenantLink?.permissions ?? [],
            }
            const tenantsUpdate = normalizeTenants([
                primaryTenantLink,
                ...existingTenantLinks.filter(link => String(tenantLinkId(link)) !== String(tenantId)),
            ])

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
                setupCapability: DASHBOARD_FIXTURE_CAPABILITY,
                userId: existingUser.id,
                tenantId,
                siteId: site.id,
                categoryId: category.id,
                categoryName: E2E_PRODUCT_CATEGORY_NAME,
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
            setupCapability: DASHBOARD_FIXTURE_CAPABILITY,
            userId: newUser.id,
            tenantId,
            siteId: site.id,
            categoryId: category.id,
            categoryName: E2E_PRODUCT_CATEGORY_NAME,
            ...(dashboardFixture ? { dashboardFixture } : {}),
        })
    } catch (error: unknown) {
        console.error('[E2E Setup] Error:', error)
        const message = error instanceof Error ? error.message : 'Unknown error'
        return NextResponse.json({ error: message }, { status: 500 })
    }
}
