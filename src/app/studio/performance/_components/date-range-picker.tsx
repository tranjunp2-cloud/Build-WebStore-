/**
 * date-range-picker.tsx
 * Preset buttons (7d / 30d / 90d) + custom date inputs.
 * Syncs with searchParams via router.push — no shadcn Popover needed for this MVP.
 */
'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useCallback } from 'react'

type Preset = { label: string; days: number }

const PRESETS: Preset[] = [
  { label: '7d', days: 7 },
  { label: '30d', days: 30 },
  { label: '90d', days: 90 },
]

type Props = {
  from: string
  to: string
}

export function DateRangePicker({ from, to }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const sp = useSearchParams()

  const push = useCallback(
    (params: Record<string, string>) => {
      const next = new URLSearchParams(sp.toString())
      for (const [k, v] of Object.entries(params)) next.set(k, v)
      router.push(`${pathname}?${next.toString()}`)
    },
    [router, pathname, sp],
  )

  function applyPreset(days: number) {
    const to = new Date()
    const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
    push({
      from: from.toISOString().slice(0, 10),
      to: to.toISOString().slice(0, 10),
    })
  }

  const currentFrom = from.slice(0, 10)
  const currentTo = to.slice(0, 10)

  function isActivePreset(days: number): boolean {
    const expectedFrom = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10)
    return currentFrom === expectedFrom
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      {/* Preset buttons */}
      {PRESETS.map(({ label, days }) => (
        <button
          key={label}
          onClick={() => applyPreset(days)}
          style={{
            padding: '5px 12px',
            borderRadius: 6,
            border: '1px solid var(--border)',
            background: isActivePreset(days) ? 'var(--accent)' : 'var(--bg-elev)',
            color: isActivePreset(days) ? '#fff' : 'var(--text-2)',
            fontSize: 12,
            fontWeight: 500,
            cursor: 'pointer',
            transition: 'background 0.15s',
          }}
        >
          {label}
        </button>
      ))}

      {/* Divider */}
      <span style={{ color: 'var(--border)', fontSize: 16, userSelect: 'none' }}>|</span>

      {/* Custom date inputs */}
      <input
        type="date"
        value={currentFrom}
        max={currentTo}
        onChange={(e) => push({ from: e.target.value })}
        style={inputStyle}
        aria-label="From date"
      />
      <span style={{ color: 'var(--text-3)', fontSize: 12 }}>→</span>
      <input
        type="date"
        value={currentTo}
        min={currentFrom}
        max={new Date().toISOString().slice(0, 10)}
        onChange={(e) => push({ to: e.target.value })}
        style={inputStyle}
        aria-label="To date"
      />
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  padding: '5px 8px',
  borderRadius: 6,
  border: '1px solid var(--border)',
  background: 'var(--bg-elev)',
  color: 'var(--text)',
  fontSize: 12,
  cursor: 'pointer',
}
