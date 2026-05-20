'use client'

import { Eye, MousePointerClick, ShoppingBag, DollarSign, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { useI18n } from '@/i18n'
import { ResponsiveContainer, LineChart, Line, YAxis } from 'recharts'
export type TimeSeriesPoint = {
    date: string
    value: number
}

type DashboardStatsProps = {
    views: number
    leads: number
    engagement: number
    revenue?: number
    pendingOrdersCount?: number
    currency?: string
    preferences?: string[]
    viewsSeries?: TimeSeriesPoint[]
    leadsSeries?: TimeSeriesPoint[]
    engagementSeries?: TimeSeriesPoint[]
    revenueSeries?: TimeSeriesPoint[]
    viewsChange?: number
    leadsChange?: number
    engagementChange?: number
    revenueChange?: number
}

const TrendBadge = ({ change = 0 }: { change?: number }) => {
    if (change > 0) {
        return (
            <div className="flex items-center gap-1 px-2 py-[2px] h-[26px] bg-[#00C950] bg-opacity-10 border border-[#00C950]/20 rounded-[12px]">
                <TrendingUp className="w-3 h-3 text-[#05DF72]" strokeWidth={2.5} />
                <span className="text-[12px] font-semibold text-[#05DF72] leading-none">+{change.toFixed(1)}%</span>
            </div>
        )
    }
    if (change < 0) {
        return (
            <div className="flex items-center gap-1 px-2 py-[2px] h-[26px] bg-[#FB2C36] bg-opacity-10 border border-[#FB2C36]/20 rounded-[12px]">
                <TrendingDown className="w-3 h-3 text-[#FF6467]" strokeWidth={2.5} />
                <span className="text-[12px] font-semibold text-[#FF6467] leading-none">{change.toFixed(1)}%</span>
            </div>
        )
    }
    return (
        <div className="flex items-center gap-1 px-2 py-[2px] h-[26px] bg-slate-500 bg-opacity-10 border border-slate-500/20 rounded-[12px]">
            <Minus className="w-3 h-3 text-slate-400" strokeWidth={2.5} />
            <span className="text-[12px] font-semibold text-slate-400 leading-none">0%</span>
        </div>
    )
}

// Sparkline Components mapped to exactly match Figma mockups
const Sparkline = ({ data, color }: { data: TimeSeriesPoint[], color: string }) => {
    // If no data, render a fast empty path to preserve layout
    if (!data || data.length <= 1) {
        return null
    }

    return (
        <div className="w-full h-[40px] opacity-60 mt-1">
            <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data}>
                    <YAxis domain={['dataMin', 'dataMax']} hide />
                    <Line 
                        type="linear" 
                        dataKey="value" 
                        stroke={color} 
                        strokeWidth={4.5} 
                        dot={false}
                        isAnimationActive={false}
                    />
                </LineChart>
            </ResponsiveContainer>
        </div>
    )
}

export function DashboardStats(props: DashboardStatsProps) {
    const { t } = useI18n()
    // TODO: Add 'revenue' back to defaultOrder when F10 is ready
    const defaultOrder = ['views', 'leads', 'engagement']
    const order = (props.preferences || defaultOrder).filter(key => key !== 'revenue')
    
    // Custom container styles matching the Figma UI exactly
    const cardClassName = "relative flex-1 min-w-0 flex flex-col justify-between rounded-[16px] border border-solid border-white/10 bg-[#1E293B] p-5 shadow-sm transition-colors duration-200 hover:border-blue-500 cursor-pointer overflow-hidden min-h-[260px]"

    const STAT_CARDS = {
      views: (
        <div className={cardClassName} key="views" data-testid="stat-card-views">
            {/* Top Row: Icon Container and Badge */}
            <div className="flex items-start justify-between mb-4 relative z-10">
                <div className="w-12 h-12 rounded-[16px] bg-gradient-to-br from-[#3B82F6] to-[#2563EB] shadow-[0px_4px_6px_-4px_rgba(0,0,0,0.1),_0px_10px_15px_-3px_rgba(0,0,0,0.1)] flex items-center justify-center">
                    <Eye className="h-6 w-6 text-white" strokeWidth={2.5} />
                </div>
                <TrendBadge change={props.viewsChange} />
            </div>

            {/* Middle Row: Text and Value */}
            <div className="flex flex-col gap-2 mb-4 relative z-10">
                <span className="text-[18px] text-slate-50/60 font-medium">{t.dashboard.overview.stats.views}</span>
                <span className="text-[48px] font-bold text-[#F8FAFC] tracking-tight leading-none">{props.views.toLocaleString()}</span>
            </div>
            
            {/* Bottom Row: Sparkline */}
            <div className="mt-auto -mx-5 -mb-5 relative">
                <Sparkline data={props.viewsSeries || []} color="#3b82f6" />
            </div>
        </div>
      ),
      leads: (
        <div className={cardClassName} key="leads" data-testid="stat-card-leads">
            {/* Top Row: Icon Container and Badge */}
            <div className="flex items-start justify-between mb-4 relative z-10">
                <div className="w-12 h-12 rounded-[16px] bg-gradient-to-br from-[#2DD4BF] to-[#14B8A6] shadow-[0px_4px_6px_-4px_rgba(0,0,0,0.1),_0px_10px_15px_-3px_rgba(0,0,0,0.1)] flex items-center justify-center">
                    <MousePointerClick className="h-6 w-6 text-white" strokeWidth={2.5} />
                </div>
                <TrendBadge change={props.leadsChange} />
            </div>

            {/* Middle Row: Text and Value */}
            <div className="flex flex-col gap-2 mb-4 relative z-10">
                <span className="text-[18px] text-slate-50/60 font-medium">{t.dashboard.overview.stats.leads}</span>
                <span className="text-[48px] font-bold text-[#F8FAFC] tracking-tight leading-none">{props.leads.toLocaleString()}</span>
            </div>
            
            {/* Bottom Row: Sparkline */}
            <div className="mt-auto -mx-5 -mb-5 relative">
                <Sparkline data={props.leadsSeries || []} color="#ef4444" />
            </div>
        </div>
      ),
      engagement: (
        <div className={cardClassName} key="engagement" data-testid="stat-card-engagement">
            {/* Top Row: Icon Container and Badge */}
            <div className="flex items-start justify-between mb-4 relative z-10">
                <div className="w-12 h-12 rounded-[16px] bg-gradient-to-br from-[#A29BFE] to-[#6C5CE7] shadow-[0px_4px_6px_-4px_rgba(0,0,0,0.1),_0px_10px_15px_-3px_rgba(0,0,0,0.1)] flex items-center justify-center">
                    <ShoppingBag className="h-6 w-6 text-white" strokeWidth={2.5} />
                </div>
                <TrendBadge change={props.engagementChange} />
            </div>

            {/* Middle Row: Text and Value */}
            <div className="flex flex-col gap-2 mb-4 relative z-10">
                <span className="text-[18px] text-slate-50/60 font-medium">{t.dashboard.overview.stats.engagement}</span>
                <span className="text-[48px] font-bold text-[#F8FAFC] tracking-tight leading-none">{props.engagement.toLocaleString()}</span>
            </div>
            
            {/* Bottom Row: Sparkline */}
            <div className="mt-auto -mx-5 -mb-5 relative">
                <Sparkline data={props.engagementSeries || []} color="#a29bfe" />
            </div>
        </div>
      ),

      revenue: (
        <div className={cardClassName} key="revenue" data-testid="stat-card-revenue">
            {/* Top Row: Icon Container and Badge */}
            <div className="flex items-start justify-between mb-4 relative z-10">
                <div className="w-12 h-12 rounded-[16px] bg-gradient-to-br from-[#10B981] to-[#059669] shadow-[0px_4px_6px_-4px_rgba(0,0,0,0.1),_0px_10px_15px_-3px_rgba(0,0,0,0.1)] flex items-center justify-center">
                    <DollarSign className="h-6 w-6 text-white" strokeWidth={2.5} />
                </div>
                <TrendBadge change={props.revenueChange} />
            </div>

            {/* Middle Row: Text and Value */}
            <div className="flex flex-col gap-2 mb-4 relative z-10">
                <span className="text-[18px] text-slate-50/60 font-medium">{t.dashboard.overview.stats.revenue}</span>
                <span className="text-[48px] font-bold text-[#F8FAFC] tracking-tight leading-none">
                    {new Intl.NumberFormat('ms-MY', { style: 'currency', currency: props.currency, minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(props.revenue || 0)}
                </span>
            </div>
            
            {/* Bottom Row: Sparkline */}
            <div className="mt-auto -mx-5 -mb-5 relative">
                <Sparkline data={props.revenueSeries || []} color="#10b981" />
            </div>
        </div>
      )
    }

    return (
        <div className="contents">
            {order.map(key => STAT_CARDS[key as keyof typeof STAT_CARDS] || null)}
        </div>
    )
}
