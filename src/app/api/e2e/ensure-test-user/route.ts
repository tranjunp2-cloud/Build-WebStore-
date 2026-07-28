/**
 * E2E Test User Provisioning — idempotent endpoint for CI.
 *
 * POST /api/e2e/ensure-test-user
 *   headers: Authorization: Bearer {E2E_SETUP_SECRET}
 *   body: {
 *     email: string,
 *     password: string,
 *     tenantSlug?: `e2e-${string}`,
 *     tenantName?: string,
 *     role?: 'owner' | 'staff'
 *   }
 *
 * Creates or syncs a dedicated E2E test user on staging.
 * - If user exists: updates password to match CI secret
 * - Owner is the default for backward compatibility
 * - Staff uses a deterministic alias of TEST_EMAIL with an active editor membership
 *
 * Guarded by E2E_SETUP_SECRET env var. Disabled if secret not set.
 * NEVER enable this in production — staging only.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { deriveE2EProfileStaffEmail } from '@/lib/otp/e2e-profile-bypass'

export const dynamic = 'force-dynamic'

const E2E_TENANT_NAME = 'E2E Test Workspace'
const E2E_TENANT_SLUG = 'e2e-test'
type E2EProfileRole = 'owner' | 'staff'

type TenantLink = {
    tenant: unknown
    role?: string
    status?: string
    permissions?: unknown[]
}

function getTenantId(link: TenantLink): unknown {
    return typeof link.tenant === 'object' && link.tenant !== null
        ? (link.tenant as { id?: unknown }).id
        : link.tenant
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
    let body: Record<string, unknown>
    try {
        const parsedBody: unknown = await req.json()
        if (
            typeof parsedBody !== 'object'
            || parsedBody === null
            || Array.isArray(parsedBody)
        ) {
            return NextResponse.json({ error: 'JSON body must be an object' }, { status: 400 })
        }
        body = parsedBody as Record<string, unknown>
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const requestedEmail = body.email
    const password = body.password
    if (
        typeof requestedEmail !== 'string'
        || typeof password !== 'string'
        || !requestedEmail.trim()
        || !password
    ) {
        return NextResponse.json(
            { error: 'email and password must be non-empty strings' },
            { status: 400 },
        )
    }

    if (password.length < 8 || password.length > 128) {
        return NextResponse.json(
            { error: 'password must be between 8 and 128 characters' },
            { status: 400 },
        )
    }

    const role = body.role ?? 'owner'
    if (role !== 'owner' && role !== 'staff') {
        return NextResponse.json(
            { error: 'role must be owner or staff' },
            { status: 400 },
        )
    }
    const profileRole: E2EProfileRole = role

    let email = requestedEmail.trim().toLowerCase()
    if (
        email.length > 254
        || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)
    ) {
        return NextResponse.json({ error: 'email must be valid' }, { status: 400 })
    }

    if (profileRole === 'staff') {
        try {
            email = deriveE2EProfileStaffEmail(email)
        } catch (error: unknown) {
            return NextResponse.json(
                { error: error instanceof Error ? error.message : 'Invalid email' },
                { status: 400 },
            )
        }
    }

    const membershipRole = profileRole === 'owner' ? 'owner' : 'editor'
    const platformRole = profileRole === 'owner' ? 'tenant-owner' : 'editor'

    if (body.tenantSlug !== undefined && typeof body.tenantSlug !== 'string') {
        return NextResponse.json({ error: 'tenantSlug must be a string' }, { status: 400 })
    }
    if (body.tenantName !== undefined && typeof body.tenantName !== 'string') {
        return NextResponse.json({ error: 'tenantName must be a string' }, { status: 400 })
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

        let tenantId: string | number
        if (tenantsResult.docs.length > 0) {
            tenantId = tenantsResult.docs[0].id
        } else {
            const newTenant = await payload.create({
                collection: 'tenants',
                overrideAccess: true,
                data: {
                    name: tenantName,
                    slug: tenantSlug,
                    plan: 'free',
                    onboardingCompleted: true,
                },
            })
            tenantId = newTenant.id
        }

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

        // Step 3: find or create user
        const usersResult = await payload.find({
            collection: 'users',
            where: { email: { equals: email } },
            limit: 1,
            overrideAccess: true,
        })

        if (usersResult.docs.length > 0) {
            // User exists — sync password and ensure deterministic role/tenant association.
            const existingUser = usersResult.docs[0]
            const existingTenants = (existingUser.tenants || []) as TenantLink[]
            const hasTenantLink = existingTenants.some((link) => getTenantId(link) === tenantId)
            const tenantsUpdate = hasTenantLink
                ? existingTenants.map((link) => (
                    getTenantId(link) === tenantId
                        ? { ...link, role: membershipRole, status: 'active', permissions: link.permissions ?? [] }
                        : link
                ))
                : [
                    ...existingTenants,
                    { tenant: tenantId, role: membershipRole, status: 'active', permissions: [] },
                ]

            await payload.update({
                collection: 'users',
                id: existingUser.id,
                overrideAccess: true,
                data: {
                    password,
                    tenants: tenantsUpdate,
                    roles: [platformRole],
                },
            })

            return NextResponse.json({
                status: 'updated',
                userId: existingUser.id,
                tenantId,
                email,
                role: profileRole,
                action: 'password + profile role + tenant synced',
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
                lastName: profileRole === 'owner' ? 'Owner' : 'Staff',
                roles: [platformRole],
                tenants: [
                    {
                        tenant: tenantId,
                        role: membershipRole,
                        status: 'active',
                        permissions: [],
                    },
                ],
            },
        })

        return NextResponse.json({
            status: 'created',
            userId: newUser.id,
            tenantId,
            email,
            role: profileRole,
        })
    } catch (error: unknown) {
        console.error('[E2E Setup] Error:', error)
        const message = error instanceof Error ? error.message : 'Unknown error'
        return NextResponse.json({ error: message }, { status: 500 })
    }
}
