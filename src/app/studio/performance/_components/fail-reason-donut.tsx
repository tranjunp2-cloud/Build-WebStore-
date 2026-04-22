/**
 * fail-reason-donut.tsx
 * Pure SVG donut chart for fail-reason breakdown. No recharts.
 * Renders arc paths with a legend. Shows % per category.
 */
'use client'

import type { FailCategory } from '@/lib/admin/fail-reason-categorizer'

type Props = {
  breakdown: Record<FailCategory, number>
}

const CATEGORY_COLORS: Record<FailCategory, string> = {
  timeout: '#f97316',
  'rate-limit': '#eab308',
  'bad-request': '#3b82f6',
  'json-parse': '#8b5cf6',
  'openai-server': '#ef4444',
  other: '#94a3b8',
}

const CATEGORY_LABELS: Record<FailCategory, string> = {
  timeout: 'Timeout',
  'rate-limit': 'Rate Limit',
  'bad-request': 'Bad Request',
  'json-parse': 'JSON Parse',
  'openai-server': 'Server Error',
  other: 'Other',
}

function polarToXY(cx: number, cy: number, r: number, angle: number) {
  const rad = ((angle - 90) * Math.PI) / 180
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
}

function arcPath(cx: number, cy: number, r: number, startAngle: number, endAngle: number): string {
  const start = polarToXY(cx, cy, r, startAngle)
  const end = polarToXY(cx, cy, r, endAngle)
  const largeArc = endAngle - startAngle > 180 ? 1 : 0
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y}`
}

export function FailReasonDonut({ breakdown }: Props) {
  const entries = Object.entries(breakdown) as Array<[FailCategory, number]>
  const total = entries.reduce((sum, [, v]) => sum + v, 0)

  if (total === 0) {
    return (
      <div style={{ color: 'var(--text-3)', fontSize: 13, textAlign: 'center', padding: '24px 0' }}>
        No failure data in range
      </div>
    )
  }

  const cx = 60
  const cy = 60
  const r = 46
  const innerR = 28
  const size = 120

  // Build arcs
  const arcs: Array<{ cat: FailCategory; startAngle: number; endAngle: number; pct: number }> = []
  let angle = 0
  for (const [cat, count] of entries) {
    if (count === 0) continue
    const sweep = (count / total) * 360
    arcs.push({ cat, startAngle: angle, endAngle: angle + sweep, pct: Math.round((count / total) * 100) })
    angle += sweep
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flexShrink: 0 }}>
        {arcs.map(({ cat, startAngle, endAngle }) => (
          <path
            key={cat}
            d={`${arcPath(cx, cy, r, startAngle, endAngle)} L ${cx} ${cy} Z`}
            fill={CATEGORY_COLORS[cat]}
            opacity={0.9}
          />
        ))}
        {/* Donut hole */}
        <circle cx={cx} cy={cy} r={innerR} fill="var(--bg-elev)" />
        <text x={cx} y={cy + 1} textAnchor="middle" dominantBaseline="middle" fontSize={11} fontWeight={600} fill="var(--text)">
          {total}
        </text>
        <text x={cx} y={cy + 13} textAnchor="middle" dominantBaseline="middle" fontSize={8} fill="var(--text-3)">
          fails
        </text>
      </svg>

      {/* Legend */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        {arcs.map(({ cat, pct }) => (
          <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12 }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: CATEGORY_COLORS[cat], flexShrink: 0 }} />
            <span style={{ color: 'var(--text-2)' }}>{CATEGORY_LABELS[cat]}</span>
            <span style={{ color: 'var(--text)', fontWeight: 600, marginLeft: 'auto', paddingLeft: 8 }}>{pct}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}
