/**
 * kpi-card.tsx
 * Single KPI metric card: value, delta vs prev period, optional sparkline.
 */
'use client'

import { Sparkline } from './sparkline'

type Props = {
  label: string
  value: string | number
  /** Positive = improvement, negative = regression. null = no prev data. */
  delta?: number | null
  /** Whether a higher delta is good (true) or bad (false). Default: true. */
  higherIsBetter?: boolean
  sparkData?: number[]
  sparkColor?: string
  unit?: string
}

export function KpiCard({
  label,
  value,
  delta,
  higherIsBetter = true,
  sparkData,
  sparkColor,
  unit,
}: Props) {
  const hasDelta = delta !== null && delta !== undefined
  const isPositive = hasDelta && delta! > 0
  const isNegative = hasDelta && delta! < 0
  const isGood = (isPositive && higherIsBetter) || (isNegative && !higherIsBetter)
  const deltaColor = !hasDelta || delta === 0
    ? 'var(--text-3)'
    : isGood
      ? '#22c55e'
      : '#ef4444'

  const deltaSymbol = isPositive ? '▲' : isNegative ? '▼' : '—'
  const deltaAbs = hasDelta ? Math.abs(delta!).toFixed(1) : null

  return (
    <div
      style={{
        background: 'var(--bg-elev)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        padding: '16px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        minWidth: 160,
      }}
    >
      <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {label}
      </span>

      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 8 }}>
        <span style={{ fontSize: 26, fontWeight: 700, color: 'var(--text)', lineHeight: 1 }}>
          {value}{unit && <span style={{ fontSize: 13, fontWeight: 400, marginLeft: 2, color: 'var(--text-2)' }}>{unit}</span>}
        </span>
        {sparkData && sparkData.length >= 2 && (
          <Sparkline data={sparkData} color={sparkColor ?? 'var(--accent)'} width={80} height={28} />
        )}
      </div>

      {hasDelta && (
        <span style={{ fontSize: 12, color: deltaColor, fontWeight: 500 }}>
          {deltaSymbol} {deltaAbs}% vs prev period
        </span>
      )}
    </div>
  )
}
