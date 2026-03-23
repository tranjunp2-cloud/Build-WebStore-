import { useState } from 'react'
import { ChevronDown, Check, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useI18n } from '@/i18n'
import { STATUS_CONFIG, type Order } from '../types'
import styles from './OrderStatusBadge.module.css'

export function OrderStatusBadge({
    order,
    onStatusChange,
    isUpdating
}: {
    order: Order
    onStatusChange: (id: string, status: string) => void
    isUpdating?: string | boolean | null
}) {
    const { t } = useI18n()
    const o = t.dashboard.orders
    const config = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending
    const loading = isUpdating === true || isUpdating === order.id

    // Status key mapping for i18n
    const statusKeyMap: Record<string, keyof typeof o.status> = {
        pending: 'pending',
        confirmed: 'confirmed',
        ready_to_ship: 'readyToShip',
        shipped: 'shipped',
        completed: 'completed',
        cancelled: 'cancelled',
        refunded: 'refunded',
        processing: 'processing',
        paid: 'paid'
    }

    // Basic transitions rule from PRD: Pending->Confirmed->Ready to Ship->Shipped->Completed
    // Manual Refund only from Shipped/Completed
    // Cancel from Pending/Confirmed
    const allowedMap: Record<string, string[]> = {
        pending: ['confirmed', 'cancelled'],
        confirmed: ['ready_to_ship', 'shipped', 'cancelled'],
        ready_to_ship: ['shipped'],
        shipped: ['completed', 'refunded'],
        completed: ['refunded'],
        cancelled: [],
        refunded: [],
        processing: ['shipped', 'cancelled'],
        paid: ['processing', 'shipped', 'cancelled']
    }

    const allowed = allowedMap[order.status] || []

    if (allowed.length === 0) {
        return (
            <span className={cn('inline-flex w-fit items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium', config.color)}>
                {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                {config.label}
            </span>
        )
    }

    const [isOpen, setIsOpen] = useState(false)

    return (
        <div className="relative inline-block text-left">
            <button
                disabled={loading}
                onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}
                className={cn(
                    'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors hover:brightness-110 disabled:opacity-50',
                    config.color
                )}>
                {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                {config.label}
                <ChevronDown className="h-3 w-3 opacity-70" />
            </button>
            {isOpen && (
                <>
                    <div className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); setIsOpen(false); }} />
                    <div className={`${styles.dropdown} absolute left-0 sm:left-auto sm:right-0 z-[100] mt-1 w-40 origin-top-right rounded-lg shadow-xl overflow-hidden max-h-60 overflow-y-auto`}>
                        <div className="py-1">
                            {allowed.map((s) => (
                                <button
                                    key={s}
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        setIsOpen(false)
                                        onStatusChange(order.id, s)
                                    }}
                                    className={`${styles.dropdownItem} block w-full px-4 py-2 text-left text-sm`}
                                >
                                    {o.changeTo} {o.status[statusKeyMap[s]] || s}
                                </button>
                            ))}
                        </div>
                    </div>
                </>
            )}
        </div>
    )
}
