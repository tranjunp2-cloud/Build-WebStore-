import { NextResponse } from 'next/server'
import { getPayload, type Where } from 'payload'
import config from '@payload-config'
import { assertStaging } from '@/lib/env'
import { getCurrentUser } from '@/lib/auth'

type CollectionSlug = 'analytics' | 'orders' | 'subscriptions' | 'products' | 'pages' | 'sites' | 'tenants' | 'users'

interface ClearResult {
    [collection: string]: number
}

/**
 * Delete all docs in a collection matching a where clause.
 * Payload has no deleteMany — find then delete one by one.
 */
async function clearCollection(
    payload: Awaited<ReturnType<typeof getPayload>>,
    collection: CollectionSlug,
    where: Where,
): Promise<number> {
    const { docs } = await payload.find({
        collection,
        where,
        limit: 0,
        depth: 0,
    })

    for (const doc of docs) {
        await payload.delete({
            collection,
            id: doc.id,
        })
    }

    return docs.length
}

/**
 * POST /api/account/reset
 *
 * Staging-only endpoint. Cascade-deletes all tenant data and tenant records
 * for the current user. User account (email, password) is preserved.
 * User is expected to redirect to /onboarding after reset.
 */
export async function POST() {
    try {
        // Double guard: server-side staging check
        assertStaging()
    } catch {
        return NextResponse.json(
            { success: false, error: { code: 'FORBIDDEN', message: 'Reset only available in staging' } },
            { status: 403 },
        )
    }

    try {
        const payload = await getPayload({ config })

        // Auth check — reuse proven getCurrentUser()
        const user = await getCurrentUser()

        if (!user) {
            return NextResponse.json(
                { success: false, error: { code: 'AUTH_REQUIRED', message: 'Login required' } },
                { status: 401 },
            )
        }

        const userWithTenants = user as unknown as {
            id: string
            tenants?: Array<{ tenant: string | { id: string } }>
        }

        const tenantIds = (userWithTenants.tenants || []).map((t) =>
            typeof t.tenant === 'object' ? t.tenant.id : t.tenant,
        )

        if (tenantIds.length === 0) {
            return NextResponse.json({
                success: true,
                data: { resetAt: new Date().toISOString(), tenantsReset: [], collectionsCleared: {} },
            })
        }

        console.log(`[Account Reset] User ${userWithTenants.id} resetting ${tenantIds.length} tenant(s)`)

        const results: ClearResult = {}

        for (const tenantId of tenantIds) {
            // Step 1: Analytics
            results.analytics = (results.analytics || 0) + await clearCollection(
                payload, 'analytics', { tenant: { equals: tenantId } },
            )

            // Step 2: Orders
            results.orders = (results.orders || 0) + await clearCollection(
                payload, 'orders', { tenant: { equals: tenantId } },
            )

            // Step 3: Subscriptions
            results.subscriptions = (results.subscriptions || 0) + await clearCollection(
                payload, 'subscriptions', { tenant: { equals: tenantId } },
            )

            // Step 4: Products
            results.products = (results.products || 0) + await clearCollection(
                payload, 'products', { tenant: { equals: tenantId } },
            )

            // Step 5: Pages (linked via site, not tenant directly)
            const { docs: sites } = await payload.find({
                collection: 'sites',
                where: { tenant: { equals: tenantId } },
                limit: 0,
                depth: 0,
            })
            for (const site of sites) {
                results.pages = (results.pages || 0) + await clearCollection(
                    payload, 'pages', { site: { equals: site.id } },
                )
            }

            // Step 6: Sites
            results.sites = (results.sites || 0) + await clearCollection(
                payload, 'sites', { tenant: { equals: tenantId } },
            )
        }

        // Step 7: Clear user.tenants array BEFORE deleting tenant records
        // (users_tenants.tenant_id has NOT NULL constraint — must detach first)
        await payload.update({
            collection: 'users',
            id: userWithTenants.id,
            data: { tenants: [] } as Record<string, unknown>,
        })

        // Step 8: Delete tenant records (now safe — no FK reference from users_tenants)
        for (const tenantId of tenantIds) {
            await payload.delete({ collection: 'tenants', id: tenantId })
            results.tenants = (results.tenants || 0) + 1
        }

        console.log(`[Account Reset] Complete for user ${userWithTenants.id}:`, results)

        return NextResponse.json({
            success: true,
            data: {
                resetAt: new Date().toISOString(),
                tenantsReset: tenantIds,
                collectionsCleared: results,
            },
        })
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error'
        console.error('[Account Reset Error]', error)
        return NextResponse.json(
            { success: false, error: { code: 'INTERNAL_ERROR', message } },
            { status: 500 },
        )
    }
}
