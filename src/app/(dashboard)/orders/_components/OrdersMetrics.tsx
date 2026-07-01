"use client"

import React, { useState, useEffect, useCallback } from 'react'
import { Clock, CheckCircle2, Package, Truck, XCircle } from 'lucide-react'
import { useI18n } from '@/i18n'

export function OrdersMetrics({ refreshCounter = 0 }: { refreshCounter?: number }) {
    const { t } = useI18n()
    const o = t.dashboard.orders
    const [counts, setCounts] = useState({ pending: 0, readyToShip: 0, confirmed: 0, shipped: 0, cancelled: 0 })

    const fetchMetrics = useCallback(async () => {
        try {
            const res = await fetch('/api/orders/metrics')
            const json = await res.json()
            if (json.success && json.data) {
                setCounts(json.data)
            }
        } catch (err) {
            console.error('Failed to load metrics:', err)
        }
    }, [])

    // Refresh when parent triggers (bulk actions, order updates)
    useEffect(() => {
        fetchMetrics()
    }, [refreshCounter, fetchMetrics])

    // Refresh on real-time order notifications (new order or status update)
    useEffect(() => {
        function handleNotification(e: Event) {
            const detail = (e as CustomEvent).detail
            if (detail?.type === 'ORDER_NEW' || detail?.type === 'ORDER_UPDATED') {
                fetchMetrics()
            }
        }
        window.addEventListener('notification-toast', handleNotification)
        return () => window.removeEventListener('notification-toast', handleNotification)
    }, [fetchMetrics])

    const metrics = [
        {
            label: o.metrics.pending,
            value: counts.pending,
            icon: <Clock className="w-4 h-4 md:w-5 md:h-5 text-[hsl(var(--warning))]" />,
            iconBg: 'bg-[hsl(var(--warning)/0.1)]',
        },
        {
            label: o.metrics.readyToShip,
            value: counts.readyToShip,
            icon: <Package className="w-4 h-4 md:w-5 md:h-5 text-[hsl(var(--info))]" />,
            iconBg: 'bg-[hsl(var(--info)/0.1)]',
        },
        {
            label: o.status.confirmed,
            value: counts.confirmed,
            icon: <CheckCircle2 className="w-4 h-4 md:w-5 md:h-5 text-[hsl(var(--info))]" />,
            iconBg: 'bg-[hsl(var(--info)/0.1)]',
        },
        {
            label: o.metrics.shipped,
            value: counts.shipped,
            icon: <Truck className="w-4 h-4 md:w-5 md:h-5 text-[hsl(var(--success))]" />,
            iconBg: 'bg-[hsl(var(--success)/0.1)]',
        },
        {
            label: o.metrics.cancelled,
            value: counts.cancelled,
            icon: <XCircle className="w-4 h-4 md:w-5 md:h-5 text-[hsl(var(--destructive))]" />,
            iconBg: 'bg-[hsl(var(--destructive)/0.1)]',
        },
    ]

    return (
        <div className="grid grid-cols-3 md:grid-cols-5 gap-2 md:gap-3 xl:gap-[22px] w-full">
            {metrics.map((item, index) => (
                <div
                    key={index}
                    // 5-in-a-row from md → compact below xl so all five status cards fit small on iPad.
                    // Extra-small tier on mobile (< md, 2-col): smaller padding/icon/value/label; md
                    // restores the iPad size and xl the desktop size (both unchanged).
                    className="xl:h-[84px] bg-dash-surface border border-dash-border rounded-2xl p-1.5 md:p-2 xl:p-[17px] flex items-center gap-1 md:gap-1.5 xl:gap-[12px]"
                >
                    {/* Icon Container */}
                    <div
                        className={`w-7 h-7 md:w-8 md:h-8 xl:w-10 xl:h-10 rounded-lg md:rounded-xl xl:rounded-2xl flex items-center justify-center shrink-0 ${item.iconBg}`}
                    >
                        {item.icon}
                    </div>

                    {/* Text Container */}
                    <div className="flex flex-col justify-center min-w-0">
                        <span className="text-base md:text-lg xl:text-2xl font-bold text-slate-50 leading-5 md:leading-6 xl:leading-8">
                            {item.value}
                        </span>
                        <span className="text-[10px] md:text-[11px] xl:text-xs font-normal text-slate-400 leading-[13px] md:leading-[14px] xl:leading-[16px]">
                            {item.label}
                        </span>
                    </div>
                </div>
            ))}
        </div>
    )
}
