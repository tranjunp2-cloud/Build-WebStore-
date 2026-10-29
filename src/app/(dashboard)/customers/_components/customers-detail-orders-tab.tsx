'use client'

import { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ShoppingBag, WifiOff, RefreshCw, ChevronRight } from 'lucide-react'
import { useI18n } from '@/i18n'
import { Badge } from '@/components/ui/badge'
import { TablePagination, shouldShowTablePagination } from '@/components/ui/table-pagination'
import { TableEmptyState } from '@/components/ui/table-empty-state'
import {
    Table,
    TableHeader,
    TableBody,
    TableRow,
    TableHead,
    TableCell,
} from '@/components/ui/table'
import { getCustomerOrdersAction } from '../actions'
import { useAgentChanges } from '@/lib/agent-changes/use-agent-changes'

type OrderRow = {
    id: number
    orderNumber: string
    status: string
    total: number
    currency: string
    paymentStatus: string
    createdAt: string
}

// Maps order/payment status values to Badge variants.
// "success" = completed/paid, "warning" = pending/processing, "destructive" = failed/cancelled/refunded, "secondary" = other.
function orderStatusVariant(status: string): 'success' | 'warning' | 'destructive' | 'secondary' {
    switch (status) {
        case 'completed':
        case 'paid':
            return 'success'
        case 'pending':
        case 'processing':
        case 'new':
        case 'confirmed':
        case 'ready_to_ship':
        case 'shipped':
            return 'warning'
        case 'cancelled':
        case 'payment_failed':
        case 'refunded':
            return 'destructive'
        default:
            return 'secondary'
    }
}

function fmtDate(iso: string): string {
    return new Date(iso).toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: 'numeric' })
}

export function CustomersDetailOrdersTab({ customerId }: { customerId: number }) {
    const router = useRouter()
    const { t } = useI18n()
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
    const [orders, setOrders]         = useState<OrderRow[]>([])
    const [page, setPage]             = useState(1)
    const [total, setTotal]           = useState(0)
    const [totalPages, setTotalPages] = useState(1)
    const [loading, setLoading]       = useState(true)
    const [error, setError]           = useState(false)

    // silent = an assistant-driven refetch: keep the rows, and a failure keeps them too
    const fetchOrders = useCallback(async (p: number, silent = false) => {
        if (!silent) { setLoading(true); setError(false) }
        try {
            const res = await getCustomerOrdersAction(customerId, p)
            setOrders(res.orders as OrderRow[])
            setTotal(res.total as number)
            setTotalPages(res.totalPages as number)
        } catch (err) {
            if (silent) console.error('[Customer orders refresh]', err)
            else setError(true)
        } finally {
            setLoading(false)
        }
    }, [customerId])

    useEffect(() => { setPage(1) }, [customerId])
    useEffect(() => { fetchOrders(page) }, [fetchOrders, page])
    // the assistant changed an order (cancel, ship, refund...): the statuses listed here may have moved
    useAgentChanges({ kinds: ['store_order'] }, () => { void fetchOrders(page, true) })

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
                <WifiOff className="w-10 h-10 mb-3" style={{ color: 'var(--dash-text-muted)', opacity: 0.4 }} />
                <p className="text-[14px] mb-4" style={{ color: 'var(--dash-text-muted)' }}>{ot.loadFailed}</p>
                <button
                    type="button"
                    onClick={() => fetchOrders(page)}
                    className="flex items-center gap-2 h-9 px-4 rounded-[8px] text-[13px] bg-transparent transition-colors cursor-pointer hover:bg-black/[0.05] dark:hover:bg-white/[0.05]"
                    style={{ color: 'var(--dash-text-muted)', border: '1px solid var(--dash-border)' }}
                >
                    <RefreshCw className="w-4 h-4" /> {ot.retry}
                </button>
            </div>
        )
    }

    if (orders.length === 0) {
        return <TableEmptyState compact icon={<ShoppingBag />} title={ot.noOrders} />
    }

    const colHeaders = [ot.colOrderNumber, ot.colStatus, ot.colTotal, ot.colPayment, ot.colDate, '']

    // Pagination rendered inside the Table card (footer slot) — shared <TablePagination>.
    // Fixed page size (25), so no rows-per-page selector (onLimitChange omitted).
    // Hidden for totals <=10 per the global GH-1579 rule.
    const footer = shouldShowTablePagination(total) ? (
        <TablePagination
            page={page}
            total={total}
            limit={25}
            onPageChange={setPage}
            labels={{ showing: ot.showing, of: ot.of, unit: ot.orders }}
        />
    ) : undefined

    return (
        <Table minWidth={480} className="table-fixed w-full" footer={footer}>
            {/* table-fixed + % colgroup: even columns. Last col is just the row-chevron, so
                it's kept narrow. NB: no inter-tag whitespace — colgroup rejects text nodes. */}
            <colgroup>
                <col style={{ width: '21%' }} />
                <col style={{ width: '20%' }} />
                <col style={{ width: '16%' }} />
                <col style={{ width: '20%' }} />
                <col style={{ width: '15%' }} />
                <col style={{ width: '8%' }} />
            </colgroup>
            <TableHeader>
                <TableRow>
                    {colHeaders.map((h, i) => (
                        <TableHead key={i} className={i === 2 ? 'text-right' : 'text-left'}>
                            {h}
                        </TableHead>
                    ))}
                </TableRow>
            </TableHeader>
            <TableBody>
                {orders.map((o) => (
                    <TableRow
                        key={o.id}
                        onClick={() => router.push(`/orders?order=${o.id}`)}
                        clickable
                    >
                        <TableCell>
                            <code className="text-[13px] font-mono px-1.5 py-0.5 rounded" style={{ color: 'var(--dash-text)', background: 'var(--dash-surface)' }}>
                                {o.orderNumber || `#${o.id}`}
                            </code>
                        </TableCell>
                        <TableCell>
                            {o.status
                                ? <Badge variant={orderStatusVariant(o.status)} dot className="rounded-full">
                                    {STATE_LABEL[o.status] ?? o.status.replace(/_/g, ' ')}
                                  </Badge>
                                : <span style={{ color: 'var(--dash-text-muted)', opacity: 0.4 }}>—</span>
                            }
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-right">
                            <span className="text-[14px] font-medium tabular-nums" style={{ color: 'var(--dash-text)' }}>
                                {o.currency || 'MYR'} {o.total.toFixed(2)}
                            </span>
                        </TableCell>
                        <TableCell>
                            {o.paymentStatus
                                ? <Badge variant={orderStatusVariant(o.paymentStatus)} dot className="rounded-full">
                                    {STATE_LABEL[o.paymentStatus] ?? o.paymentStatus.replace(/_/g, ' ')}
                                  </Badge>
                                : <span style={{ color: 'var(--dash-text-muted)', opacity: 0.4 }}>—</span>
                            }
                        </TableCell>
                        <TableCell className="whitespace-nowrap" title={o.createdAt}>
                            <span className="text-[13px]" style={{ color: 'var(--dash-text-muted)' }}>{fmtDate(o.createdAt)}</span>
                        </TableCell>
                        <TableCell className="text-right">
                            <ChevronRight className="w-4 h-4 inline-block" style={{ color: 'var(--dash-text-muted)', opacity: 0.4 }} />
                        </TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    )
}
