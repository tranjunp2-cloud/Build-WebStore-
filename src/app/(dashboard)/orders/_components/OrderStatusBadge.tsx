import React from 'react'

export type OrderStatus = 'Pending' | 'Confirmed' | 'Ready to Ship' | 'Shipped' | 'Completed' | 'Cancelled' | 'Refunded'

interface OrderStatusBadgeProps {
    status: OrderStatus
}

export function OrderStatusBadge({ status }: OrderStatusBadgeProps) {
    const statusConfig: Record<
        OrderStatus,
        { bg: string; border: string; text: string; dot: string }
    > = {
        'Pending': {
            bg: 'bg-[rgba(255,105,0,0.1)]',
            border: 'border-[rgba(255,105,0,0.3)]',
            text: 'text-[#FF8904]',
            dot: 'bg-[#FF6900]',
        },
        'Confirmed': {
            bg: 'bg-[rgba(59,130,246,0.1)]',
            border: 'border-[#3B82F6]/30',
            text: 'text-[#3B82F6]',
            dot: 'bg-[#3B82F6]',
        },
        'Ready to Ship': {
            bg: 'bg-[rgba(59,130,246,0.1)]',
            border: 'border-[#3B82F6]/30',
            text: 'text-[#3B82F6]',
            dot: 'bg-[#3B82F6]',
        },
        'Shipped': {
            bg: 'bg-[rgba(0,201,80,0.1)]',
            border: 'border-[#05DF72]/30',
            text: 'text-[#05DF72]',
            dot: 'bg-[#05DF72]',
        },
        'Completed': {
            bg: 'bg-[rgba(0,201,80,0.1)]',
            border: 'border-[#05DF72]/30',
            text: 'text-[#05DF72]',
            dot: 'bg-[#05DF72]',
        },
        'Cancelled': {
            bg: 'bg-red-500/10',
            border: 'border-red-500/30',
            text: 'text-red-500',
            dot: 'bg-red-500',
        },
        'Refunded': {
            bg: 'bg-slate-500/10',
            border: 'border-slate-500/30',
            text: 'text-slate-400',
            dot: 'bg-slate-400',
        },
    }

    const config = statusConfig[status] || statusConfig['Pending']

    return (
        <div
            className={`inline-flex items-center gap-2 px-[13px] py-[5px] rounded-xl border ${config.bg} ${config.border}`}
        >
            <div className={`w-2 h-2 rounded-full ${config.dot}`} />
            <span className={`text-sm font-medium ${config.text}`}>
                {status}
            </span>
        </div>
    )
}
