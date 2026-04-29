import { NextResponse } from 'next/server'
import { getPayload, type Where } from 'payload'
import { sql } from 'drizzle-orm'
import config from '@payload-config'
import { assertStaging } from '@/lib/env'
import { getCurrentUser } from '@/lib/auth'

type CollectionSlug = 'analytics' | 'orders' | 'subscriptions' | 'products' | 'sites'

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
 * Staging-only endpoint. Resets user account to "new user" state:
 * - Deletes all data (sites, pages, products, orders, analytics, subscriptions)
 * - KEEPS tenant (reset counters only) — same as `pnpm db:reset`
 * - Resets user flags (has_seen_ai_wizard, otp)
 * - User redirects to /onboarding after reset
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

        // Auth check
        const user = await getCurrentUser()

        if (!user) {
            return NextResponse.json(
                { success: false, error: { code: 'AUTH_REQUIRED', message: 'Login required' } },
                { status: 401 },
            )
        }

        const userWithTenants = user as unknown as {
            id: string | number
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
                // Use direct SQL to avoid payload.find() which generates aggregate query
                // expecting a "data" column that doesn't exist in pages_blocks_* tables
                const db = payload.db.drizzle
                const pageRows = await db.execute(sql`
                    SELECT id FROM pages WHERE site_id = ${site.id}
                `) as { rows: Array<{ id: number }> }
                for (const row of pageRows.rows) {
                    await payload.delete({ collection: 'pages', id: row.id })
                }
                results.pages = (results.pages || 0) + pageRows.rows.length
            }

            // Step 6: Sites
            results.sites = (results.sites || 0) + await clearCollection(
                payload, 'sites', { tenant: { equals: tenantId } },
            )

            // Step 7: Reset tenant counters (KEEP tenant, don't delete)
            await payload.update({
                collection: 'tenants',
                id: tenantId,
                data: {
                    onboardingCompleted: false,
                    settings: { storageUsed: 0 },
                } as Record<string, unknown>,
            })
        }

        // Step 8: Reset user flags (same as pnpm db:reset)
        await payload.update({
            collection: 'users',
            id: userWithTenants.id,
            data: {
                has_seen_ai_wizard: false,
                otpHash: null,
                otpExpiresAt: null,
                otpAttempts: 0,
            } as Record<string, unknown>,
        })

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
