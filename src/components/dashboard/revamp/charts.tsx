'use client'

import { useState, useEffect, useRef, useId } from 'react'

// ─── Local number formatter ───────────────────────────────────────────────────
// Matches the design's fmtNum: full-number grouped, en-MY locale (not compact).
// e.g. 15240 → "15,240"
const fmtNum = (n: number): string =>
    new Intl.NumberFormat('en-MY').format(Math.round(n))

// ─── Local date formatter ────────────────────────────────────────────────────
// fmtDM: format date as "D/M" (e.g. "19/5") for bar chart x-axis labels.
// Accepts ISO string ('yyyy-MM-dd') or Date object.
const fmtDM = (d: string | Date): string => {
    const date = typeof d === 'string' ? new Date(d) : d
    return `${date.getDate()}/${date.getMonth() + 1}`
}

// ─── Sparkline ───────────────────────────────────────────────────────────────
// Raw SVG sparkline. Uses a unique gradient ID (via React.useId) to avoid
// hydration mismatch (replaces the design's Math.random() approach).
// CSS class: .stat-spark (styled by scoped stylesheet)
export function Sparkline({ data, color }: { data: number[]; color: string }) {
    const uid = useId()
    const gradId = `spark-grad-${uid.replace(/:/g, '')}`

    if (!data || data.length < 2) return null

    const W = 120
    const H = 40
    const min = Math.min(...data)
    const max = Math.max(...data)
    const range = max - min || 1

    // Map each data point to SVG x/y coordinates
    const points = data
        .map((v, i) => {
            const x = (i / (data.length - 1)) * W
            const y = H - ((v - min) / range) * (H - 4) - 2
            return `${x.toFixed(1)},${y.toFixed(1)}`
        })
        .join(' ')

    return (
        <svg className="stat-spark" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
            <defs>
                <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity="0.35" />
                    <stop offset="100%" stopColor={color} stopOpacity="0" />
                </linearGradient>
            </defs>
            {/* Filled area under the line */}
            <polyline
                fill={`url(#${gradId})`}
                stroke="none"
                points={`0,${H} ${points} ${W},${H}`}
            />
            {/* Stroke line */}
            <polyline
                fill="none"
                stroke={color}
                strokeWidth="2"
                strokeLinejoin="round"
                strokeLinecap="round"
                points={points}
            />
        </svg>
    )
}

// ─── BarChart ────────────────────────────────────────────────────────────────
// Hand-built SVG bar chart with hover tooltip (useState).
// CSS classes: .barchart, .bc-grid, .bc-bar, .bc-tooltip, .bc-ylabel, .bc-xlabel
// Gradient defs: barGrad (normal), barGradHi (hovered bar)

type BarDay = {
    date: string | Date
    views: number
    hour?: number
}

export function BarChart({
    days,
    isHourly = false,
}: {
    days: BarDay[]
    isHourly?: boolean
}) {
    const [hoverIdx, setHoverIdx] = useState<number | null>(null)

    if (!days || days.length === 0) return null

    const W = 340
    const H = 160
    const PAD_L = 36   // space for y-axis labels
    const PAD_B = 24   // space for x-axis labels
    const PAD_T = 8
    const PAD_R = 4

    const chartW = W - PAD_L - PAD_R
    const chartH = H - PAD_T - PAD_B

    const maxVal = Math.max(...days.map((d) => d.views), 1)

    // Y-axis grid lines & labels (4 levels: 0, 1/3, 2/3, max)
    const yTicks = [0, 1, 2, 3].map((i) => ({
        value: Math.round((maxVal * i) / 3),
        y: PAD_T + chartH - (chartH * i) / 3,
    }))

    const barW = Math.max(2, chartW / days.length - 2)
    const gap = chartW / days.length

    return (
        <div className="barchart" style={{ position: 'relative' }}>
            <svg
                viewBox={`0 0 ${W} ${H}`}
                width="100%"
                height={H}
                onMouseLeave={() => setHoverIdx(null)}
            >
                <defs>
                    <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#3B82F6" />
                        <stop offset="100%" stopColor="#2DD4BF" />
                    </linearGradient>
                    <linearGradient id="barGradHi" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#60A5FA" />
                        <stop offset="100%" stopColor="#5EEAD4" />
                    </linearGradient>
                </defs>

                {/* Grid lines */}
                {yTicks.map((tick) => (
                    <g key={tick.value} className="bc-grid">
                        <line
                            x1={PAD_L}
                            y1={tick.y}
                            x2={W - PAD_R}
                            y2={tick.y}
                            stroke="currentColor"
                            strokeOpacity="0.08"
                            strokeWidth="1"
                        />
                        {/* Y-axis labels */}
                        <text
                            x={PAD_L - 4}
                            y={tick.y + 4}
                            textAnchor="end"
                            fontSize="9"
                            className="bc-ylabel"
                            fill="currentColor"
                            fillOpacity="0.45"
                        >
                            {fmtNum(tick.value)}
                        </text>
                    </g>
                ))}

                {/* Bars */}
                {days.map((d, i) => {
                    const barH = Math.max(2, (d.views / maxVal) * chartH)
                    const x = PAD_L + i * gap + (gap - barW) / 2
                    const y = PAD_T + chartH - barH
                    const isHi = hoverIdx === i
                    const label = isHourly
                        ? String(d.hour ?? i)
                        : fmtDM(d.date)

                    return (
                        <g
                            key={i}
                            onMouseEnter={() => setHoverIdx(i)}
                            style={{ cursor: 'pointer' }}
                        >
                            {/* Invisible hit area for easier hover */}
                            <rect
                                x={PAD_L + i * gap}
                                y={PAD_T}
                                width={gap}
                                height={chartH + PAD_B}
                                fill="transparent"
                            />
                            <rect
                                className="bc-bar"
                                x={x}
                                y={y}
                                width={barW}
                                height={barH}
                                rx="3"
                                ry="3"
                                fill={isHi ? 'url(#barGradHi)' : 'url(#barGrad)'}
                                opacity={hoverIdx !== null && !isHi ? 0.55 : 1}
                            />
                            {/* X-axis label */}
                            <text
                                x={x + barW / 2}
                                y={H - 6}
                                textAnchor="middle"
                                fontSize="9"
                                className="bc-xlabel"
                                fill="currentColor"
                                fillOpacity="0.45"
                            >
                                {label}
                            </text>
                        </g>
                    )
                })}
            </svg>

            {/* Tooltip — rendered as HTML overlay for crisp text */}
            {hoverIdx !== null && (
                <div
                    className="bc-tooltip"
                    style={{
                        position: 'absolute',
                        top: 0,
                        left: `${
                            (PAD_L +
                                hoverIdx * (chartW / days.length) +
                                (chartW / days.length) / 2) /
                            W *
                            100
                        }%`,
                        transform: 'translateX(-50%)',
                        pointerEvents: 'none',
                    }}
                >
                    <span className="bc-tooltip-date">
                        {isHourly
                            ? `${days[hoverIdx].hour ?? hoverIdx}:00`
                            : fmtDM(days[hoverIdx].date)}
                    </span>
                    {' — '}
                    <span className="bc-tooltip-val">
                        {fmtNum(days[hoverIdx].views)}
                    </span>
                </div>
            )}
        </div>
    )
}

// ─── Gauge ───────────────────────────────────────────────────────────────────
// Circular progress gauge with optional requestAnimationFrame count-up animation.
// CSS classes: .gauge-wrap, .gauge, .g-center, .g-score, .g-outof, .g-label
// The circle math: r=42, circumference = 2π×42 ≈ 263.9
// strokeDashoffset = circumference × (1 - score/100)

const GAUGE_SIZE = 180
const GAUGE_STROKE = 14
const GAUGE_RADIUS = (GAUGE_SIZE - GAUGE_STROKE) / 2 // 83
const GAUGE_CIRC = 2 * Math.PI * GAUGE_RADIUS
const GAUGE_GAP = 0.28 // open arc at the bottom (~100°)

/** Score → arc colour + fallback label (unified scale: ≥80 good · ≥50 warning · else danger). */
function gaugeStatus(score: number): { color: string; label: string; labelColor: string } {
    if (score >= 80) return { color: 'var(--dr-success)', label: 'Healthy', labelColor: 'var(--dr-success-fg)' }
    if (score >= 50) return { color: 'var(--dr-warning)', label: 'Needs improvement', labelColor: 'var(--dr-warning-fg)' }
    return { color: 'var(--dr-danger)', label: 'At risk', labelColor: 'var(--dr-danger-fg)' }
}

/** Maps a score to the i18n key suffix under t.dashboard.revamp.seo.*. */
export function gaugeStatusKey(score: number): 'gaugeHealthy' | 'gaugeNeedsImprovement' | 'gaugeAtRisk' {
    if (score >= 80) return 'gaugeHealthy'
    if (score >= 50) return 'gaugeNeedsImprovement'
    return 'gaugeAtRisk'
}

export function Gauge({ score, animate = true, label }: { score: number; animate?: boolean; label?: string }) {
    const [val, setVal] = useState(animate ? 0 : score)
    const rafRef = useRef<number | null>(null)

    useEffect(() => {
        if (!animate) {
            setVal(score)
            return
        }
        const start = performance.now()
        const duration = 1100
        const tick = (now: number) => {
            const progress = Math.min((now - start) / duration, 1)
            const eased = 1 - Math.pow(1 - progress, 3)
            setVal(Math.round(eased * score))
            if (progress < 1) rafRef.current = requestAnimationFrame(tick)
        }
        rafRef.current = requestAnimationFrame(tick)
        return () => { if (rafRef.current !== null) cancelAnimationFrame(rafRef.current) }
    }, [score, animate])

    const cx = GAUGE_SIZE / 2
    const cy = GAUGE_SIZE / 2
    const arcLen = GAUGE_CIRC * (1 - GAUGE_GAP)
    const startAngle = 90 + (GAUGE_GAP * 360) / 2
    const dash = (Math.min(Math.max(val, 0), 100) / 100) * arcLen
    const { color, label: fallbackLabel, labelColor } = gaugeStatus(score)
    const displayLabel = label ?? fallbackLabel

    return (
        <div className="gauge-wrap">
            <div className="gauge" style={{ width: GAUGE_SIZE, height: GAUGE_SIZE }}>
                <svg width={GAUGE_SIZE} height={GAUGE_SIZE}>
                    {/* Track (open-bottom arc) */}
                    <circle
                        cx={cx} cy={cy} r={GAUGE_RADIUS} fill="none"
                        stroke="var(--dr-surface-3)" strokeWidth={GAUGE_STROKE}
                        strokeDasharray={`${arcLen} ${GAUGE_CIRC}`} strokeLinecap="round"
                        transform={`rotate(${startAngle} ${cx} ${cy})`}
                    />
                    {/* Progress arc — colour follows the score */}
                    <circle
                        cx={cx} cy={cy} r={GAUGE_RADIUS} fill="none"
                        stroke={color} strokeWidth={GAUGE_STROKE}
                        strokeDasharray={`${dash} ${GAUGE_CIRC}`} strokeLinecap="round"
                        transform={`rotate(${startAngle} ${cx} ${cy})`}
                        style={{ transition: animate ? 'none' : 'stroke-dasharray .8s' }}
                    />
                </svg>
                <div className="g-center">
                    <div className="g-score">{val}</div>
                    <div className="g-outof">/ 100</div>
                </div>
            </div>
            <div className="g-label" style={{ color: labelColor }}>{displayLabel}</div>
        </div>
    )
}

// ─── MiniLinePlaceholder ──────────────────────────────────────────────────────
// Placeholder for the SEO History line chart — shown while backend is pending.
// Renders a muted dashed SVG line with a subtle label.
export function MiniLinePlaceholder() {
    const w = 260
    const h = 44
    const data = [10, 14, 12, 18, 16, 22, 20, 26]
    const pts = data.map((v, i) => [(i / (data.length - 1)) * w, h - 6 - (v / 30) * (h - 12)])
    const line = pts.map((p, i) => (i === 0 ? 'M' : 'L') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ')
    return (
        <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: 44, opacity: 0.35 }} preserveAspectRatio="none" aria-label="SEO history chart — coming soon">
            <path d={line} fill="none" stroke="var(--dr-ink-4)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="4 4" />
            {pts.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r="2.5" fill="var(--dr-ink-4)" />)}
        </svg>
    )
}
