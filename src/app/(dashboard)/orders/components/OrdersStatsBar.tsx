import { Package, Clock, CheckCircle, Truck } from 'lucide-react'
import { useI18n } from '@/i18n'
import type { Order } from '../types'

export function OrdersStatsBar({ orders }: { orders: Order[] }) {
    const { t } = useI18n()
    const o = t.dashboard.orders

    const stats = {
        total: orders.length,
        pending: orders.filter(o => o.status === 'pending').length,
        confirmed: orders.filter(o => o.status === 'confirmed').length,
        shipped: orders.filter(o => o.status === 'shipped').length,
        completed: orders.filter(o => o.status === 'completed').length,
    }

    const cards = [
        { label: `${o.filters.all} ${o.orders}`, value: stats.total, icon: Package, color: 'text-gray-400', bg: 'bg-[#1E293B]/60' },
        { label: o.status.pending, value: stats.pending, icon: Clock, color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
        { label: o.status.confirmed, value: stats.confirmed, icon: CheckCircle, color: 'text-blue-400', bg: 'bg-blue-500/10' },
        { label: o.status.shipped, value: stats.shipped, icon: Truck, color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
        { label: o.status.completed, value: stats.completed, icon: CheckCircle, color: 'text-green-400', bg: 'bg-green-500/10' },
    ]

    return (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {cards.map((kpi, i) => {
                const Icon = kpi.icon
                return (
                    <div key={i} className={`rounded-xl border border-white/5 p-4 ${kpi.bg}`}>
                        <div className="flex items-center justify-between">
                            <p className="text-sm font-medium text-gray-400">{kpi.label}</p>
                            <Icon className={`h-4 w-4 ${kpi.color}`} />
                        </div>
                        <p className="mt-2 text-2xl font-bold text-white">{kpi.value}</p>
                    </div>
                )
            })}
        </div>
    )
}
