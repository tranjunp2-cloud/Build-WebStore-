"use client"

import React, { useState, useEffect } from 'react'
import { Clock, CheckCircle2, Package, Truck } from 'lucide-react'
import { useI18n } from '@/i18n'

export function OrdersMetrics({ refreshCounter = 0 }: { refreshCounter?: number }) {
    const { t } = useI18n()
    const o = t.dashboard.orders
    const [counts, setCounts] = useState({ pending: 0, readyToShip: 0, confirmed: 0, shipped: 0 })

    useEffect(() => {
        async function fetchMetrics() {
            try {
                const res = await fetch('/api/orders/metrics')
                const json = await res.json()
                if (json.success && json.data) {
                    setCounts(json.data)
                }
            } catch (err) { }
        }
        fetchMetrics()
    }, [refreshCounter])

    const metrics = [
        {
            label: o.metrics.pending,
            value: counts.pending,
            icon: <Clock className="w-5 h-5 text-[#FF8904]" />,
            iconBg: 'bg-[rgba(255,105,0,0.1)]',
        },
        {
            label: o.metrics.readyToShip,
            value: counts.readyToShip,
            icon: <Package className="w-5 h-5 text-blue-500" />,
            iconBg: 'bg-blue-500/10',
        },
        {
            label: o.status.confirmed,
            value: counts.confirmed,
            icon: <CheckCircle2 className="w-5 h-5 text-blue-500" />,
            iconBg: 'bg-blue-500/10',
        },
        {
            label: o.metrics.shipped,
            value: counts.shipped,
            icon: <Truck className="w-5 h-5 text-[#05DF72]" />,
            iconBg: 'bg-[rgba(0,201,80,0.1)]',
        },
    ]

    return (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-[22px] w-full">
            {metrics.map((item, index) => (
                <div
                    key={index}
                    className="h-[84px] bg-slate-800/60 border border-[rgba(255,255,255,0.08)] rounded-2xl p-[17px] flex items-center gap-[12px]"
                >
                    {/* Icon Container */}
                    <div
                        className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${item.iconBg}`}
                    >
                        {item.icon}
                    </div>

                    {/* Text Container */}
                    <div className="flex flex-col justify-center">
                        <span className="text-2xl font-bold text-slate-50 leading-8">
                            {item.value}
                        </span>
                        <span className="text-xs font-normal text-slate-400 leading-[16px]">
                            {item.label}
                        </span>
                    </div>
                </div>
            ))}
        </div>
    )
}
