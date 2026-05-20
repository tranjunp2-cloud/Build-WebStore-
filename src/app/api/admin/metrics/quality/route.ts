/**
 * GET /api/admin/metrics/quality
 * Combines all 5 quality aggregations + fail-reason breakdown.
 * Query params: from (ISO date), to (ISO date)
 * Defaults: last 30 days.
 * Super-admin guarded. Cached at edge for 5 min (revalidate via ?_=ts).
 */
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { withSuperAdmin } from '@/lib/admin/api-utils'
import {
  getAvgQualityScore,
  getGenSuccessRate,
  getCostPerGen,
  getWorstBlocks,
  getCategoryBlockHeatmap,
} from '@/lib/admin/quality-metrics'
import { categorizeFailures } from '@/lib/admin/fail-reason-categorizer'
import { getPayload } from 'payload'
import config from '@payload-config'
import { sql } from 'drizzle-orm'

// ── Date range helpers ────────────────────────────────────────────────────────

function parseRange(sp: URLSearchParams): { from: Date; to: Date } {
  const toRaw = sp.get('to')
  const fromRaw = sp.get('from')
  const to = toRaw ? new Date(toRaw) : new Date()
  const from = fromRaw ? new Date(fromRaw) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  return { from, to }
}

// ── Handler ───────────────────────────────────────────────────────────────────

export const GET = withSuperAdmin(async (req: NextRequest) => {
  const range = parseRange(req.nextUrl.searchParams)

  // Fetch failed error logs for fail-reason breakdown (max 500 rows — aggregate only)
  const failLogsPromise = (async () => {
    try {
      const payload = await getPayload({ config })
      const rows = await (payload.db.drizzle.execute(sql`
        SELECT error_log AS "errorLog"
        FROM ai_generation_records
        WHERE status = 'failed'
          AND created_at >= ${range.from.toISOString()}
          AND created_at <= ${range.to.toISOString()}
          AND error_log IS NOT NULL
        LIMIT 500
      `) as Promise<{ rows: Array<{ errorLog: string | null }> }>)
      return rows.rows
    } catch {
      return []
    }
  })()

  const [quality, genRate, cost, worstBlocks, heatmap, failLogs] = await Promise.all([
    getAvgQualityScore(range).catch(() => null),
    getGenSuccessRate(range).catch(() => null),
    getCostPerGen(range).catch(() => null),
    getWorstBlocks(range, 10).catch(() => []),
    getCategoryBlockHeatmap(range).catch(() => ({ categories: [], blocks: [], matrix: [] })),
    failLogsPromise,
  ])

  const failBreakdown = categorizeFailures(failLogs)

  return NextResponse.json(
    {
      data: {
        quality,
        genRate,
        cost,
        worstBlocks,
        heatmap,
        failBreakdown,
        range: {
          from: range.from.toISOString(),
          to: range.to.toISOString(),
        },
      },
      meta: { cachedAt: new Date().toISOString() },
      error: null,
    },
    {
      headers: {
        'Cache-Control': 'private, max-age=300, stale-while-revalidate=60',
      },
    },
  )
})
