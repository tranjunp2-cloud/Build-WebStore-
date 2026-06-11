/**
 * GET /api/v1/discounts/export
 *
 * Streams a CSV export of discounts for the authenticated user's tenant(s).
 * Columns (design §S1): Code,Type,Value,Status,Usage Limit,Usage Count,Started At,Expires At,Created At
 * Dates formatted `YYYY-MM-DD HH:MM:SS` in Asia/Kuala_Lumpur.
 * Hard cap: 10 000 rows → 413 with JSON hint if exceeded.
 * Security: no anonymous access, tenant-scoped, Cache-Control: private,no-store.
 */
import type { NextRequest } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { getCurrentUser } from '@/lib/auth'
import { sql } from 'drizzle-orm'

type AuthUserShape = {
    roles?: string[]
    tenants?: Array<{ tenant: string | number | { id: string | number } }>
}

type DrizzleQueryResult<T> = { rows: T[] }

const EXPORT_ROW_CAP = 10_000

function csvField(value: unknown): string {
    if (value == null) return ''
    let s = String(value)
    s = s.replace(/[\r\n]+/g, ' ')
    if (s.length > 0 && ['=', '+', '-', '@'].includes(s[0])) s = `'${s}`
    if (s.includes(',') || s.includes('"')) s = `"${s.replace(/"/g, '""')}"`
    return s
}

function toCsvLine(fields: unknown[]): string {
    return fields.map(csvField).join(',')
}

function sanitizeFilenameSegment(s: string): string {
    return s.replace(/[^A-Za-z0-9_-]/g, '-')
}

/** Format an instant as `YYYY-MM-DD HH:MM:SS` in Asia/Kuala_Lumpur (design §S1 / §4). */
function fmtKL(value: string | Date | null): string {
    if (!value) return ''
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Kuala_Lumpur',
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
    }).formatToParts(new Date(value))
    const g = (t: string) => parts.find((p) => p.type === t)?.value ?? ''
    return `${g('year')}-${g('month')}-${g('day')} ${g('hour')}:${g('minute')}:${g('second')}`
}

function resolveTenantIds(user: AuthUserShape, requestedTenantId: string | null) {
    const isSuperAdmin = user.roles?.includes('super-admin') ?? false
    const userTenantIds: number[] = (user.tenants ?? [])
        .map((t) => {
            const tenant = t.tenant
            if (typeof tenant === 'object' && tenant != null) return Number(tenant.id)
            return Number(tenant)
        })
        .filter((id) => Number.isFinite(id) && id > 0)

    if (isSuperAdmin) {
        if (requestedTenantId) {
            if (!/^\d+$/.test(requestedTenantId)) return { tenantIds: [-1], tenantLabel: '', isSuperAdmin: true }
            const id = parseInt(requestedTenantId, 10)
            return { tenantIds: [id], tenantLabel: String(id), isSuperAdmin: true }
        }
        return { tenantIds: [], tenantLabel: 'all', isSuperAdmin: true }
    }

    return {
        tenantIds: userTenantIds,
        tenantLabel: userTenantIds[0] != null ? String(userTenantIds[0]) : 'unknown',
        isSuperAdmin: false,
    }
}

export async function GET(req: NextRequest) {
    const user = await getCurrentUser(req)
    if (!user) {
        return new Response('Unauthorized', { status: 401, headers: { 'Cache-Control': 'private, no-store' } })
    }

    const requestedTenantId = req.nextUrl.searchParams.get('tenantId')
    const { tenantIds, tenantLabel, isSuperAdmin } = resolveTenantIds(user as AuthUserShape, requestedTenantId)

    if (isSuperAdmin && tenantIds.length === 1 && tenantIds[0] === -1) {
        return new Response('Bad Request: tenantId must be a positive integer', {
            status: 400,
            headers: { 'Cache-Control': 'private, no-store' },
        })
    }

    if (!isSuperAdmin && tenantIds.length === 0) {
        return new Response('Forbidden', { status: 403, headers: { 'Cache-Control': 'private, no-store' } })
    }

    try {
        const payload = await getPayload({ config })
        const db = payload.db as {
            drizzle: { execute: (q: unknown) => Promise<DrizzleQueryResult<unknown>> }
        }

        // Bind tenant ids as a Postgres array LITERAL string ('{46,47}'), not a raw JS array — the
        // driver serializes a JS array param to a bare scalar, producing `ANY('46'::integer[])` →
        // "malformed array literal". ids are validated integers (resolveTenantIds), so the join is safe.
        const tenantArray = `{${tenantIds.join(',')}}`

        const countQuery = tenantIds.length > 0
            ? sql`SELECT COUNT(*) AS cnt FROM discounts WHERE tenant_id = ANY(${tenantArray}::integer[])`
            : sql`SELECT COUNT(*) AS cnt FROM discounts`

        const countResult = (await db.drizzle.execute(countQuery)) as DrizzleQueryResult<{ cnt: string | number }>
        const total = Number(countResult.rows[0]?.cnt ?? 0)

        if (total > EXPORT_ROW_CAP) {
            return Response.json(
                { error: 'export_too_large', hint: 'Export limited to 10,000 rows. Please apply a date filter first.' },
                { status: 413, headers: { 'Cache-Control': 'private, no-store' } },
            )
        }

        const today = new Date()
        const dateSuffix = [
            today.getFullYear(),
            String(today.getMonth() + 1).padStart(2, '0'),
            String(today.getDate()).padStart(2, '0'),
        ].join('')
        const filename = `discounts-${sanitizeFilenameSegment(tenantLabel)}-${dateSuffix}.csv`

        const stream = new ReadableStream({
            async start(controller) {
                const enc = new TextEncoder()
                controller.enqueue(enc.encode('Code,Type,Value,Status,Usage Limit,Usage Count,Started At,Expires At,Created At\n'))

                try {
                    const dataQuery = tenantIds.length > 0
                        ? sql`
                            SELECT code, type, value, status, usage_count, usage_limit,
                                   starts_at, expires_at, created_at
                            FROM discounts
                            WHERE tenant_id = ANY(${tenantArray}::integer[])
                            ORDER BY created_at DESC
                        `
                        : sql`
                            SELECT code, type, value, status, usage_count, usage_limit,
                                   starts_at, expires_at, created_at
                            FROM discounts
                            ORDER BY created_at DESC
                        `

                    const dataResult = (await db.drizzle.execute(dataQuery)) as DrizzleQueryResult<{
                        code: string
                        type: string
                        value: string | number
                        status: string
                        usage_count: string | number
                        usage_limit: string | number | null
                        starts_at: string | Date | null
                        expires_at: string | Date | null
                        created_at: string | Date
                    }>

                    for (const row of dataResult.rows) {
                        const line = toCsvLine([
                            row.code,
                            row.type,
                            // Value: percentage → raw percent (50); fixed → RM (sen/100, 2dp) to match the UI table.
                            row.type === 'fixed' ? (Number(row.value) / 100).toFixed(2) : Number(row.value),
                            row.status,
                            row.usage_limit != null ? Number(row.usage_limit) : '',
                            Number(row.usage_count),
                            fmtKL(row.starts_at),
                            fmtKL(row.expires_at),
                            fmtKL(row.created_at),
                        ])
                        controller.enqueue(enc.encode(line + '\n'))
                    }

                    controller.close()
                } catch (streamErr) {
                    console.error('[GET /api/v1/discounts/export] stream error', streamErr)
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
        console.error('[GET /api/v1/discounts/export] error', err)
        return new Response('Internal server error', { status: 500, headers: { 'Cache-Control': 'private, no-store' } })
    }
}
