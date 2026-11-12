import { NextResponse } from 'next/server'
import { getPayload, type User } from 'payload'
import config from '@payload-config'
import { sql } from 'drizzle-orm'
import { withAuth } from '@/lib/auth'
import { jsonWithEtag } from '@/lib/api/json-etag'
import { extractTenantId } from '@/lib/auth'
import { parseRequest } from '@/lib/validations/helpers'
import { createDiscountSchema } from '@/lib/validations/discounts'
import { createDiscountAs, DiscountServiceError, type DiscountWriteData } from '@/lib/discounts/discount-service'
import { canAccessArea } from '@/lib/insights/area-access'

type CreateBody = DiscountWriteData & { code: string; type: 'percentage' | 'fixed'; value: number }

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

        // At-limit ids of the caller's own workspaces only (the same tenants collection access lets them read; all
        // for a super-admin). This scanned every tenant's discounts and grew the not_in / in list with the whole
        // platform (TC-PERF-075).
        const atLimitIds = async (): Promise<number[]> => {
            const isSuperAdmin = Boolean((user as { roles?: string[] }).roles?.includes('super-admin'))
            const tenantIds = ((user as { tenants?: Array<{ tenant: unknown }> }).tenants ?? [])
                .map((t) => (t.tenant && typeof t.tenant === 'object' ? (t.tenant as { id?: unknown }).id : t.tenant))
                .map(Number)
                .filter((id) => Number.isSafeInteger(id))
            if (!isSuperAdmin && tenantIds.length === 0) return []
            const tenantFilter = isSuperAdmin
                ? sql``
                : sql` AND tenant_id IN (${sql.join(tenantIds.map((id) => sql`${id}`), sql`, `)})`
            const db = payload.db as unknown as { drizzle: { execute: (q: unknown) => Promise<{ rows: Array<{ id: number }> }> } }
            const res = await db.drizzle.execute(sql`
                SELECT id FROM discounts
                WHERE status = 'active'
                  AND usage_limit IS NOT NULL
                  AND usage_count >= usage_limit${tenantFilter}
            `)
            return (res.rows ?? []).map((r) => Number(r.id))
        }

        // Effective status filter — badge shows 2 states (Active/Inactive) based on
        // effective lifecycle, not raw DB status. Used-up discounts keep DB status='active'
        // (Option B: capacity can reopen on slot release) but display as Inactive.
        // We resolve the filter→badge contradiction here by fetching at-limit IDs via
        // raw SQL and excluding/including them in the Payload query so totalDocs is exact.
        const and: any[] = []
        if (status === 'active') {
            // Active = DB active AND NOT at-limit (used-up displays as Inactive)
            and.push({ status: { equals: 'active' } })
            try {
                const ids = await atLimitIds()
                if (ids.length > 0) and.push({ id: { not_in: ids } })
            } catch {
                // Fall back to plain status filter — better than a 500
            }
        } else if (status === 'inactive') {
            // Inactive = DB inactive OR at-limit (used-up, DB active but effectively Inactive)
            try {
                const ids = await atLimitIds()
                and.push(ids.length > 0
                    ? { or: [{ status: { equals: 'inactive' } }, { id: { in: ids } }] }
                    : { status: { equals: 'inactive' } })
            } catch {
                and.push({ status: { equals: 'inactive' } })
            }
        } else if (status && status !== 'all') {
            and.push({ status: { equals: status } })
        }

        if (type && type !== 'all') {
            and.push({ type: { equals: type } })
        }

        // its own `or`, next to the inactive one (it used to overwrite it, dropping the status filter)
        if (search) {
            and.push({
                or: [
                    { code: { contains: search } },
                    { description: { contains: search } },
                ],
            })
        }
        if (and.length > 0) where.and = and

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

        return jsonWithEtag({ ...result, success: true }, request)
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
        // Discounts belong to the Orders permission (the sidebar entry's `permissionId`): a custom role without it
        // (e.g. products only) can not create codes, same rule as the copilot's discount tools.
        if (!canAccessArea(user, tenantId, 'orders')) {
            return NextResponse.json(
                { success: false, error: { code: 'FORBIDDEN', message: 'Your role cannot manage discounts' } },
                { status: 403 },
            )
        }

        let discount
        try {
            // The tenant is the authenticated user's (never the client's): the shared service forces it, sets
            // usageCount to 0 and writes with overrideAccess (see lib/discounts/discount-service).
            // strictTenant: the create runs with access off, so a body site must be one of this tenant's — another
            // tenant's site id would scope the discount to that shop (TC-PERF-136).
            discount = await createDiscountAs(
                { user: user as unknown as User, tenantId, strictTenant: true },
                { ...(data as CreateBody), site: data!.site === '' ? null : (data!.site ?? null) },
            )
        } catch (err: any) {
            // Unique constraint on (tenant_id, upper(code)) → 409
            if (err instanceof DiscountServiceError && err.code === 'DUPLICATE_CODE') {
                return NextResponse.json(
                    { success: false, error: { code: 'DUPLICATE_CODE', message: err.message } },
                    { status: 409 },
                )
            }
            if (err instanceof DiscountServiceError && err.code === 'SITE_NOT_FOUND') {
                return NextResponse.json(
                    { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid site' } },
                    { status: 400 },
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
