/**
 * GET /api/admin/blocks/[slug]/history
 * Returns last ≤20 events related to this block slug:
 *   - Version saves where sectionsSnapshot JSON contains this block slug
 *   - Timeline only — no diffs (F07 scope)
 * Super-admin only, zod-validated slug.
 */
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { withSuperAdmin } from '@/lib/admin/api-utils'
import { getBlockBySlug } from '@/lib/admin/block-registry-reader'
import { getPayload } from 'payload'
import config from '@payload-config'
import { sql } from 'drizzle-orm'

export type BlockHistoryEvent = {
    id: string
    eventType: 'version_save'
    templateId: number | string
    templateName: string
    versionNumber: number
    changelog: string | null
    occurredAt: string
}

const SlugSchema = z.string().min(1).max(100).regex(/^[a-z0-9-]+$/, 'Invalid block slug')

// Row shape returned from drizzle
type VersionRow = {
    id: string | number
    template_id: string | number
    template_name: string | null
    version_number: string | number
    changelog: string | null
    created_at: string
}

type RouteContext = { params: Promise<{ slug: string }> }

export const GET = async (req: NextRequest, ctx: RouteContext) => {
    return withSuperAdmin(async () => {
        const rawSlug = (await ctx.params).slug
        const slugParsed = SlugSchema.safeParse(rawSlug)
        if (!slugParsed.success) {
            return NextResponse.json({ error: 'Invalid slug', details: slugParsed.error.flatten() }, { status: 400 })
        }
        const slug = slugParsed.data

        const block = getBlockBySlug(slug)
        if (!block) {
            return NextResponse.json({ error: 'Block not found' }, { status: 404 })
        }

        try {
            const payload = await getPayload({ config })
            const db = payload.db.drizzle

            // Scan template_versions.sections_snapshot JSONB for blockType = slug
            // JSONB @> operator checks if the snapshot array contains an object with blockType matching slug
            // sections_snapshot is an array of blocks; each element may have a blockType field.
            // We use the ?| text[] containment check via JSON text search for simplicity (heuristic, no index).
            const rows = await db.execute(sql`
                SELECT
                    tv.id,
                    tv.template_id,
                    t.name AS template_name,
                    tv.version_number,
                    tv.changelog,
                    tv.created_at
                FROM template_versions tv
                LEFT JOIN templates t ON t.id = tv.template_id
                WHERE tv.sections_snapshot::text ILIKE ${'%"blockType":"' + slug + '"%'}
                ORDER BY tv.created_at DESC
                LIMIT 20
            `) as { rows: VersionRow[] }

            const events: BlockHistoryEvent[] = rows.rows.map((r) => ({
                id: String(r.id),
                eventType: 'version_save',
                templateId: r.template_id,
                templateName: r.template_name ?? String(r.template_id),
                versionNumber: typeof r.version_number === 'number' ? r.version_number : parseInt(String(r.version_number), 10),
                changelog: r.changelog ?? null,
                occurredAt: String(r.created_at),
            }))

            return NextResponse.json({
                data: events,
                meta: {
                    total: events.length,
                    blockSlug: slug,
                    limit: 20,
                    note: events.length === 0
                        ? 'No version history found for this block yet'
                        : null,
                },
                error: null,
            })
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Internal error'
            return NextResponse.json({ error: msg }, { status: 500 })
        }
    })(req)
}
