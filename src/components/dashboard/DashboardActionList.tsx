'use client'

import Link from 'next/link'
import { formatDistanceToNowStrict } from 'date-fns'
import { useI18n } from '@/i18n'
import { ArrowRight } from 'lucide-react'

export interface PendingOrder {
    id: string | number
    orderNumber?: string
    customerName?: string
    createdAt: string | Date
    currency?: string
    total?: number
    items?: Array<{ quantity?: number }>
}

export function DashboardActionList({ pendingOrders }: { pendingOrders: PendingOrder[] }) {
    const { t } = useI18n()

    return (
        <div className="rounded-[16px] border border-white/10 bg-[#1E293B] flex flex-col p-6 h-full min-h-[400px]">
            <div className="flex items-center justify-between mb-[40px]">
                <h2 className="text-[18px] font-semibold text-[#F8FAFC] tracking-tight leading-[1.55]">
                    {t.dashboard.overview.actions.title}
                </h2>
            </div>

            <div className="flex-1 flex flex-col gap-3 overflow-y-auto">
                {pendingOrders.length === 0 ? (
                    <div className="flex h-full items-center justify-center text-sm text-[#9CA3AF]">
                        {t.dashboard.overview.actions.empty}
                    </div>
                ) : (
                    pendingOrders.map((order) => {
                        const totalItems = order.items?.reduce((sum: number, item: { quantity?: number }) => sum + (item.quantity || 1), 0) || 0
                        const orderNum = order.orderNumber?.startsWith('#') || order.orderNumber?.startsWith('Order') 
                            ? order.orderNumber 
                            : `Order #${order.orderNumber}`
                        const currencySymbol = order.currency === 'MYR' ? 'RM' : (order.currency || 'RM')

                        return (
                            <Link 
                                href={`/orders/${order.id}`}
                                key={order.id} 
                                className="flex items-center justify-between py-3 px-4 rounded-lg border border-[#1F2937] hover:border-[#3B82F6] hover:bg-white/5 cursor-pointer transition-colors duration-200 group no-underline"
                            >
                                <div className="flex flex-col gap-[2px] max-w-[60%] shrink-0 overflow-hidden">
                                    <div className="text-[13px] font-semibold text-white leading-[1.69] truncate">
                                        {orderNum} — {order.customerName}
                                    </div>
                                    <div className="text-[12px] text-[#9CA3AF] leading-[1.83] truncate">
                                        {t.dashboard.overview.pendingLabel} · {totalItems} {t.dashboard.overview.itemsLabel} · {formatDistanceToNowStrict(new Date(order.createdAt), { addSuffix: true })}
                                    </div>
                                </div>
                                
                                <div className="text-[14px] font-bold text-[#F59E0B] leading-[1.57]">
                                    {currencySymbol} {order.total?.toLocaleString() || '0'}
                                </div>
                                <ArrowRight className="w-[18px] h-[18px] text-[#9CA3AF] group-hover:translate-x-1 group-hover:text-blue-500 transition-all duration-200" strokeWidth={1.5} />
                            </Link>
                        )
                    })
                )}
            </div>

            <div className="mt-4">
                <Link href="/orders?status=pending" className="inline-flex items-center gap-1 py-2 text-[13px] font-semibold text-[#3B82F6] hover:underline transition-all no-underline group">
                    {t.dashboard.overview.actions.viewAll} <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-all" />
                </Link>
            </div>
        </div>
    )
}
