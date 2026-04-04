'use client'

import { Eye, MousePointerClick, BarChart3 } from 'lucide-react'
import { useI18n } from '@/i18n'

type DashboardStatsProps = {
    views: number
    leads: number
    engagement: number
    preferences?: string[]
}

export function DashboardStats(props: DashboardStatsProps) {
    const { t } = useI18n()
    const defaultOrder = ['views', 'leads', 'engagement']
    const order = (props.preferences || defaultOrder).filter(k => k !== 'revenue')

    const STAT_CARDS = {
      views: (
        <div className="flex flex-col rounded-xl border border-white/10 bg-[#1E293B] p-3 md:p-5" key="views">
            <div className="flex items-center justify-between">
                <span className="text-xs md:text-sm font-medium text-gray-400 line-clamp-1">{t.dashboard.overview.stats.views}</span>
                <Eye className="h-4 w-4 text-blue-400" />
            </div>
            <p className="mt-2 md:mt-3 text-lg md:text-2xl font-bold text-white break-words">{props.views.toLocaleString()}</p>
        </div>
      ),
      leads: (
        <div className="flex flex-col rounded-xl border border-white/10 bg-[#1E293B] p-3 md:p-5" key="leads">
            <div className="flex items-center justify-between">
                <span className="text-xs md:text-sm font-medium text-gray-400 line-clamp-1">{t.dashboard.overview.stats.leads}</span>
                <MousePointerClick className="h-4 w-4 text-emerald-400" />
            </div>
            <p className="mt-2 md:mt-3 text-lg md:text-2xl font-bold text-white break-words">{props.leads.toLocaleString()}</p>
        </div>
      ),
      engagement: (
        <div className="flex flex-col rounded-xl border border-white/10 bg-[#1E293B] p-3 md:p-5" key="engagement">
            <div className="flex items-center justify-between">
                <span className="text-xs md:text-sm font-medium text-gray-400 line-clamp-1">{t.dashboard.overview.stats.engagement}</span>
                <BarChart3 className="h-4 w-4 text-amber-400" />
            </div>
            <p className="mt-2 md:mt-3 text-lg md:text-2xl font-bold text-white break-words">{props.engagement.toLocaleString()}</p>
        </div>
      ),
    }

    return (
        <div className="grid grid-cols-2 gap-3 md:gap-4 sm:grid-cols-3">
            {order.map(key => STAT_CARDS[key as keyof typeof STAT_CARDS] || null)}
        </div>
    )
}
