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
    if (typeof d === 'string') {
        const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d)
        if (match) return `${Number(match[3])}/${Number(match[2])}`
    }

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
            {/* Stroke line — non-scaling so the stretched viewBox doesn't thicken it */}
            <polyline
                fill="none"
                stroke={color}
                strokeWidth="1.5"
                vectorEffect="non-scaling-stroke"
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
    const wrapRef = useRef<HTMLDivElement>(null)
    const [width, setWidth] = useState(640)

    // Measure the real container width so the viewBox maps 1:1 (full-width, no squeeze/centering).
    useEffect(() => {
        const el = wrapRef.current
        if (!el) return
        const measure = () => setWidth(el.clientWidth || 640)
        measure()
        const ro = new ResizeObserver(measure)
        ro.observe(el)
        return () => ro.disconnect()
    }, [])

    if (!days || days.length === 0) return null

    const W = Math.max(width, 200)
    const H = 240
    const PAD_L = 40   // space for y-axis labels
    const PAD_B = 28   // space for x-axis labels
    const PAD_T = 12
    const PAD_R = 10

    const chartW = W - PAD_L - PAD_R
    const chartH = H - PAD_T - PAD_B

    const maxVal = Math.max(...days.map((d) => d.views), 1)

    // Y-axis grid lines & labels (4 levels: 0, 1/3, 2/3, max)
    const yTicks = [0, 1, 2, 3].map((i) => ({
        value: Math.round((maxVal * i) / 3),
        y: PAD_T + chartH - (chartH * i) / 3,
    }))

    const gap = chartW / days.length
    const barW = Math.max(2, Math.min(gap - 6, 32)) // cap so a few bars don't become huge
    const everyX = isHourly ? 3 : days.length > 14 ? Math.ceil(days.length / 10) : 1 // thin x-labels

    return (
        <div className="barchart" ref={wrapRef} style={{ position: 'relative', width: '100%' }}>
            <svg
                viewBox={`0 0 ${W} ${H}`}
                width="100%"
                height={H}
                preserveAspectRatio="none"
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

                {/* Grid lines. Key by index, NOT tick.value — with small maxVal the rounded
                    tick values collide (maxVal 2 → 0,1,1,2) and duplicate keys break React.
                    A collided value also skips its label so the axis never shows "1" twice. */}
                {yTicks.map((tick, i) => (
                    <g key={i} className="bc-grid">
                        {/* colour + stroke-width from .bc-grid line CSS — no inline opacity */}
                        <line x1={PAD_L} y1={tick.y} x2={W - PAD_R} y2={tick.y} />
                        {/* Y-axis labels — colour/size from .bc-ylabel CSS */}
                        {(i === 0 || tick.value !== yTicks[i - 1].value) && (
                            <text x={PAD_L - 6} y={tick.y + 4} textAnchor="end" className="bc-ylabel">
                                {fmtNum(tick.value)}
                            </text>
                        )}
                    </g>
                ))}

                {/* Axis baselines — Y (left) + X (bottom), stronger than grid */}
                <line className="bc-axis" x1={PAD_L} y1={PAD_T} x2={PAD_L} y2={PAD_T + chartH} />
                <line className="bc-axis" x1={PAD_L} y1={PAD_T + chartH} x2={W - PAD_R} y2={PAD_T + chartH} />

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
                            {/* X-axis label (thinned to avoid overlap on dense series) */}
                            {(i % everyX === 0 || i === days.length - 1) && (
                                <text x={x + barW / 2} y={H - 8} textAnchor="middle" className="bc-xlabel">
                                    {label}
                                </text>
                            )}
                        </g>
                    )
                })}
            </svg>

            {/* Tooltip — rendered as HTML overlay for crisp text.
                Anchored to the TOP OF THE HOVERED BAR (not the chart top): the svg maps
                1:1 to px (viewBox height = rendered height), so the bar's y works as CSS top. */}
            {hoverIdx !== null && (
                <div
                    className="bc-tooltip"
                    style={{
                        position: 'absolute',
                        top: `${PAD_T + chartH - Math.max(2, (days[hoverIdx].views / maxVal) * chartH)}px`,
                        left: `${
                            (PAD_L +
                                hoverIdx * (chartW / days.length) +
                                (chartW / days.length) / 2) /
                            W *
                            100
                        }%`,
                        transform: 'translate(-50%, calc(-100% - 6px))',
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
