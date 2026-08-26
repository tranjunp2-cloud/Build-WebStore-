import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { sql } from 'drizzle-orm'
import { withAuth } from '@/lib/auth'
import { extractTenantId } from '@/lib/auth'
import { parseRequest } from '@/lib/validations/helpers'
import { createDiscountSchema } from '@/lib/validations/discounts'

const ALLOWED_SORT_FIELDS = new Set(['code', 'type', 'value', 'usageCount', 'expiresAt', 'createdAt', 'status'])

/**
 * GET /api/v1/discounts
 *
 * List discounts for the authenticated user's tenant.
 * Supports: ?status=active&type=fixed&search=CODE&sort=-createdAt&page=1&limit=20
 */
export const GET = withAuth(async (user, request) => {
    try {
        const payload = await getPayload({ config })
        const url = new URL(request.url)

        const status = url.searchParams.get('status')
        const type = url.searchParams.get('type')
        const search = url.searchParams.get('search')
        const rawSort = url.searchParams.get('sort') || '-createdAt'
        const sortField = rawSort.startsWith('-') ? rawSort.slice(1) : rawSort
        const sort = ALLOWED_SORT_FIELDS.has(sortField) ? rawSort : '-createdAt'
        const page = parseInt(url.searchParams.get('page') || '1') || 1
        const limit = Math.min(parseInt(url.searchParams.get('limit') || '20') || 20, 100)

        const where: any = {}

        // Effective status filter — badge shows 2 states (Active/Inactive) based on
        // effective lifecycle, not raw DB status. Used-up discounts keep DB status='active'
        // (Option B: capacity can reopen on slot release) but display as Inactive.
        // We resolve the filter→badge contradiction here by fetching at-limit IDs via
        // raw SQL and excluding/including them in the Payload query so totalDocs is exact.
        if (status === 'active') {
            // Active = DB active AND NOT at-limit (used-up displays as Inactive)
            where.status = { equals: 'active' }
            try {
                const db = payload.db as unknown as { drizzle: { execute: (q: unknown) => Promise<{ rows: Array<{ id: number }> }> } }
                const atLimitRes = await db.drizzle.execute(sql`
                    SELECT id FROM discounts
                    WHERE status = 'active'
                      AND usage_limit IS NOT NULL
                      AND usage_count >= usage_limit
                `)
                const atLimitIds = (atLimitRes.rows ?? []).map((r) => Number(r.id))
                if (atLimitIds.length > 0) where.id = { not_in: atLimitIds }
            } catch {
                // Fall back to plain status filter — better than a 500
            }
        } else if (status === 'inactive') {
            // Inactive = DB inactive OR at-limit (used-up, DB active but effectively Inactive)
            try {
                const db = payload.db as unknown as { drizzle: { execute: (q: unknown) => Promise<{ rows: Array<{ id: number }> }> } }
                const atLimitRes = await db.drizzle.execute(sql`
                    SELECT id FROM discounts
                    WHERE status = 'active'
                      AND usage_limit IS NOT NULL
                      AND usage_count >= usage_limit
                `)
                const atLimitIds = (atLimitRes.rows ?? []).map((r) => Number(r.id))
                if (atLimitIds.length > 0) {
                    where.or = [{ status: { equals: 'inactive' } }, { id: { in: atLimitIds } }]
                } else {
                    where.status = { equals: 'inactive' }
                }
            } catch {
                where.status = { equals: 'inactive' }
            }
        } else if (status && status !== 'all') {
            where.status = { equals: status }
        }

        if (type && type !== 'all') {
            where.type = { equals: type }
        }

        if (search) {
            where.or = [
                { code: { contains: search } },
                { description: { contains: search } },
            ]
        }

        const result = await payload.find({
            collection: 'discounts',
            where,
            sort,
            page,
            limit,
            depth: 0,
            user,
            overrideAccess: false,
        })

        return NextResponse.json({ ...result, success: true })
    } catch (error: any) {
        console.error('[Discounts List Error]', error)
        return NextResponse.json(
            { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to load discounts' } },
            { status: 500 },
        )
    }
})

/**
 * POST /api/v1/discounts
 *
 * Create a discount. Tenant is forced from the authenticated user — client cannot override.
 */
export const POST = withAuth(async (user, request) => {
    try {
        const { data, errorResponse } = await parseRequest(request, createDiscountSchema)
        if (errorResponse) return errorResponse

        const tenantId = extractTenantId(user)
        if (!tenantId) {
            return NextResponse.json(
                { success: false, error: { code: 'FORBIDDEN', message: 'No tenant associated with this user' } },
                { status: 403 },
            )
        }
        // Payload postgres adapter uses integer IDs — coerce string → number
        const tenantIdForPayload: string | number = /^\d+$/.test(tenantId) ? parseInt(tenantId, 10) : tenantId

        const payload = await getPayload({ config })

        let discount
        try {
            discount = await payload.create({
                collection: 'discounts',
                data: {
                    ...data!,
                    tenant: tenantIdForPayload,
                    usageCount: 0,
                },
                // overrideAccess: true — tenant is extracted from the authenticated user (not from the
                // client request), so collection-level auth is already enforced by withAuth + extractTenantId.
                // Using false here triggers Payload's relationship read-check against the tenants collection,
                // which has restricted read access and incorrectly rejects valid tenant IDs.
                overrideAccess: true,
            })
        } catch (err: any) {
            // Unique constraint on (tenant_id, upper(code)) → 409
            if (err?.message?.includes('duplicate') || err?.message?.includes('unique') || err?.code === '23505') {
                return NextResponse.json(
                    { success: false, error: { code: 'DUPLICATE_CODE', message: 'This code is already in use for your tenant. Try a different code or append a number.' } },
                    { status: 409 },
                )
            }
            throw err
        }

        return NextResponse.json({ success: true, data: discount }, { status: 201 })
    } catch (error: any) {
        console.error('[Discounts Create Error]', error)
        return NextResponse.json(
            { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create discount' } },
            { status: 500 },
        )
    }
})
