/**
 * /studio/performance — AI Quality Dashboard server component.
 * Revalidates every 5 min. Cache-busted by ?_=timestamp from RefreshNowButton.
 * Accepts ?from=YYYY-MM-DD&to=YYYY-MM-DD (defaults: last 30d).
 */
export const revalidate = 300

import type { Metadata } from 'next'
import { requireSuperAdmin } from '@/lib/admin/auth-guard'
import {
  getAvgQualityScore,
  getGenSuccessRate,
  getCostPerGen,
  getWorstBlocks,
  getCategoryBlockHeatmap,
  getHighestOverrideCategories,
} from '@/lib/admin/quality-metrics'
import { categorizeFailures } from '@/lib/admin/fail-reason-categorizer'
import { QualityDashboardClient } from './_components/quality-dashboard-client'
import { getPayload } from 'payload'
import config from '@payload-config'
import { sql } from 'drizzle-orm'

export const metadata: Metadata = { title: 'AI Quality Dashboard' }

// ── Date helpers ──────────────────────────────────────────────────────────────

function parseRange(sp: Record<string, string | string[] | undefined>): { from: Date; to: Date } {
  const toRaw = typeof sp.to === 'string' ? sp.to : undefined
  const fromRaw = typeof sp.from === 'string' ? sp.from : undefined
  const to = toRaw ? new Date(toRaw) : new Date()
  const from = fromRaw
    ? new Date(fromRaw)
    : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  return { from, to }
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function PerformancePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  await requireSuperAdmin()

  const sp = await searchParams
  const range = parseRange(sp)

  // Fetch fail logs for categorizer (server-side, no client round-trip)
  const failLogsPromise = (async () => {
    try {
      const payload = await getPayload({ config })
      const result = await (payload.db.drizzle.execute(sql`
        SELECT error_log AS "errorLog"
        FROM ai_generation_records
        WHERE status = 'failed'
          AND created_at >= ${range.from.toISOString()}
          AND created_at <= ${range.to.toISOString()}
          AND error_log IS NOT NULL
        LIMIT 500
      `) as Promise<{ rows: Array<{ errorLog: string | null }> }>)
      return result.rows
    } catch {
      return []
    }
  })()

  const [quality, genRate, cost, worstBlocks, heatmap, failLogs, overrideCategories] = await Promise.all([
    getAvgQualityScore(range).catch(() => null),
    getGenSuccessRate(range).catch(() => null),
    getCostPerGen(range).catch(() => null),
    getWorstBlocks(range, 10).catch(() => []),
    getCategoryBlockHeatmap(range).catch(() => ({ categories: [], blocks: [], matrix: [] })),
    failLogsPromise,
    getHighestOverrideCategories(range, 8).catch(() => []),
  ])

  const failBreakdown = categorizeFailures(failLogs)

  const fromStr = range.from.toISOString()
  const toStr = range.to.toISOString()
  const exportUrl = `/api/admin/metrics/export?from=${encodeURIComponent(fromStr)}&to=${encodeURIComponent(toStr)}`

  return (
    <QualityDashboardClient
      quality={quality}
      genRate={genRate}
      cost={cost}
      worstBlocks={worstBlocks}
      heatmap={heatmap}
      failBreakdown={failBreakdown}
      from={fromStr}
      to={toStr}
      exportUrl={exportUrl}
      overrideCategories={overrideCategories}
    />
  )
}
