'use client'

import { Eye, MousePointerClick, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { useI18n } from '@/i18n'

type Props = {
    currentViews: number
    prevViews: number
    currentClicks: number
    prevClicks: number
}

export function AnalyticsSummaryCards({ currentViews, prevViews, currentClicks, prevClicks }: Props) {
    const { t } = useI18n()

    const calcChange = (current: number, prev: number) => {
        if (prev === 0) return current > 0 ? 100 : 0
        return ((current - prev) / prev) * 100
    }

    const viewsChange = calcChange(currentViews, prevViews)
    const clicksChange = calcChange(currentClicks, prevClicks)

    const renderTrend = (change: number) => {
        if (change > 0) return <span className="flex items-center gap-1 text-emerald-400"><TrendingUp className="h-3 w-3" /> +{change.toFixed(1)}%</span>
        if (change < 0) return <span className="flex items-center gap-1 text-rose-400"><TrendingDown className="h-3 w-3" /> {change.toFixed(1)}%</span>
        return <span className="flex items-center gap-1 text-gray-500"><Minus className="h-3 w-3" /> 0%</span>
    }

    return (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {/* Views Card */}
            <div className="flex flex-col rounded-xl border border-white/10 bg-[#1E293B]/30 p-5 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                    <Eye className="h-4 w-4 text-blue-400" />
                    <span className="text-xs font-medium text-gray-400">{t.dashboard.analytics.views}</span>
                </div>
                <div className="flex items-end justify-between mt-2">
                    <p className="text-3xl font-bold text-white">{currentViews.toLocaleString()}</p>
                    <div className="text-xs mb-1">
                        {renderTrend(viewsChange)}
                    </div>
                </div>
            </div>

            {/* Clicks Card */}
            <div className="flex flex-col rounded-xl border border-white/10 bg-[#1E293B]/30 p-5 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                    <MousePointerClick className="h-4 w-4 text-emerald-400" />
                    <span className="text-xs font-medium text-gray-400">{t.dashboard.analytics.clicks}</span>
                </div>
                <div className="flex items-end justify-between mt-2">
                    <p className="text-3xl font-bold text-white">{currentClicks.toLocaleString()}</p>
                    <div className="text-xs mb-1">
                        {renderTrend(clicksChange)}
                    </div>
                </div>
            </div>
        </div>
    )
}
