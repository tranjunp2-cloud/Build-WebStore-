/**
 * GET /api/admin/blocks/[slug]/impact
 * Returns impact metrics for a block slug:
 *   - templates_affected: count of distinct templates using this block
 *   - generations_last_30d: count of ai_generation_records where output_snapshot contains slug
 * Rate-limited 10/min per IP (heavy JSON scan query).
 * Super-admin only, zod-validated slug.
 */
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { withSuperAdmin, checkRateLimit } from '@/lib/admin/api-utils'
import { getBlockBySlug } from '@/lib/admin/block-registry-reader'
import { getPayload } from 'payload'
import config from '@payload-config'
import { sql } from 'drizzle-orm'

export type BlockImpactResult = {
    blockSlug: string
    templatesAffected: number
    generationsLast30d: number
    warningHighImpact: boolean
}

const SlugSchema = z.string().min(1).max(100).regex(/^[a-z0-9-]+$/, 'Invalid block slug')

type CountRow = { count: string | number }

type RouteContext = { params: Promise<{ slug: string }> }

export const GET = async (req: NextRequest, ctx: RouteContext) => {
    return withSuperAdmin(async (req) => {
        // Rate limit: 10 requests/min per IP (impact query is heavy)
        const ip = req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? 'unknown'
        if (!checkRateLimit(`impact:${ip}`, 10)) {
            return NextResponse.json({ error: 'Rate limit exceeded — try again in a minute' }, { status: 429 })
        }

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

            const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

            // Count distinct templates using this block via template_pages.layout JSON scan
            // Uses ILIKE on text cast — acceptable at current scale (<500 templates).
            // A GIN index on layout would speed this up if needed (EXPLAIN ANALYZE first).
            const [tmplRows, genRows] = await Promise.all([
                db.execute(sql`
                    SELECT COUNT(DISTINCT tp._parent_id) AS count
                    FROM templates_template_pages tp
                    WHERE tp.layout::text ILIKE ${'%"blockType":"' + slug + '"%'}
                `) as Promise<{ rows: CountRow[] }>,

                db.execute(sql`
                    SELECT COUNT(*) AS count
                    FROM ai_generation_records
                    WHERE created_at >= ${thirtyDaysAgo}
                      AND output_snapshot::text ILIKE ${'%' + slug + '%'}
                `) as Promise<{ rows: CountRow[] }>,
            ])

            const templatesAffected = Number(tmplRows.rows[0]?.count ?? 0)
            const generationsLast30d = Number(genRows.rows[0]?.count ?? 0)

            return NextResponse.json({
                data: {
                    blockSlug: slug,
                    templatesAffected,
                    generationsLast30d,
                    warningHighImpact: templatesAffected > 10,
                } satisfies BlockImpactResult,
                meta: { computedAt: new Date().toISOString() },
                error: null,
            })
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Internal error'
            return NextResponse.json({ error: msg }, { status: 500 })
        }
    })(req)
}
