'use client'

import { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ShoppingBag, WifiOff, RefreshCw, ChevronRight } from 'lucide-react'
import { useI18n } from '@/i18n'
import { getCustomerOrdersAction } from '../actions'

type OrderRow = {
    id: number
    orderNumber: string
    status: string
    total: number
    currency: string
    paymentStatus: string
    createdAt: string
}

const STATUS_COLOURS: Record<string, { bg: string; color: string }> = {
    pending:        { bg: 'rgba(180,83,9,0.15)',   color: '#d97706' },
    new:            { bg: 'rgba(3,105,161,0.15)',  color: '#38bdf8' },
    confirmed:      { bg: 'rgba(29,78,216,0.15)',  color: '#60a5fa' },
    ready_to_ship:  { bg: 'rgba(109,40,217,0.15)', color: '#a78bfa' },
    shipped:        { bg: 'rgba(67,56,202,0.15)',  color: '#818cf8' },
    completed:      { bg: 'rgba(21,128,61,0.15)',  color: '#4ade80' },
    cancelled:      { bg: 'rgba(220,38,38,0.15)',  color: '#f87171' },
    refunded:       { bg: 'rgba(107,114,128,0.15)',color: '#9ca3af' },
}

const PAYMENT_COLOURS: Record<string, { bg: string; color: string }> = {
    pending:         { bg: 'rgba(180,83,9,0.15)',   color: '#d97706' },
    processing:      { bg: 'rgba(29,78,216,0.15)',  color: '#60a5fa' },
    paid:            { bg: 'rgba(21,128,61,0.15)',  color: '#4ade80' },
    payment_failed:  { bg: 'rgba(220,38,38,0.15)',  color: '#f87171' },
    refunded:        { bg: 'rgba(124,58,237,0.15)', color: '#a78bfa' },
}

function Badge({ value, colours, stateLabel }: { value: string; colours: Record<string, { bg: string; color: string }>; stateLabel: Record<string, string> }) {
    const c = colours[value] ?? { bg: 'rgba(107,114,128,0.15)', color: '#9ca3af' }
    const label = stateLabel[value] ?? value.replace(/_/g, ' ')
    return (
        <span
            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap"
            style={{ background: c.bg, color: c.color }}
        >
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: c.color, flexShrink: 0, display: 'inline-block' }} />
            {label}
        </span>
    )
}

function fmtDate(iso: string): string {
    return new Date(iso).toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: 'numeric' })
}

export function CustomersDetailOrdersTab({ customerId }: { customerId: number }) {
    const router = useRouter()
    const { t, ti } = useI18n()
    const ot = t.dashboard.shopCustomers.ordersTab
    const STATE_LABEL: Record<string, string> = {
        pending:        ot.statusPending,
        new:            ot.statusNew,
        confirmed:      ot.statusConfirmed,
        ready_to_ship:  ot.statusReadyToShip,
        shipped:        ot.statusShipped,
        completed:      ot.statusCompleted,
        cancelled:      ot.statusCancelled,
        refunded:       ot.statusRefunded,
        paid:           ot.statusPaid,
        payment_failed: ot.statusPaymentFailed,
        processing:     ot.statusProcessing,
    }
    const [orders, setOrders]       = useState<OrderRow[]>([])
    const [page, setPage]           = useState(1)
    const [total, setTotal]         = useState(0)
    const [totalPages, setTotalPages] = useState(1)
    const [loading, setLoading]     = useState(true)
    const [error, setError]         = useState(false)

    const fetchOrders = useCallback(async (p: number) => {
        setLoading(true)
        setError(false)
        try {
            const res = await getCustomerOrdersAction(customerId, p)
            setOrders(res.orders as OrderRow[])
            setTotal(res.total as number)
            setTotalPages(res.totalPages as number)
        } catch {
            setError(true)
        } finally {
            setLoading(false)
        }
    }, [customerId])

    useEffect(() => { setPage(1) }, [customerId])
    useEffect(() => { fetchOrders(page) }, [fetchOrders, page])

    if (loading) {
        return (
            <div className="space-y-2">
                {Array.from({ length: 5 }, (_, i) => (
                    <div key={i} className="h-12 rounded-[10px] bg-white/[0.04] animate-pulse" />
                ))}
            </div>
        )
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center py-16 text-center">
                <WifiOff className="w-10 h-10 text-white/20 mb-3" />
                <p className="text-[14px] text-white/50 mb-4">{ot.loadFailed}</p>
                <button
                    type="button"
                    onClick={() => fetchOrders(page)}
                    className="flex items-center gap-2 h-9 px-4 rounded-[8px] text-[13px] text-white/70 border border-white/[0.08] bg-transparent hover:bg-white/[0.05] transition-colors cursor-pointer"
                >
                    <RefreshCw className="w-4 h-4" /> {ot.retry}
                </button>
            </div>
        )
    }

    if (orders.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-16 text-center">
                <ShoppingBag className="w-10 h-10 text-white/20 mb-3" />
                <p className="text-[14px] text-white/50">{ot.noOrders}</p>
            </div>
        )
    }

    return (
        <div className="space-y-3">
            <p className="text-[13px] text-white/40">{ti(ot.totalOrders, { total })}</p>

            <div
                className="rounded-[16px] border border-white/[0.06] overflow-hidden"
                style={{ background: 'var(--cus-surface-card)' }}
            >
                <div className="overflow-x-auto">
                    <table className="w-full border-collapse min-w-[540px]">
                        <thead>
                            <tr className="border-b border-white/[0.06]" style={{ background: 'var(--cus-surface-header)' }}>
                                {[ot.colOrderNumber, ot.colStatus, ot.colTotal, ot.colPayment, ot.colDate, ''].map((h, i) => (
                                    <th key={i} className={`px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-white/45 whitespace-nowrap ${i === 2 ? 'text-right' : 'text-left'}`}>
                                        {h}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {orders.map(o => (
                                <tr
                                    key={o.id}
                                    onClick={() => router.push(`/orders?order=${o.id}`)}
                                    className="border-b border-white/[0.04] cursor-pointer hover:bg-white/[0.03] transition-colors"
                                >
                                    <td className="px-4 py-3">
                                        <code className="text-[13px] font-mono text-white/75 bg-white/[0.05] px-1.5 py-0.5 rounded">
                                            {o.orderNumber || `#${o.id}`}
                                        </code>
                                    </td>
                                    <td className="px-4 py-3">
                                        {o.status ? <Badge value={o.status} colours={STATUS_COLOURS} stateLabel={STATE_LABEL} /> : <span className="text-white/30">—</span>}
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap text-right">
                                        <span className="text-[14px] font-medium tabular-nums text-[#f8fafc]">
                                            {o.currency || 'MYR'} {o.total.toFixed(2)}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3">
                                        {o.paymentStatus ? <Badge value={o.paymentStatus} colours={PAYMENT_COLOURS} stateLabel={STATE_LABEL} /> : <span className="text-white/30">—</span>}
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap" title={o.createdAt}>
                                        <span className="text-[13px] text-white/50">{fmtDate(o.createdAt)}</span>
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <ChevronRight className="w-4 h-4 text-white/20 inline-block" />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="flex items-center justify-between px-4 py-3 border-t border-white/[0.06]">
                        <p className="text-[12px] text-white/40">
                            {ot.showing}{' '}
                            <strong className="text-white/60">{total === 0 ? 0 : Math.min((page - 1) * 25 + 1, total)}–{Math.min(page * 25, total)}</strong>
                            {' '}{ot.of}{' '}
                            <strong className="text-white/60">{total}</strong>
                            {' '}{ot.orders}
                        </p>
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                disabled={page <= 1}
                                onClick={() => setPage(p => p - 1)}
                                className="h-7 px-3 rounded-[6px] text-[12px] text-white/60 border border-white/[0.08] bg-transparent disabled:opacity-30 hover:border-white/20 transition-colors cursor-pointer"
                            >
                                {ot.prev}
                            </button>
                            <span className="text-[12px] font-semibold text-white/60 px-1">
                                {ot.page} {page} {ot.of} {totalPages}
                            </span>
                            <button
                                type="button"
                                disabled={page >= totalPages}
                                onClick={() => setPage(p => p + 1)}
                                className="h-7 px-3 rounded-[6px] text-[12px] text-white/60 border border-white/[0.08] bg-transparent disabled:opacity-30 hover:border-white/20 transition-colors cursor-pointer"
                            >
                                {ot.next}
                            </button>
                        </div>
                    </div>
            </div>
        </div>
    )
}
