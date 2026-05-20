/**
 * quality-metrics.ts
 * Raw-SQL aggregation functions for the AI Quality Dashboard (Phase 07).
 * All queries use payload.db.drizzle.execute() + drizzle-orm sql tag.
 * Returns typed results; null-safe (returns empty/zero if no data).
 */
import { getPayload } from 'payload'
import config from '@payload-config'
import { sql } from 'drizzle-orm'

// ── Shared date range type ───────────────────────────────────────────────────

export type DateRange = { from: Date; to: Date }

// ── Result types ─────────────────────────────────────────────────────────────

export type QualityScoreResult = {
  overall: number
  passPct: number
  series: Array<{ day: string; avg: number }>
}

export type GenSuccessResult = {
  total: number
  success: number
  failed: number
  running: number
  successPct: number
  avgDurationMs: number
  series: Array<{ day: string; total: number; successPct: number }>
}

export type CostPerGenResult = {
  avgUsd: number
  totalUsd: number
  series: Array<{ day: string; totalUsd: number }>
}

export type WorstBlockEntry = {
  slug: string
  name: string
  avgScore: number
  usageCount: number
}

// Phase 03: real override-rate per category using Phase 04 fields
export type HighestOverrideCategoryEntry = {
  category: string
  overrideRate: number   // 0–1 float, e.g. 0.42 = 42%
  genCount: number
}

export type HeatmapResult = {
  categories: string[]
  blocks: string[]
  matrix: number[][]
}

// ── Row shapes returned from drizzle execute ─────────────────────────────────

type ScoreRow = { day: string; avg_score: string | null }
type OverallScoreRow = { overall: string | null; pass_count: string | null; total_count: string | null }
type GenStatusRow = { status: string; count: string; avg_duration: string | null }
type GenSeriesRow = { day: string; total: string; success_count: string }
type CostRow = { avg_usd: string | null; total_usd: string | null }
type CostSeriesRow = { day: string; total_usd: string | null }
type BlockScoreRow = { block_name: string; avg_score: string | null }
type HeatmapRow = { category: string; block_name: string; avg_score: string | null }
// Phase 03: real override-rate row shape
type OverrideRateCategoryRow = {
  category: string | null
  override_rate: string | null
  gen_count: string
}

function toFloat(val: string | null | undefined): number {
  if (val === null || val === undefined) return 0
  const n = parseFloat(val)
  return isNaN(n) ? 0 : n
}

function toInt(val: string | null | undefined): number {
  if (val === null || val === undefined) return 0
  const n = parseInt(val, 10)
  return isNaN(n) ? 0 : n
}

// ── 1. Average quality score ─────────────────────────────────────────────────

/**
 * Returns overall avg quality score + daily series within [from, to].
 * Source: template_quality_scores.
 */
export async function getAvgQualityScore(range: DateRange): Promise<QualityScoreResult> {
  const payload = await getPayload({ config })
  const db = payload.db.drizzle

  const [overallRows, seriesRows] = await Promise.all([
    db.execute(sql`
      SELECT
        AVG(avg_score) AS overall,
        COUNT(*) FILTER (WHERE pass_rubric = true) AS pass_count,
        COUNT(*) AS total_count
      FROM template_quality_scores
      WHERE scored_at >= ${range.from.toISOString()}
        AND scored_at <= ${range.to.toISOString()}
    `) as Promise<{ rows: OverallScoreRow[] }>,

    db.execute(sql`
      SELECT
        DATE_TRUNC('day', scored_at)::date::text AS day,
        AVG(avg_score) AS avg_score
      FROM template_quality_scores
      WHERE scored_at >= ${range.from.toISOString()}
        AND scored_at <= ${range.to.toISOString()}
      GROUP BY DATE_TRUNC('day', scored_at)
      ORDER BY DATE_TRUNC('day', scored_at)
    `) as Promise<{ rows: ScoreRow[] }>,
  ])

  const overall = toFloat(overallRows.rows[0]?.overall)
  const passCount = toInt(overallRows.rows[0]?.pass_count)
  const totalCount = toInt(overallRows.rows[0]?.total_count)
  const passPct = totalCount === 0 ? 0 : Math.round((passCount / totalCount) * 100)

  return {
    overall: Math.round(overall * 10) / 10,
    passPct,
    series: seriesRows.rows.map((r) => ({
      day: r.day,
      avg: Math.round(toFloat(r.avg_score) * 10) / 10,
    })),
  }
}

// ── 2. Generation success rate ────────────────────────────────────────────────

/**
 * Returns generation counts by status + daily success-rate series.
 * Source: ai_generation_records.
 */
export async function getGenSuccessRate(range: DateRange): Promise<GenSuccessResult> {
  const payload = await getPayload({ config })
  const db = payload.db.drizzle

  const [statusRows, seriesRows] = await Promise.all([
    db.execute(sql`
      SELECT
        status,
        COUNT(*) AS count,
        AVG(duration_ms) FILTER (WHERE status = 'success') AS avg_duration
      FROM ai_generation_records
      WHERE created_at >= ${range.from.toISOString()}
        AND created_at <= ${range.to.toISOString()}
      GROUP BY status
    `) as Promise<{ rows: GenStatusRow[] }>,

    db.execute(sql`
      SELECT
        DATE_TRUNC('day', created_at)::date::text AS day,
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE status = 'success') AS success_count
      FROM ai_generation_records
      WHERE created_at >= ${range.from.toISOString()}
        AND created_at <= ${range.to.toISOString()}
      GROUP BY DATE_TRUNC('day', created_at)
      ORDER BY DATE_TRUNC('day', created_at)
    `) as Promise<{ rows: GenSeriesRow[] }>,
  ])

  let total = 0, success = 0, failed = 0, running = 0
  let avgDurationMs = 0

  for (const row of statusRows.rows) {
    const count = toInt(row.count)
    total += count
    if (row.status === 'success') {
      success = count
      avgDurationMs = Math.round(toFloat(row.avg_duration))
    } else if (row.status === 'failed') {
      failed = count
    } else if (row.status === 'running') {
      running = count
    }
  }

  const successPct = total === 0 ? 0 : Math.round((success / total) * 100)

  return {
    total,
    success,
    failed,
    running,
    successPct,
    avgDurationMs,
    series: seriesRows.rows.map((r) => {
      const t = toInt(r.total)
      const s = toInt(r.success_count)
      return {
        day: r.day,
        total: t,
        successPct: t === 0 ? 0 : Math.round((s / t) * 100),
      }
    }),
  }
}

// ── 3. Cost per generation ────────────────────────────────────────────────────

/**
 * Returns avg + total cost in USD + daily series.
 * Prefers ai_generation_records.cost_usd; falls back to ai_usage_logs if sparse.
 */
export async function getCostPerGen(range: DateRange): Promise<CostPerGenResult> {
  const payload = await getPayload({ config })
  const db = payload.db.drizzle

  // Try ai_generation_records first
  const [aggRows, seriesRows] = await Promise.all([
    db.execute(sql`
      SELECT
        AVG(cost_usd) AS avg_usd,
        SUM(cost_usd) AS total_usd
      FROM ai_generation_records
      WHERE created_at >= ${range.from.toISOString()}
        AND created_at <= ${range.to.toISOString()}
        AND cost_usd IS NOT NULL
    `) as Promise<{ rows: CostRow[] }>,

    db.execute(sql`
      SELECT
        DATE_TRUNC('day', created_at)::date::text AS day,
        SUM(cost_usd) AS total_usd
      FROM ai_generation_records
      WHERE created_at >= ${range.from.toISOString()}
        AND created_at <= ${range.to.toISOString()}
        AND cost_usd IS NOT NULL
      GROUP BY DATE_TRUNC('day', created_at)
      ORDER BY DATE_TRUNC('day', created_at)
    `) as Promise<{ rows: CostSeriesRow[] }>,
  ])

  let avgUsd = toFloat(aggRows.rows[0]?.avg_usd)
  let totalUsd = toFloat(aggRows.rows[0]?.total_usd)

  // Fallback: if no cost data in generation records, use ai_usage_logs
  if (totalUsd === 0) {
    const fallback = await db.execute(sql`
      SELECT
        AVG(cost_usd) AS avg_usd,
        SUM(cost_usd) AS total_usd
      FROM ai_usage_logs
      WHERE created_at >= ${range.from.toISOString()}
        AND created_at <= ${range.to.toISOString()}
    `) as { rows: CostRow[] }

    avgUsd = toFloat(fallback.rows[0]?.avg_usd)
    totalUsd = toFloat(fallback.rows[0]?.total_usd)
  }

  return {
    avgUsd: Math.round(avgUsd * 100000) / 100000,
    totalUsd: Math.round(totalUsd * 100) / 100,
    series: seriesRows.rows.map((r) => ({
      day: r.day,
      totalUsd: Math.round(toFloat(r.total_usd) * 1000) / 1000,
    })),
  }
}

// ── 4. Worst blocks ranking ───────────────────────────────────────────────────

/**
 * Returns top `limit` blocks with lowest avg quality score, weighted by usage.
 * Source: template_quality_scores_dimensions for scores,
 *         ai_generation_records_selected_blocks for usage proxy.
 */
export async function getWorstBlocks(
  range: DateRange,
  limit = 10,
): Promise<WorstBlockEntry[]> {
  const payload = await getPayload({ config })
  const db = payload.db.drizzle

  const [scoreRows, usageRows] = await Promise.all([
    db.execute(sql`
      SELECT
        d.name AS block_name,
        AVG(d.score) AS avg_score
      FROM template_quality_scores_dimensions d
      JOIN template_quality_scores s ON s.id = d._parent_id
      WHERE s.scored_at >= ${range.from.toISOString()}
        AND s.scored_at <= ${range.to.toISOString()}
      GROUP BY d.name
      ORDER BY AVG(d.score) ASC
      LIMIT ${limit}
    `) as Promise<{ rows: BlockScoreRow[] }>,

    db.execute(sql`
      SELECT
        sb.value AS block_name,
        COUNT(*) AS usage_count
      FROM ai_generation_records_selected_blocks sb
      JOIN ai_generation_records r ON r.id = sb._parent_id
      WHERE r.created_at >= ${range.from.toISOString()}
        AND r.created_at <= ${range.to.toISOString()}
        AND sb.value IS NOT NULL
      GROUP BY sb.value
    `) as Promise<{ rows: Array<{ block_name: string; usage_count: string }> }>,
  ])

  const usageMap = new Map<string, number>()
  for (const row of usageRows.rows) {
    usageMap.set(row.block_name, toInt(row.usage_count))
  }

  return scoreRows.rows.map((r) => ({
    slug: r.block_name,
    name: r.block_name, // display name resolved in UI from registry
    avgScore: Math.round(toFloat(r.avg_score) * 10) / 10,
    usageCount: usageMap.get(r.block_name) ?? 0,
  }))
}

// ── 5. Highest override-rate categories (Phase 03 — real formula) ─────────────

/**
 * Returns top `limit` categories sorted by real override rate.
 * Override rate = AVG(fields_edited / NULLIF(fields_filled, 0)) per category.
 * Uses Phase 04 schema columns: fields_edited, fields_filled on ai_generation_records.
 * NULL-safe: rows where fields_filled = 0 are excluded via NULLIF.
 * Source: ai_generation_records.
 */
export async function getHighestOverrideCategories(
  range: DateRange,
  limit = 10,
): Promise<HighestOverrideCategoryEntry[]> {
  const payload = await getPayload({ config })
  const db = payload.db.drizzle

  const rows = await db.execute(sql`
    SELECT
      COALESCE(category, 'uncategorized') AS category,
      AVG(fields_edited::float / NULLIF(fields_filled, 0)) AS override_rate,
      COUNT(*) AS gen_count
    FROM ai_generation_records
    WHERE created_at >= ${range.from.toISOString()}
      AND created_at <= ${range.to.toISOString()}
      AND fields_filled > 0
    GROUP BY category
    ORDER BY AVG(fields_edited::float / NULLIF(fields_filled, 0)) DESC NULLS LAST
    LIMIT ${limit}
  `) as { rows: OverrideRateCategoryRow[] }

  return rows.rows.map((r) => ({
    category: r.category ?? 'uncategorized',
    overrideRate: Math.round(toFloat(r.override_rate) * 1000) / 1000,
    genCount: toInt(r.gen_count),
  }))
}

// ── 7. Category × block heatmap ───────────────────────────────────────────────

/**
 * Returns 2D matrix of avg quality score per (category, block) pair.
 * Derives category from ai_generation_records.category column.
 * Source: joins ai_generation_records + template_quality_scores_dimensions
 *         via template lookup (best effort — no direct FK).
 *
 * Simplified approach: group dimensions by (category, block_name) using
 * the category from the generation record that produced the scored template.
 */
export async function getCategoryBlockHeatmap(range: DateRange): Promise<HeatmapResult> {
  const payload = await getPayload({ config })
  const db = payload.db.drizzle

  // Get (category, block_name, avg_score) triplets
  // We join through: ai_generation_records → sites → templates (via site_id)
  // Simplified: use template_quality_scores_dimensions grouped by block name + category
  // Category comes from ai_generation_records.category for the matching site.
  const rows = await db.execute(sql`
    SELECT
      COALESCE(r.category, 'uncategorized') AS category,
      d.name AS block_name,
      AVG(d.score) AS avg_score
    FROM template_quality_scores s
    JOIN template_quality_scores_dimensions d ON d._parent_id = s.id
    JOIN ai_generation_records r ON r.site_id = s.template_id
    WHERE s.scored_at >= ${range.from.toISOString()}
      AND s.scored_at <= ${range.to.toISOString()}
      AND r.created_at >= ${range.from.toISOString()}
      AND r.created_at <= ${range.to.toISOString()}
    GROUP BY r.category, d.name
    ORDER BY r.category, d.name
  `) as { rows: HeatmapRow[] }

  if (rows.rows.length === 0) {
    return { categories: [], blocks: [], matrix: [] }
  }

  const categorySet = new Set<string>()
  const blockSet = new Set<string>()
  const cellMap = new Map<string, number>()

  for (const row of rows.rows) {
    categorySet.add(row.category)
    blockSet.add(row.block_name)
    cellMap.set(`${row.category}::${row.block_name}`, toFloat(row.avg_score))
  }

  const categories = [...categorySet]
  const blocks = [...blockSet]

  const matrix = categories.map((cat) =>
    blocks.map((blk) => {
      const val = cellMap.get(`${cat}::${blk}`)
      return val !== undefined ? Math.round(val * 10) / 10 : 0
    }),
  )

  return { categories, blocks, matrix }
}
