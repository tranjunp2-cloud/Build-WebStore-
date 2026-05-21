/**
 * GET /api/v1/customers/export
 *
 * Streams a CSV export of customers for the authenticated user's tenant(s).
 *
 * Auth: Payload session cookie (payload-token) or Bearer JWT header.
 * Tenant scoping:
 *   - Tenant-owner: scoped to their own tenants[], ?tenantId param ignored.
 *   - Super-admin: may pass ?tenantId=<id> to restrict to one tenant; omitting it
 *     exports ALL tenants (admin-only scenario).
 *
 * Response: text/csv stream, Content-Disposition: attachment.
 * Hard cap: 10 000 rows → 413 with JSON hint if exceeded.
 *
 * CSV columns: email,name,phone,rank,createdAt,addressCount,orderCount
 *
 * Security:
 *   - No anonymous access (401 if unauthenticated).
 *   - Tenant restriction enforced server-side — ?tenantId only honoured for super-admin.
 *   - ?tenantId validated as positive integer before use (no sql.raw of user input).
 *   - Cache-Control: private, no-store (PII data).
 *   - Formula-injection guard: cells starting with = + - @ are prefixed with '.
 */
import type { NextRequest } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { getCurrentUser } from '@/lib/auth'
import { sql } from 'drizzle-orm'

// Structural type matching what resolveTenantIds reads from a user record —
// matches getCurrentUser's inferred return without forcing a Payload `User` cast.
type AuthUserShape = {
    roles?: string[]
    tenants?: Array<{ tenant: string | number | { id: string | number } }>
}

const EXPORT_ROW_CAP = 10_000

// ── CSV helpers ──────────────────────────────────────────────────────────────

/** Escape a single CSV field value. */
function csvField(value: unknown): string {
    if (value == null) return ''
    let s = String(value)

    // Formula-injection guard (spreadsheet formula prefix attack)
    if (s.length > 0 && ['=', '+', '-', '@'].includes(s[0])) {
        s = `'${s}`
    }

    // Wrap in double-quotes if the field contains comma, double-quote, or newline
    if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
        s = `"${s.replace(/"/g, '""')}"`
    }

    return s
}

/** Build one CSV line (no trailing newline — caller appends \n). */
function toCsvLine(fields: unknown[]): string {
    return fields.map(csvField).join(',')
}

/** Sanitize a string for use in Content-Disposition filename. */
function sanitizeFilenameSegment(s: string): string {
    return s.replace(/[^A-Za-z0-9_-]/g, '-')
}

// ── Tenant resolution ────────────────────────────────────────────────────────

interface TenantResolutionResult {
    tenantIds: number[]
    /** String used for filename, e.g. "all" or a single tenant ID */
    tenantLabel: string
    isSuperAdmin: boolean
}

function resolveTenantIds(
    user: AuthUserShape,
    requestedTenantId: string | null,
): TenantResolutionResult {
    const isSuperAdmin = user.roles?.includes('super-admin') ?? false

    // Extract tenant IDs from user.tenants[] as integers (schema: tenant_id integer)
    const userTenantIds: number[] = (user.tenants ?? []).map((t) => {
        const tenant = t.tenant
        if (typeof tenant === 'object' && tenant != null) return Number(tenant.id)
        return Number(tenant)
    }).filter((id) => Number.isFinite(id) && id > 0)

    if (isSuperAdmin) {
        if (requestedTenantId) {
            // Validate: must be a positive integer string
            if (!/^\d+$/.test(requestedTenantId)) {
                // Return sentinel — caller will 400
                return { tenantIds: [-1], tenantLabel: '', isSuperAdmin: true }
            }
            const id = parseInt(requestedTenantId, 10)
            return { tenantIds: [id], tenantLabel: String(id), isSuperAdmin: true }
        }
        // Super-admin without filter — export all (empty array signals no WHERE clause)
        return { tenantIds: [], tenantLabel: 'all', isSuperAdmin: true }
    }

    // Tenant-owner: always scoped to their own tenants, ignore ?tenantId param
    return {
        tenantIds: userTenantIds,
        tenantLabel: userTenantIds[0] != null ? String(userTenantIds[0]) : 'unknown',
        isSuperAdmin: false,
    }
}

// ── Drizzle result shape (matches pg QueryResult) ────────────────────────────
type DrizzleQueryResult<T> = { rows: T[] }

// ── Route handler ─────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
    // 1. Auth
    const user = await getCurrentUser(req)
    if (!user) {
        return new Response('Unauthorized', {
            status: 401,
            headers: { 'Cache-Control': 'private, no-store' },
        })
    }

    // 2. Tenant scoping
    const requestedTenantId = req.nextUrl.searchParams.get('tenantId')
    const { tenantIds, tenantLabel, isSuperAdmin } = resolveTenantIds(
        user as AuthUserShape,
        requestedTenantId,
    )

    // Super-admin with invalid ?tenantId → 400 (sentinel is -1)
    if (isSuperAdmin && tenantIds.length === 1 && tenantIds[0] === -1) {
        return new Response('Bad Request: tenantId must be a positive integer', {
            status: 400,
            headers: { 'Cache-Control': 'private, no-store' },
        })
    }

    // Tenant-owner with no tenants → 403
    if (!isSuperAdmin && tenantIds.length === 0) {
        return new Response('Forbidden', {
            status: 403,
            headers: { 'Cache-Control': 'private, no-store' },
        })
    }

    try {
        const payload = await getPayload({ config })
        const db = payload.db as {
            drizzle: { execute: (q: unknown) => Promise<DrizzleQueryResult<unknown>> }
        }

        // 3. Row count check (hard cap)
        // Use Drizzle template-literal parameterization — integers bound safely, no sql.raw
        const countQuery = tenantIds.length > 0
            ? sql`SELECT COUNT(*) AS cnt FROM customers WHERE tenant_id = ANY(${tenantIds}::integer[])`
            : sql`SELECT COUNT(*) AS cnt FROM customers`

        const countResult = (await db.drizzle.execute(countQuery)) as DrizzleQueryResult<{ cnt: string | number }>
        const total = Number(countResult.rows[0]?.cnt ?? 0)

        if (total > EXPORT_ROW_CAP) {
            return Response.json(
                { error: 'export_too_large', hint: 'Filter by date or rank' },
                {
                    status: 413,
                    headers: { 'Cache-Control': 'private, no-store' },
                },
            )
        }

        // 4. Build filename — sanitize tenantLabel to safe chars only
        const today = new Date()
        const dateSuffix = [
            today.getFullYear(),
            String(today.getMonth() + 1).padStart(2, '0'),
            String(today.getDate()).padStart(2, '0'),
        ].join('')
        const safeLabel = sanitizeFilenameSegment(tenantLabel)
        const filename = `customers-${safeLabel}-${dateSuffix}.csv`

        // 5. Stream CSV response
        const stream = new ReadableStream({
            async start(controller) {
                const enc = new TextEncoder()

                // Header row
                controller.enqueue(enc.encode('email,name,phone,rank,createdAt,addressCount,orderCount\n'))

                try {
                    // Data query — subqueries for counts keep memory flat.
                    // IDs are integers; no ::text casts, no sql.raw.
                    const dataQuery = tenantIds.length > 0
                        ? sql`
                            SELECT
                                c.email,
                                c.name,
                                c.phone,
                                c.rank,
                                c.created_at,
                                (SELECT COUNT(*) FROM customers_addresses WHERE _parent_id = c.id) AS addr_count,
                                (SELECT COUNT(*) FROM orders WHERE customer_id = c.id) AS order_count
                            FROM customers c
                            WHERE c.tenant_id = ANY(${tenantIds}::integer[])
                            ORDER BY c.created_at DESC
                        `
                        : sql`
                            SELECT
                                c.email,
                                c.name,
                                c.phone,
                                c.rank,
                                c.created_at,
                                (SELECT COUNT(*) FROM customers_addresses WHERE _parent_id = c.id) AS addr_count,
                                (SELECT COUNT(*) FROM orders WHERE customer_id = c.id) AS order_count
                            FROM customers c
                            ORDER BY c.created_at DESC
                        `

                    const dataResult = (await db.drizzle.execute(dataQuery)) as DrizzleQueryResult<{
                        email: string
                        name: string
                        phone: string | null
                        rank: string | null
                        created_at: string | Date
                        addr_count: string | number
                        order_count: string | number
                    }>

                    for (const row of dataResult.rows) {
                        const createdAt = row.created_at
                            ? new Date(row.created_at as string).toISOString()
                            : ''
                        const line = toCsvLine([
                            row.email,
                            row.name,
                            row.phone ?? '',
                            row.rank ?? '',
                            createdAt,
                            Number(row.addr_count),
                            Number(row.order_count),
                        ])
                        controller.enqueue(enc.encode(line + '\n'))
                    }

                    controller.close()
                } catch (streamErr) {
                    console.error('[GET /api/v1/customers/export] stream error', streamErr)
                    // Signal stream failure — client sees network error, not silent truncation
                    controller.error(streamErr)
                }
            },
        })

        return new Response(stream, {
            status: 200,
            headers: {
                'Content-Type': 'text/csv; charset=utf-8',
                'Cache-Control': 'private, no-store',
                'Content-Disposition': `attachment; filename="${filename}"`,
            },
        })
    } catch (err) {
        console.error('[GET /api/v1/customers/export] error', err)
        return new Response('Internal server error', {
            status: 500,
            headers: { 'Cache-Control': 'private, no-store' },
        })
    }
}
