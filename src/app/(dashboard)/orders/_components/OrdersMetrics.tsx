import React from 'react'
import { Clock, CheckCircle2, Package, Truck } from 'lucide-react'

const metrics = [
    {
        label: 'Pending',
        value: 3,
        icon: <Clock className="w-5 h-5 text-[#FF8904]" />,
        iconBg: 'bg-[rgba(255,105,0,0.1)]',
    },
    {
        label: 'Ready to Ship',
        value: 3,
        icon: <Package className="w-5 h-5 text-blue-500" />,
        iconBg: 'bg-blue-500/10',
    },
    {
        label: 'Confirmed',
        value: 3,
        icon: <CheckCircle2 className="w-5 h-5 text-blue-500" />,
        iconBg: 'bg-blue-500/10',
    },
    {
        label: 'Shipped',
        value: 3,
        icon: <Truck className="w-5 h-5 text-[#05DF72]" />,
        iconBg: 'bg-[rgba(0,201,80,0.1)]',
    },
]

export function OrdersMetrics() {
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-[22px] w-full">
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
