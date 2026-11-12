/**
 * GET /api/admin/metrics/export
 * Downloads a CSV with KPI summary + top 100 generation records.
 * Rate-limited: 5 req/min per IP.
 * Super-admin guarded.
 */
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { withStudioPermission } from '@/lib/admin/api-utils'
import { checkRateLimit } from '@/lib/admin/api-utils'
import {
  getAvgQualityScore,
  getGenSuccessRate,
  getCostPerGen,
} from '@/lib/admin/quality-metrics'
import { getPayload } from 'payload'
import config from '@payload-config'
import { sql } from 'drizzle-orm'

// ── CSV helpers ───────────────────────────────────────────────────────────────

function csvRow(values: (string | number | null | undefined)[]): string {
  return values
    .map((v) => {
      if (v === null || v === undefined) return ''
      const str = String(v)
      // Escape double-quotes; wrap in quotes if contains comma/newline/quote
      if (str.includes(',') || str.includes('\n') || str.includes('"')) {
        return `"${str.replace(/"/g, '""')}"`
      }
      return str
    })
    .join(',')
}

function parseRange(sp: URLSearchParams): { from: Date; to: Date } {
  const toRaw = sp.get('to')
  const fromRaw = sp.get('from')
  const to = toRaw ? new Date(toRaw) : new Date()
  const from = fromRaw ? new Date(fromRaw) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  return { from, to }
}

// ── Handler ───────────────────────────────────────────────────────────────────

export const GET = withStudioPermission('data.export', async (req: NextRequest) => {
  // Rate limit: 5/min per IP
  const ip = req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? 'unknown'
  if (!checkRateLimit(`export:${ip}`, 5)) {
    return NextResponse.json({ error: 'Rate limit exceeded — max 5 exports/min' }, { status: 429 })
  }

  const range = parseRange(req.nextUrl.searchParams)

  const [quality, genRate, cost, recordRows] = await Promise.all([
    getAvgQualityScore(range).catch(() => null),
    getGenSuccessRate(range).catch(() => null),
    getCostPerGen(range).catch(() => null),
    (async () => {
      try {
        const payload = await getPayload({ config })
        const result = await (payload.db.drizzle.execute(sql`
          SELECT
            id, endpoint, category, status,
            duration_ms, cost_usd, error_log,
            created_at
          FROM ai_generation_records
          WHERE created_at >= ${range.from.toISOString()}
            AND created_at <= ${range.to.toISOString()}
          ORDER BY created_at DESC
          LIMIT 100
        `) as Promise<{
          rows: Array<{
            id: number
            endpoint: string
            category: string | null
            status: string
            duration_ms: number | null
            cost_usd: string | null
            error_log: string | null
            created_at: string
          }>
        }>)
        return result.rows
      } catch {
        return []
      }
    })(),
  ])

  const lines: string[] = []

  // ── Section 1: KPI Summary ──
  lines.push('## KPI Summary')
  lines.push(csvRow(['Metric', 'Value']))
  lines.push(csvRow(['Period From', range.from.toISOString()]))
  lines.push(csvRow(['Period To', range.to.toISOString()]))
  lines.push(csvRow(['Avg Quality Score', quality?.overall ?? 'N/A']))
  lines.push(csvRow(['Pass Rubric %', quality?.passPct ?? 'N/A']))
  lines.push(csvRow(['Total Generations', genRate?.total ?? 'N/A']))
  lines.push(csvRow(['Success %', genRate?.successPct ?? 'N/A']))
  lines.push(csvRow(['Failed', genRate?.failed ?? 'N/A']))
  lines.push(csvRow(['Avg Duration (ms)', genRate?.avgDurationMs ?? 'N/A']))
  lines.push(csvRow(['Avg Cost USD', cost?.avgUsd ?? 'N/A']))
  lines.push(csvRow(['Total Cost USD', cost?.totalUsd ?? 'N/A']))
  lines.push('')

  // ── Section 2: Generation Records ──
  lines.push('## Generation Records (top 100)')
  lines.push(csvRow(['ID', 'Endpoint', 'Category', 'Status', 'Duration (ms)', 'Cost USD', 'Error', 'Created At']))
  for (const r of recordRows) {
    lines.push(csvRow([r.id, r.endpoint, r.category, r.status, r.duration_ms, r.cost_usd, r.error_log, r.created_at]))
  }

  const csv = lines.join('\n')
  const filename = `ai-quality-export-${range.from.toISOString().slice(0, 10)}-to-${range.to.toISOString().slice(0, 10)}.csv`

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
})
