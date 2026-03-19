'use client'

import { useI18n } from '@/i18n'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts'

export type ChartData = {
  date: string
  views: number
  clicks: number
}

export function AnalyticsChart({ data }: { data: ChartData[] }) {
    const { t } = useI18n()

    if (!data || data.length === 0) return null

    return (
        <div className="h-[400px] w-full rounded-xl border border-white/10 bg-[#1E293B] p-6 shadow-sm">
            <h3 className="mb-6 font-bold text-white">{t.dashboard.analytics.chart}</h3>
            <ResponsiveContainer width="100%" height="100%">
                <BarChart
                    data={data}
                    margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                >
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                    <XAxis 
                        dataKey="date" 
                        stroke="#94A3B8" 
                        fontSize={12} 
                        tickLine={false} 
                        axisLine={false} 
                        minTickGap={30}
                    />
                    <YAxis 
                        stroke="#94A3B8" 
                        fontSize={12} 
                        tickLine={false} 
                        axisLine={false} 
                        tickFormatter={(value) => (value > 999 ? `${(value / 1000).toFixed(1)}k` : value)}
                    />
                    <Tooltip 
                        contentStyle={{ backgroundColor: '#0F172A', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff' }}
                        itemStyle={{ color: '#fff' }}
                        cursor={{ fill: '#334155', opacity: 0.4 }}
                    />
                    <Legend wrapperStyle={{ paddingTop: '20px', fontSize: '13px' }} />
                    <Bar dataKey="views" name={t.dashboard.analytics.views} fill="#3B82F6" radius={[4, 4, 0, 0]} maxBarSize={40} />
                    <Bar dataKey="clicks" name={t.dashboard.analytics.clicks} fill="#10B981" radius={[4, 4, 0, 0]} maxBarSize={40} />
                </BarChart>
            </ResponsiveContainer>
        </div>
    )
}
