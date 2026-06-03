/**
 * GET /api/v1/discounts/export
 *
 * Streams a CSV export of discounts for the authenticated user's tenant(s).
 * Columns: code,type,value,status,usageCount,usageLimit,startsAt,expiresAt,createdAt
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

        const countQuery = tenantIds.length > 0
            ? sql`SELECT COUNT(*) AS cnt FROM discounts WHERE tenant_id = ANY(${tenantIds}::integer[])`
            : sql`SELECT COUNT(*) AS cnt FROM discounts`

        const countResult = (await db.drizzle.execute(countQuery)) as DrizzleQueryResult<{ cnt: string | number }>
        const total = Number(countResult.rows[0]?.cnt ?? 0)

        if (total > EXPORT_ROW_CAP) {
            return Response.json(
                { error: 'export_too_large', hint: 'Filter by status or date' },
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
                controller.enqueue(enc.encode('code,type,value,status,usageCount,usageLimit,startsAt,expiresAt,createdAt\n'))

                try {
                    const dataQuery = tenantIds.length > 0
                        ? sql`
                            SELECT code, type, value, status, usage_count, usage_limit,
                                   starts_at, expires_at, created_at
                            FROM discounts
                            WHERE tenant_id = ANY(${tenantIds}::integer[])
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
                            Number(row.value),
                            row.status,
                            Number(row.usage_count),
                            row.usage_limit != null ? Number(row.usage_limit) : '',
                            row.starts_at ? new Date(row.starts_at as string).toISOString() : '',
                            row.expires_at ? new Date(row.expires_at as string).toISOString() : '',
                            new Date(row.created_at as string).toISOString(),
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
