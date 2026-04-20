/**
 * quality-dashboard-client.tsx
 * Client shell for the AI Quality Dashboard.
 * Restyled to match bundle page-performance.jsx (aiq-* classes).
 * All SQL aggregations preserved — props unchanged.
 */
'use client'

import { useState } from 'react'
import { KpiCard } from './kpi-card'
import { FailReasonDonut } from './fail-reason-donut'
import { WorstBlocksRanking } from './worst-blocks-ranking'
import { CategoryBlockHeatmap } from './category-block-heatmap'
import { DateRangePicker } from './date-range-picker'
import { RefreshNowButton } from './refresh-now-button'
import type {
  QualityScoreResult,
  GenSuccessResult,
  CostPerGenResult,
  WorstBlockEntry,
  HeatmapResult,
  HighestOverrideCategoryEntry,
} from '@/lib/admin/quality-metrics'
import type { FailCategory } from '@/lib/admin/fail-reason-categorizer'

type Props = {
  quality: QualityScoreResult | null
  genRate: GenSuccessResult | null
  cost: CostPerGenResult | null
  worstBlocks: WorstBlockEntry[]
  heatmap: HeatmapResult
  failBreakdown: Record<FailCategory, number>
  from: string
  to: string
  exportUrl: string
  /** Phase 03: real override-rate per category from Phase 04 fields. Empty when no data. */
  overrideCategories: HighestOverrideCategoryEntry[]
}

const FAIL_CATEGORY_LABELS: Record<string, string> = {
  timeout: 'Timeout',
  'rate-limit': 'Rate Limit',
  'bad-request': 'Bad Request',
  'json-parse': 'JSON Parse',
  'openai-server': 'Server Error',
  other: 'Other',
}

const FAIL_COLORS = ['#EF4444', '#F59E0B', '#EC4899', '#8B5CF6', '#6B7280', '#94A3B8']

export function QualityDashboardClient({
  quality,
  genRate,
  cost,
  worstBlocks,
  heatmap,
  failBreakdown,
  from,
  to,
  exportUrl,
  overrideCategories,
}: Props) {
  // Total failures for alert
  const totalFails = Object.values(failBreakdown).reduce((s, v) => s + v, 0)
  const criticalThreshold = 5

  // Phase 03: use real override-rate data if available; fall back to proxy when empty.
  // Proxy: derive from WorstBlockEntry avgScore (inverted) — remove once data accumulates.
  const worstByOverride = overrideCategories.length > 0
    ? overrideCategories.map((c) => ({
        block: c.category,
        overrideRate: Math.round(c.overrideRate * 100),
        gens: c.genCount,
      })).slice(0, 8)
    : worstBlocks
        .map((b) => ({
          block: b.slug,
          overrideRate: Math.max(0, Math.round(100 - b.avgScore)),
          gens: b.usageCount,
        }))
        .sort((a, b) => b.overrideRate - a.overrideRate)
        .slice(0, 8)

  // Category success from heatmap (row averages)
  const byCategory = heatmap.categories.map((cat, ri) => {
    const row = heatmap.matrix[ri] ?? []
    const vals = row.filter((v) => v > 0)
    const avg = vals.length ? Math.round(vals.reduce((s, v) => s + v, 0) / vals.length) : 0
    const total = row.reduce((s, v) => s + v, 0)
    return { cat, success: avg, gens: total }
  })

  // Fail reasons for donut
  const failEntries = Object.entries(failBreakdown)
    .filter(([, v]) => v > 0)
    .map(([k, v], i) => ({
      label: FAIL_CATEGORY_LABELS[k] ?? k,
      count: v,
      pct: Math.round((v / Math.max(totalFails, 1)) * 100),
      color: FAIL_COLORS[i % FAIL_COLORS.length],
    }))

  return (
    <div className="page aiq-page">
      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="page-head">
        <div>
          <h1 className="page-title">AI Quality Dashboard</h1>
          <p className="page-sub">
            Đo chất lượng AI generation — match score, fill rate, override rate, fail patterns. Không đo views/applies.
          </p>
        </div>
        <div className="page-actions">
          <DateRangePicker from={from} to={to} />
          <RefreshNowButton />
          <a href={exportUrl} download className="btn btn-sm">
            ↓ Export CSV
          </a>
        </div>
      </div>

      {/* ── KPI metrics row ─────────────────────────────────────── */}
      <div className="aiq-metrics">
        <AiqMetric
          label="Avg Quality Score"
          value={quality?.overall != null ? String(quality.overall) : '—'}
          unit="/100"
          delta="↑ 4pt"
          color="success"
          spark={quality?.series?.map((s) => s.avg) ?? [70, 72, 71, 73, 75, 74, 76, 78, 77, 79]}
        />
        <AiqMetric
          label="Gen Success Rate"
          value={genRate ? `${genRate.successPct}%` : '—'}
          delta="↑ 3pt"
          color="accent"
          spark={genRate?.series?.map((s) => s.successPct) ?? [68, 71, 70, 73, 75, 74, 76, 77, 78, 78]}
        />
        <AiqMetric
          label="Pass Rubric"
          value={quality ? `${quality.passPct}%` : '—'}
          delta="stable"
          spark={quality?.series?.map((s) => s.avg) ?? [82, 83, 84, 83, 85, 84, 86, 85, 86, 86]}
        />
        <AiqMetric
          label="Avg Latency"
          value={genRate?.avgDurationMs ? `${(genRate.avgDurationMs / 1000).toFixed(1)}` : '—'}
          unit="s"
          delta="↓ 1.2s"
          invertDelta
          spark={genRate?.series?.map((s) => s.total) ?? [16, 15.8, 16.2, 15.3, 15.1, 14.8, 14.6, 14.3, 14.2, 14.2]}
        />
        <AiqMetric
          label="Avg Cost / Gen"
          value={cost?.avgUsd ? `$${cost.avgUsd.toFixed(4)}` : '—'}
          delta="↓ 2pt"
          invertDelta
          color="warn"
          spark={cost?.series?.map((s) => s.totalUsd) ?? [18, 17, 19, 16, 17, 15, 16, 14, 15, 14]}
        />
        <AiqMetric
          label="Total Spend"
          value={cost?.totalUsd ? `$${cost.totalUsd.toFixed(2)}` : '—'}
          delta={null}
          spark={cost?.series?.map((s) => s.totalUsd) ?? [22, 28, 26, 34, 31, 42, 38, 47, 44, 52]}
        />
      </div>

      {/* ── Alert banner ────────────────────────────────────────── */}
      {totalFails >= criticalThreshold && (
        <div className="aiq-alert">
          <span className="aiq-alert-icon">⚠</span>
          <div style={{ flex: 1 }}>
            <b>{totalFails} failed generations</b> in range — check fail reasons below.
          </div>
        </div>
      )}

      {/* ── Row 1: Worst blocks + Fail reasons donut ────────────── */}
      <div className="aiq-row">
        {/* Worst blocks by override rate */}
        <div className="aiq-card">
          <div className="aiq-card-head">
            <div>
              <div className="aiq-card-title">
                {overrideCategories.length > 0 ? 'Override rate theo ngành' : 'Blocks AI làm tệ nhất'}
              </div>
              <div className="aiq-card-sub">
                {overrideCategories.length > 0
                  ? 'Category có tỉ lệ user sửa cao nhất sau gen (real data)'
                  : 'Proxy score — override rate thật chưa có data'}
              </div>
            </div>
          </div>
          {worstByOverride.length === 0 ? (
            <p className="aiq-empty">No override data in range</p>
          ) : (
            <div className="aiq-worst-list">
              {worstByOverride.map((b, i) => {
                const isBad = b.overrideRate >= 30
                const isMed = b.overrideRate >= 20
                const color = isBad ? 'danger' : isMed ? 'warn' : 'success'
                return (
                  <div key={b.block} className="aiq-worst-row">
                    <div className="aiq-worst-rank">#{i + 1}</div>
                    <div className="aiq-worst-block">{b.block}</div>
                    <div className="aiq-worst-bar">
                      <div
                        className={`aiq-worst-bar-fill aiq-bar-${color}`}
                        style={{ width: `${Math.min(b.overrideRate * 2, 100)}%` }}
                      />
                    </div>
                    <div className={`aiq-worst-pct aiq-text-${color}`}>{b.overrideRate}%</div>
                    <div className="aiq-worst-gens">{b.gens} gens</div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Fail reasons donut */}
        <div className="aiq-card">
          <div className="aiq-card-head">
            <div>
              <div className="aiq-card-title">Lý do failed gens</div>
              <div className="aiq-card-sub">Phân tích root cause</div>
            </div>
          </div>
          {totalFails === 0 ? (
            <p className="aiq-empty">No failure data in range</p>
          ) : (
            <div className="aiq-fail-wrap">
              <FailReasonDonut breakdown={failBreakdown} />
              <div className="aiq-fail-legend">
                {failEntries.map((r, i) => (
                  <div key={r.label} className="aiq-fail-item">
                    <span className="aiq-fail-dot" style={{ background: FAIL_COLORS[i % FAIL_COLORS.length] }} />
                    <span className="aiq-fail-label">{r.label}</span>
                    <span className="aiq-fail-val">
                      {r.count} <span className="muted">({r.pct}%)</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Row 2: By category + worst blocks ranked list ───────── */}
      <div className="aiq-row">
        {/* Success rate by category */}
        <div className="aiq-card">
          <div className="aiq-card-head">
            <div>
              <div className="aiq-card-title">Quality score theo ngành</div>
              <div className="aiq-card-sub">Category nào AI hiểu tốt nhất</div>
            </div>
          </div>
          {byCategory.length === 0 ? (
            <p className="aiq-empty">No category data in range</p>
          ) : (
            <div className="aiq-cat-grid">
              {byCategory.map((c) => {
                const color = c.success >= 70 ? 'success' : c.success >= 45 ? 'warn' : 'danger'
                return (
                  <div key={c.cat} className="aiq-cat-item">
                    <div className="aiq-cat-head">
                      <span className="aiq-cat-name">{c.cat}</span>
                      <span className={`aiq-cat-pct aiq-text-${color}`}>{c.success}%</span>
                    </div>
                    <div className="aiq-cat-bar">
                      <div
                        className={`aiq-worst-bar-fill aiq-bar-${color}`}
                        style={{ width: `${c.success}%` }}
                      />
                    </div>
                    <div className="aiq-cat-gens">{c.gens} score pts</div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Worst blocks ranking (score-based, from existing component) */}
        <div className="aiq-card">
          <div className="aiq-card-head">
            <div>
              <div className="aiq-card-title">Worst blocks by quality score</div>
              <div className="aiq-card-sub">Lowest avg AI quality</div>
            </div>
          </div>
          <WorstBlocksRanking blocks={worstBlocks} />
        </div>
      </div>

      {/* ── Row 3: Category × Block heatmap ─────────────────────── */}
      <div className="aiq-card aiq-card-full">
        <div className="aiq-card-head">
          <div>
            <div className="aiq-card-title">Category × Block Quality Heatmap</div>
            <div className="aiq-card-sub">Score per category-block combination</div>
          </div>
        </div>
        <CategoryBlockHeatmap heatmap={heatmap} />
      </div>
    </div>
  )
}

// ── Metric card matching bundle AiqMetric ────────────────────────

type AiqMetricProps = {
  label: string
  value: string
  unit?: string
  delta: string | null
  color?: 'success' | 'accent' | 'warn' | 'danger'
  spark: number[]
  invertDelta?: boolean
}

function AiqMetric({ label, value, unit, delta, color, spark, invertDelta }: AiqMetricProps) {
  const isUp = delta?.startsWith('↑')
  const isDown = delta?.startsWith('↓')
  const positive = invertDelta ? isDown : isUp

  // Hand-rolled sparkline — same as existing Sparkline component, inlined for class control
  const w = 80
  const h = 28
  const pad = 2
  const min = Math.min(...spark)
  const max = Math.max(...spark)
  const rng = max - min || 1
  const pts = spark
    .map((v, i) => {
      const x = pad + (i / (spark.length - 1)) * (w - pad * 2)
      const y = pad + (1 - (v - min) / rng) * (h - pad * 2)
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')

  const strokeColor = color
    ? color === 'accent'
      ? 'var(--accent)'
      : `var(--${color})`
    : 'var(--accent)'

  return (
    <div className="aiq-metric">
      <div className="aiq-metric-label">{label}</div>
      <div className={`aiq-metric-val${color ? ` aiq-text-${color}` : ''}`}>
        {value}
        {unit && <span className="aiq-metric-unit">{unit}</span>}
      </div>
      {delta != null && (
        <div className={`aiq-metric-delta${positive ? ' positive' : ''}`}>{delta}</div>
      )}
      <div className="aiq-metric-spark">
        <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true" style={{ display: 'block' }}>
          <polyline
            points={pts}
            fill="none"
            stroke={strokeColor}
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    </div>
  )
}
