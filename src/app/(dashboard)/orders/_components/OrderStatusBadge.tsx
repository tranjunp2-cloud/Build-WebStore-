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
            bg: 'bg-[hsl(var(--warning)/0.12)]',
            border: 'border-[hsl(var(--warning)/0.3)]',
            text: 'text-[hsl(var(--warning))]',
            dot: 'bg-[hsl(var(--warning))]',
        },
        'Confirmed': {
            bg: 'bg-[hsl(var(--info)/0.12)]',
            border: 'border-[hsl(var(--info)/0.3)]',
            text: 'text-[hsl(var(--info))]',
            dot: 'bg-[hsl(var(--info))]',
        },
        'Ready to Ship': {
            bg: 'bg-[hsl(var(--info)/0.12)]',
            border: 'border-[hsl(var(--info)/0.3)]',
            text: 'text-[hsl(var(--info))]',
            dot: 'bg-[hsl(var(--info))]',
        },
        'Shipped': {
            bg: 'bg-[hsl(var(--success)/0.12)]',
            border: 'border-[hsl(var(--success)/0.3)]',
            text: 'text-[hsl(var(--success))]',
            dot: 'bg-[hsl(var(--success))]',
        },
        'Completed': {
            bg: 'bg-[hsl(var(--success)/0.12)]',
            border: 'border-[hsl(var(--success)/0.3)]',
            text: 'text-[hsl(var(--success))]',
            dot: 'bg-[hsl(var(--success))]',
        },
        'Cancelled': {
            bg: 'bg-[hsl(var(--destructive)/0.12)]',
            border: 'border-[hsl(var(--destructive)/0.3)]',
            text: 'text-[hsl(var(--destructive))]',
            dot: 'bg-[hsl(var(--destructive))]',
        },
        'Refunded': {
            bg: 'bg-[hsl(var(--muted-foreground)/0.12)]',
            border: 'border-[hsl(var(--muted-foreground)/0.3)]',
            text: 'text-[hsl(var(--muted-foreground))]',
            dot: 'bg-[hsl(var(--muted-foreground))]',
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
