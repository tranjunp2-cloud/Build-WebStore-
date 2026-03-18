'use client'

import Link from 'next/link'
import { ArrowRight, Clock, AlertCircle } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { useI18n } from '@/i18n'

export function DashboardActionList({ pendingOrders }: { pendingOrders: any[] }) {
    const { t, locale } = useI18n()

    return (
        <div className="flex flex-col rounded-xl border border-white/10 bg-[#1E293B] shadow-sm">
            <div className="flex items-center justify-between border-b border-white/5 px-6 py-5">
                <div className="flex items-center gap-2">
                    <AlertCircle className="h-5 w-5 text-amber-500" />
                    <h3 className="font-bold text-white">{t.dashboard.overview.actions.title}</h3>
                </div>
                <Link href="/dashboard/orders?status=pending" className="text-sm font-medium text-blue-400 hover:text-blue-300">
                    {t.dashboard.overview.actions.viewAll} <ArrowRight className="inline h-4 w-4" />
                </Link>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4">
                {pendingOrders.length === 0 ? (
                    <div className="flex h-full items-center justify-center text-sm text-gray-500">
                        {t.dashboard.overview.actions.empty}
                    </div>
                ) : (
                    <div className="space-y-4">
                        {pendingOrders.map((order) => (
                            <div key={order.id} className="flex items-center justify-between rounded-lg border border-white/5 bg-[#0F172A] p-4 transition-colors hover:bg-white/[0.02]">
                                <div className="flex flex-col gap-1">
                                    <span className="font-semibold text-white">{order.orderNumber}</span>
                                    <span className="text-sm text-gray-400">
                                        {order.customerName} • {order.currency} {order.total.toLocaleString()}
                                    </span>
                                </div>
                                
                                <div className="flex items-center gap-4">
                                    <div className="flex items-center gap-1.5 text-xs text-amber-400">
                                        <Clock className="h-3.5 w-3.5" />
                                        {formatDistanceToNow(new Date(order.createdAt), { addSuffix: true })}
                                    </div>
                                    <Link 
                                        href={`/dashboard/orders/${order.id}`}
                                        className="rounded bg-white/10 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/20"
                                    >
                                        {t.dashboard.overview.actions.fulfill}
                                    </Link>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
