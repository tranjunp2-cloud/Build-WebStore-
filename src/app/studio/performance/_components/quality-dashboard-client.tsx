/**
 * quality-dashboard-client.tsx
 * Client shell for the AI Quality Dashboard.
 * Receives all metrics as props from the server component.
 * Renders KPI grid, charts, and secondary panels.
 */
'use client'

import { KpiCard } from './kpi-card'
import { FailReasonDonut } from './fail-reason-donut'
import { WorstBlocksRanking } from './worst-blocks-ranking'
import { CategoryBlockHeatmap } from './category-block-heatmap'
import { DateRangePicker } from './date-range-picker'
import { RefreshNowButton } from './refresh-now-button'
import type { QualityScoreResult, GenSuccessResult, CostPerGenResult, WorstBlockEntry, HeatmapResult } from '@/lib/admin/quality-metrics'
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
}

// ── Section wrapper ───────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        background: 'var(--bg-elev)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        padding: '20px 24px',
      }}
    >
      <h2 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-2)', margin: '0 0 16px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {title}
      </h2>
      {children}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

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
}: Props) {
  return (
    <div style={{ padding: '24px 28px', maxWidth: 1280 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: 'var(--text)', margin: 0 }}>
            AI Quality Dashboard
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-2)' }}>
            Generation success, quality scores, latency, and cost — refreshed every 5 min.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <DateRangePicker from={from} to={to} />
          <RefreshNowButton />
          <a
            href={exportUrl}
            download
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '5px 12px',
              borderRadius: 6,
              border: '1px solid var(--border)',
              background: 'var(--bg-elev)',
              color: 'var(--text-2)',
              fontSize: 12,
              fontWeight: 500,
              textDecoration: 'none',
            }}
          >
            ↓ Export CSV
          </a>
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12, marginBottom: 24 }}>
        <KpiCard
          label="Avg Quality Score"
          value={quality?.overall ?? '—'}
          unit="/100"
          sparkData={quality?.series.map((s) => s.avg)}
          sparkColor="#22c55e"
        />
        <KpiCard
          label="Pass Rubric"
          value={quality ? `${quality.passPct}%` : '—'}
          sparkData={quality?.series.map((s) => s.avg)}
          sparkColor="#22c55e"
        />
        <KpiCard
          label="Gen Success Rate"
          value={genRate ? `${genRate.successPct}%` : '—'}
          sparkData={genRate?.series.map((s) => s.successPct)}
          sparkColor="#3b82f6"
        />
        <KpiCard
          label="Avg Latency"
          value={genRate?.avgDurationMs ? `${(genRate.avgDurationMs / 1000).toFixed(1)}` : '—'}
          unit="s"
          higherIsBetter={false}
          sparkData={genRate?.series.map((s) => s.total)}
          sparkColor="#8b5cf6"
        />
        <KpiCard
          label="Avg Cost / Gen"
          value={cost?.avgUsd ? `$${cost.avgUsd.toFixed(4)}` : '—'}
          higherIsBetter={false}
          sparkData={cost?.series.map((s) => s.totalUsd)}
          sparkColor="#f59e0b"
        />
        <KpiCard
          label="Total Spend"
          value={cost?.totalUsd ? `$${cost.totalUsd.toFixed(2)}` : '—'}
          higherIsBetter={false}
          sparkData={cost?.series.map((s) => s.totalUsd)}
          sparkColor="#f59e0b"
        />
      </div>

      {/* Middle row: fail donut + worst blocks */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <Section title="Fail Reason Breakdown">
          <FailReasonDonut breakdown={failBreakdown} />
        </Section>
        <Section title="Worst Blocks by Quality Score">
          <WorstBlocksRanking blocks={worstBlocks} />
        </Section>
      </div>

      {/* Heatmap */}
      <Section title="Category × Block Quality Heatmap">
        <CategoryBlockHeatmap heatmap={heatmap} />
      </Section>
    </div>
  )
}
