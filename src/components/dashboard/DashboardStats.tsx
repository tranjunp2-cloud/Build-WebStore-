'use client'

import { Eye, MousePointerClick, ShoppingCart, DollarSign } from 'lucide-react'
import { useI18n } from '@/i18n'

type DashboardStatsProps = {
    views: number
    leads: number
    engagement: number
    revenue: number
    pendingOrdersCount: number
    currency: string
    preferences?: string[]
}

export function DashboardStats(props: DashboardStatsProps) {
    const { t } = useI18n()
    const defaultOrder = ['views', 'leads', 'engagement', 'revenue']
    const order = props.preferences || defaultOrder
    
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
                <ShoppingCart className="h-4 w-4 text-amber-400" />
            </div>
            <p className="mt-2 md:mt-3 text-lg md:text-2xl font-bold text-white break-words">{props.engagement.toLocaleString()}</p>
        </div>
      ),
      revenue: (
        <div className="flex flex-col justify-between rounded-xl border border-white/10 bg-[#1E293B] p-3 md:p-5" key="revenue">
            <div className="flex items-center justify-between mb-1 md:mb-0">
                <span className="text-xs md:text-sm font-medium text-gray-400 line-clamp-1">{t.dashboard.overview.stats.revenue}</span>
                <DollarSign className="h-4 w-4 text-purple-400" />
            </div>
            <p className="mt-0 md:mt-3 text-base md:text-2xl font-bold text-white break-words">{props.currency} {props.revenue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</p>
            <p className="mt-1 text-[10px] md:text-xs text-gray-500 leading-tight md:leading-normal line-clamp-2 md:line-clamp-none" title={t.dashboard.overview.stats.pendingOrders.replace('{count}', props.pendingOrdersCount.toString())}>
                {t.dashboard.overview.stats.pendingOrders.replace('{count}', props.pendingOrdersCount.toString())}
            </p>
        </div>
      )
    }

    return (
        <div className="grid grid-cols-2 gap-3 md:gap-4 md:grid-cols-4">
            {order.map(key => STAT_CARDS[key as keyof typeof STAT_CARDS] || null)}
        </div>
    )
}
