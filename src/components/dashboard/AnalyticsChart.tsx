'use client'

import React, { useRef, useEffect } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  Tooltip,
  ResponsiveContainer,
  Rectangle
} from 'recharts'
import { BarChart3 } from 'lucide-react'
import { useI18n } from '@/i18n'

export type ChartData = {
  date: string
  views: number
  clicks: number
}

// Extract component outside to prevent recreating on every render
interface ActiveBarProps {
    x?: number
    y?: number
    width?: number
    height?: number
    payload?: { date?: string; views?: number }
    tooltipRef: React.RefObject<HTMLDivElement | null>
    viewsLabel: string
}

const CustomActiveBar = (props: ActiveBarProps) => {
    const { x = 0, y = 0, width = 0, height = 0, payload, tooltipRef, viewsLabel } = props

    // Direct DOM manipulation to avoid infinite React state loops
    useEffect(() => {
        if (tooltipRef?.current) {
            const el = tooltipRef.current
            const parent = el.parentElement
            const parentWidth = parent?.offsetWidth || 300
            // Center above bar, clamp within container
            let left = x + width / 2
            const tooltipWidth = el.offsetWidth || 120
            left = Math.max(tooltipWidth / 2, Math.min(left, parentWidth - tooltipWidth / 2))
            el.style.display = 'block'
            el.style.left = `${left}px`
            el.style.top = `${y + 16}px`
            el.innerHTML = `${payload?.date} — ${Number(payload?.views || 0).toLocaleString()} ${viewsLabel}`
        }
    }, [x, y, width, payload?.date, payload?.views, tooltipRef, viewsLabel])

    return <Rectangle x={x} y={y} width={width} height={height} fill="url(#primaryGradient)" radius={[2, 2, 0, 0]} stroke="none" />
}

export function AnalyticsChart({ data }: { data: ChartData[] }) {
    const { t } = useI18n()
    const tooltipRef = useRef<HTMLDivElement>(null)

    if (!data || data.length === 0) return null

    // Figma matches: bg-[#161E2E], border-[#1F2937], border-radius: 12px (rounded-xl)
    return (
        <div className="bg-[#161E2E] border border-[#1F2937] rounded-xl p-6 shadow-sm mb-6 w-full">
            <div className="text-base font-bold text-white mb-4 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 shrink-0" aria-hidden />
                {t.dashboard.analytics.chart}
            </div>
            
            <div className="h-[280px] w-full pt-4 relative">
                {/* Custom absolute HTML tooltip using DOM manipulation for performance */}
                <div 
                    ref={tooltipRef}
                    className="bg-[hsl(var(--popover))] text-[hsl(var(--popover-foreground))] px-3 py-1.5 rounded text-xs font-semibold whitespace-nowrap shadow-xl border border-solid border-[hsl(var(--border))] absolute z-50 pointer-events-none transition-all duration-75"
                    style={{
                        display: 'none',
                        transform: 'translate(-50%, calc(-100% - 8px))', // Move up above the bar
                    }}
                />

                <style>{`
                    .recharts-wrapper, .recharts-wrapper svg, .recharts-surface,
                    .recharts-wrapper *:focus, .recharts-wrapper *:active {
                        outline: none !important;
                        border: none !important;
                        -webkit-tap-highlight-color: transparent !important;
                    }
                    .recharts-tooltip-cursor, .recharts-active-shape rect {
                        stroke: none !important;
                        fill: transparent !important;
                    }
                `}</style>
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                        data={data}
                        margin={{ top: 40, right: 0, left: 0, bottom: 0 }}
                        barCategoryGap={2}
                        onMouseLeave={() => {
                            if (tooltipRef.current) tooltipRef.current.style.display = 'none'
                        }}
                    >
                        <defs>
                            <linearGradient id="primaryGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#3B82F6" />
                                <stop offset="100%" stopColor="#2DD4BF" />
                            </linearGradient>
                        </defs>

                        {/* Match HTML: No YAxis or Grid, just bottom labels */}
                        <XAxis
                            dataKey="date"
                            stroke="var(--dash-text-muted)"
                            tick={{ fill: 'var(--dash-text-muted)' }}
                            fontSize={10}
                            tickLine={false}
                            axisLine={false}
                            dy={10}
                            interval={data.length > 14 ? Math.ceil(data.length / 7) - 1 : data.length > 7 ? 1 : 0}
                        />
                        
                        <Tooltip
                            cursor={false}
                            content={() => null}
                        />
                        
                        {/* Match Figma exactly: large edge-to-edge bars, thin gaps, blue top, cyan bottom */}
                        <Bar 
                            dataKey="views" 
                            fill="url(#primaryGradient)" 
                            radius={[2, 2, 0, 0]} 
                            isAnimationActive={false}
                            activeBar={<CustomActiveBar tooltipRef={tooltipRef} viewsLabel={t.dashboard.analytics.views} />}
                        />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
    )
}
