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
            bg: 'bg-orange-50 dark:bg-orange-500/10',
            border: 'border-orange-200 dark:border-orange-500/30',
            text: 'text-orange-700 dark:text-orange-400',
            dot: 'bg-orange-500',
        },
        'Confirmed': {
            bg: 'bg-blue-50 dark:bg-blue-500/10',
            border: 'border-blue-200 dark:border-blue-500/30',
            text: 'text-blue-700 dark:text-blue-400',
            dot: 'bg-blue-500',
        },
        'Ready to Ship': {
            bg: 'bg-blue-50 dark:bg-blue-500/10',
            border: 'border-blue-200 dark:border-blue-500/30',
            text: 'text-blue-700 dark:text-blue-400',
            dot: 'bg-blue-500',
        },
        'Shipped': {
            bg: 'bg-green-50 dark:bg-green-500/10',
            border: 'border-green-200 dark:border-green-500/30',
            text: 'text-green-700 dark:text-green-400',
            dot: 'bg-green-500',
        },
        'Completed': {
            bg: 'bg-green-50 dark:bg-green-500/10',
            border: 'border-green-200 dark:border-green-500/30',
            text: 'text-green-700 dark:text-green-400',
            dot: 'bg-green-500',
        },
        'Cancelled': {
            bg: 'bg-red-50 dark:bg-red-500/10',
            border: 'border-red-200 dark:border-red-500/30',
            text: 'text-red-700 dark:text-red-400',
            dot: 'bg-red-500',
        },
        'Refunded': {
            bg: 'bg-zinc-100 dark:bg-slate-500/10',
            border: 'border-zinc-200 dark:border-slate-500/30',
            text: 'text-zinc-600 dark:text-slate-400',
            dot: 'bg-zinc-400 dark:bg-slate-400',
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
