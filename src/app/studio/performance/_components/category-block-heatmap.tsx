/**
 * category-block-heatmap.tsx
 * 2D Tailwind grid — category (rows) × block (cols) — colored by avg score.
 * Color scale: green ≥ 70, amber 45–69, red < 45. Gray = no data (0).
 * Horizontal scroll on narrow viewports.
 */
'use client'

import type { HeatmapResult } from '@/lib/admin/quality-metrics'

type Props = {
  heatmap: HeatmapResult
}

function cellColor(score: number): string {
  if (score === 0) return 'color-mix(in srgb, var(--border) 50%, transparent)'
  if (score >= 70) return `rgba(34,197,94,${0.2 + (score - 70) / 100})`
  if (score >= 45) return `rgba(245,158,11,${0.2 + (score - 45) / 80})`
  return `rgba(239,68,68,${0.25 + (45 - score) / 80})`
}

function cellText(score: number): string {
  if (score === 0) return '—'
  return score.toFixed(0)
}

function cellTextColor(score: number): string {
  if (score === 0) return 'var(--text-3)'
  if (score >= 70) return '#15803d'
  if (score >= 45) return '#92400e'
  return '#b91c1c'
}

export function CategoryBlockHeatmap({ heatmap }: Props) {
  const { categories, blocks, matrix } = heatmap

  if (categories.length === 0 || blocks.length === 0) {
    return (
      <p style={{ color: 'var(--text-3)', fontSize: 13, textAlign: 'center', padding: '16px 0' }}>
        No heatmap data in range — scoring + generation records needed.
      </p>
    )
  }

  const CELL_W = 52
  const CELL_H = 32
  const ROW_LABEL_W = 120

  return (
    <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
      <div style={{ minWidth: ROW_LABEL_W + blocks.length * CELL_W + 8 }}>
        {/* Column headers */}
        <div style={{ display: 'flex', marginLeft: ROW_LABEL_W, marginBottom: 4 }}>
          {blocks.map((blk) => (
            <div
              key={blk}
              title={blk}
              style={{
                width: CELL_W,
                flexShrink: 0,
                fontSize: 10,
                color: 'var(--text-3)',
                textAlign: 'center',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                padding: '0 2px',
              }}
            >
              {blk}
            </div>
          ))}
        </div>

        {/* Rows */}
        {categories.map((cat, rowIdx) => (
          <div key={cat} style={{ display: 'flex', alignItems: 'center', marginBottom: 2 }}>
            {/* Row label */}
            <div
              style={{
                width: ROW_LABEL_W,
                flexShrink: 0,
                fontSize: 12,
                fontWeight: 500,
                color: 'var(--text-2)',
                paddingRight: 8,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {cat}
            </div>

            {/* Cells */}
            {blocks.map((blk, colIdx) => {
              const score = matrix[rowIdx]?.[colIdx] ?? 0
              return (
                <div
                  key={blk}
                  title={`${cat} × ${blk}: ${score === 0 ? 'no data' : score.toFixed(1)}`}
                  style={{
                    width: CELL_W,
                    height: CELL_H,
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: cellColor(score),
                    borderRadius: 4,
                    fontSize: 11,
                    fontWeight: 600,
                    color: cellTextColor(score),
                    margin: '0 1px',
                    cursor: 'default',
                  }}
                >
                  {cellText(score)}
                </div>
              )
            })}
          </div>
        ))}

        {/* Color scale legend */}
        <div style={{ display: 'flex', gap: 12, marginTop: 10, marginLeft: ROW_LABEL_W, alignItems: 'center' }}>
          {[
            { label: '≥ 70', color: 'rgba(34,197,94,0.5)', text: '#15803d' },
            { label: '45–69', color: 'rgba(245,158,11,0.5)', text: '#92400e' },
            { label: '< 45', color: 'rgba(239,68,68,0.5)', text: '#b91c1c' },
            { label: 'No data', color: 'color-mix(in srgb, var(--border) 50%, transparent)', text: 'var(--text-3)' },
          ].map(({ label, color, text }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11 }}>
              <span style={{ width: 12, height: 12, borderRadius: 2, background: color, display: 'inline-block' }} />
              <span style={{ color: text }}>{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
