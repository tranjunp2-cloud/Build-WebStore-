"use client"

import React, { useState, useEffect, useCallback } from 'react'
import { Clock, CheckCircle2, Package, Truck, XCircle, RotateCcw } from 'lucide-react'
import { useI18n } from '@/i18n'

export function OrdersMetrics({ refreshCounter = 0 }: { refreshCounter?: number }) {
    const { t } = useI18n()
    const o = t.dashboard.orders
    const [counts, setCounts] = useState({ pending: 0, confirmed: 0, readyToShip: 0, shipped: 0, completed: 0, cancelled: 0, refunded: 0 })

    const fetchMetrics = useCallback(async () => {
        try {
            const res = await fetch('/api/orders/metrics')
            const json = await res.json()
            if (json.success && json.data) {
                setCounts(prev => ({ ...prev, ...json.data }))
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
            icon: <Clock className="w-5 h-5 text-[hsl(var(--warning))]" />,
            iconBg: 'bg-[hsl(var(--warning)/0.1)]',
        },
        {
            label: o.status.confirmed,
            value: counts.confirmed,
            icon: <CheckCircle2 className="w-5 h-5 text-[hsl(var(--info))]" />,
            iconBg: 'bg-[hsl(var(--info)/0.1)]',
        },
        {
            label: o.metrics.readyToShip,
            value: counts.readyToShip,
            icon: <Package className="w-5 h-5 text-[hsl(var(--info))]" />,
            iconBg: 'bg-[hsl(var(--info)/0.1)]',
        },
        {
            label: o.metrics.shipped,
            value: counts.shipped,
            icon: <Truck className="w-5 h-5 text-[hsl(var(--success))]" />,
            iconBg: 'bg-[hsl(var(--success)/0.1)]',
        },
        {
            label: o.metrics.completed,
            value: counts.completed,
            icon: <CheckCircle2 className="w-5 h-5 text-[hsl(var(--success))]" />,
            iconBg: 'bg-[hsl(var(--success)/0.1)]',
        },
        {
            label: o.metrics.cancelled,
            value: counts.cancelled,
            icon: <XCircle className="w-5 h-5 text-[hsl(var(--destructive))]" />,
            iconBg: 'bg-[hsl(var(--destructive)/0.1)]',
        },
        {
            label: o.status.refunded,
            value: counts.refunded,
            icon: <RotateCcw className="w-5 h-5 text-fuchsia-500" />,
            iconBg: 'bg-fuchsia-500/10',
        },
    ]

    return (
        // Mobile + tablet (<xl, incl. iPad mini/Air/Pro, sidebar open or closed):
        // 1-row horizontal scroll, snap per card (GH-1490 issue 1). Real-device testing
        // showed a forced 7-col grid doesn't reliably fit anywhere below true desktop —
        // the dashboard sidebar is a user-toggled 246-250px rail independent of viewport
        // width (`src/components/dashboard/Sidebar.tsx`), so no tablet-range breakpoint
        // can guarantee 7 equal columns fit while the sidebar may be expanded.
        // `sidebar-scroll` (F18 #1138) gives a thin, faint scrollbar instead of hiding it —
        // signals to the user there's more to scroll, without looking like a full scrollbar.
        // xl+ (1280px, desktop): 7-col grid, one row, no wrap (GH-1490 issue 2). Sizing stays
        // COMPACT (mobile-size icon/padding/gaps/font) through this tier — only bumps up to
        // the bigger desktop look at 2xl (1536px) — so the tightest realistic case (1280-1535
        // width, sidebar expanded) still has enough per-card room for the label to fit on one
        // line instead of being cut off.
        <div className="flex overflow-x-auto sidebar-scroll snap-x snap-mandatory gap-3 pb-1 xl:grid xl:grid-cols-7 xl:overflow-visible xl:snap-none xl:pb-0 2xl:gap-[22px] w-full">
            {metrics.map((item, index) => (
                <div
                    key={index}
                    className="shrink-0 min-w-[130px] snap-start xl:min-w-0 xl:shrink 2xl:h-[84px] bg-dash-surface border border-dash-border rounded-2xl p-2 2xl:p-[17px] flex items-center gap-1.5 2xl:gap-[12px]"
                >
                    {/* Icon Container */}
                    <div
                        className={`w-8 h-8 2xl:w-10 2xl:h-10 rounded-xl 2xl:rounded-2xl flex items-center justify-center shrink-0 ${item.iconBg}`}
                    >
                        {item.icon}
                    </div>

                    {/* Text Container */}
                    <div className="flex flex-col justify-center min-w-0">
                        <span className="text-lg 2xl:text-2xl font-bold text-slate-50 leading-6 2xl:leading-8">
                            {item.value}
                        </span>
                        <span className="text-[11px] 2xl:text-xs font-normal text-slate-400 leading-[14px] 2xl:leading-[16px] line-clamp-2 xl:line-clamp-1">
                            {item.label}
                        </span>
                    </div>
                </div>
            ))}
        </div>
    )
}
