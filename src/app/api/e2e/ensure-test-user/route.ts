/**
 * E2E Test User Provisioning — idempotent endpoint for CI.
 *
 * POST /api/e2e/ensure-test-user
 *   headers: Authorization: Bearer {E2E_SETUP_SECRET}
 *   body: { email: string, password: string, tenantSlug?: `e2e-${string}`, tenantName?: string }
 *
 * Creates or syncs a dedicated E2E test user on staging.
 * - If user exists: updates password to match CI secret
 * - If not: creates with tenant-owner role + active E2E tenant
 *
 * Guarded by E2E_SETUP_SECRET env var. Disabled if secret not set.
 * NEVER enable this in production — staging only.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'

export const dynamic = 'force-dynamic'

const E2E_TENANT_NAME = 'E2E Test Workspace'
const E2E_TENANT_SLUG = 'e2e-test'

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
    let body: { email?: string; password?: string; tenantSlug?: string; tenantName?: string }
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

        // Step 2: find or create user
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
                userId: existingUser.id,
                tenantId,
                action: 'password synced + tenant ensured',
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
            userId: newUser.id,
            tenantId,
        })
    } catch (error: unknown) {
        console.error('[E2E Setup] Error:', error)
        const message = error instanceof Error ? error.message : 'Unknown error'
        return NextResponse.json({ error: message }, { status: 500 })
    }
}
