/**
 * sparkline.tsx
 * Lightweight pure-SVG sparkline — no recharts dependency.
 * Renders a polyline from a data array. Zero deps beyond React.
 */
'use client'

type Props = {
  data: number[]
  color?: string
  width?: number
  height?: number
  strokeWidth?: number
}

export function Sparkline({
  data,
  color = 'var(--accent)',
  width = 120,
  height = 36,
  strokeWidth = 1.5,
}: Props) {
  if (data.length < 2) {
    return <svg width={width} height={height} aria-hidden="true" />
  }

  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1

  const pad = 2
  const innerW = width - pad * 2
  const innerH = height - pad * 2

  const points = data
    .map((v, i) => {
      const x = pad + (i / (data.length - 1)) * innerW
      const y = pad + (1 - (v - min) / range) * innerH
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden="true"
      style={{ display: 'block', overflow: 'visible' }}
    >
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
