"use client"

import React, { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Package } from 'lucide-react'
import { useI18n } from '@/i18n'
import { Checkbox } from '@/components/ui/checkbox'
import { TablePagination, shouldShowTablePagination, useTablePageClamp } from '@/components/ui/table-pagination'
import { TableEmptyState } from '@/components/ui/table-empty-state'
import { xenditChannelLabel } from '@/lib/email/templates/shared/email-utils'
import {
    Table,
    TableHeader,
    TableBody,
    TableRow,
    TableHead,
    TableCell,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { ORDER_STATUS_LABEL_KEY, type OrderStatus } from '@/lib/orders/status-groups'
import { useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/hooks/queries/query-keys'
import { useKeptData } from '@/hooks/queries/use-kept-data'
import { useQueryScope } from '@/providers/query-provider'
import { useOrdersPageQuery } from './orders-queries'

// ───────── TYPES ─────────
export type { OrderStatus }

export interface Order {
    id: string
    orderNumber: string
    customerName: string
    total: number
    currency: string
    status: OrderStatus
    paymentMethod?: string | null
    xenditChannelCode?: string | null
    createdAt?: string | null
}

// Maps OrderStatus → Badge variant + dot color override for statuses that need
// specific hex values not covered by the four generic badge variants.
const STATUS_BADGE: Record<OrderStatus, {
    variant: 'warning' | 'default' | 'success' | 'destructive' | 'secondary'
    dotColor?: string
    textColor?: string
    bg?: string
    borderColor?: string
}> = {
    pending: { variant: 'warning', dotColor: 'hsl(var(--warning))', textColor: 'hsl(var(--warning))', bg: 'hsl(var(--warning)/0.1)', borderColor: 'hsl(var(--warning)/0.3)' },
    new: { variant: 'warning', dotColor: 'hsl(var(--warning))', textColor: 'hsl(var(--warning))', bg: 'hsl(var(--warning)/0.1)', borderColor: 'hsl(var(--warning)/0.3)' },
    confirmed: { variant: 'default', dotColor: 'hsl(var(--info))', textColor: 'hsl(var(--info))', bg: 'hsl(var(--info)/0.1)', borderColor: 'hsl(var(--info)/0.3)' },
    ready_to_ship: { variant: 'default', dotColor: 'hsl(var(--info))', textColor: 'hsl(var(--info))', bg: 'hsl(var(--info)/0.1)', borderColor: 'hsl(var(--info)/0.3)' },
    shipped: { variant: 'success', dotColor: 'hsl(var(--success))', textColor: 'hsl(var(--success))', bg: 'hsl(var(--success)/0.1)', borderColor: 'hsl(var(--success)/0.3)' },
    completed: { variant: 'success', dotColor: 'hsl(var(--success))', textColor: 'hsl(var(--success))', bg: 'hsl(var(--success)/0.1)', borderColor: 'hsl(var(--success)/0.3)' },
    cancelled: { variant: 'destructive', dotColor: 'hsl(var(--destructive))', textColor: 'hsl(var(--destructive))', bg: 'hsl(var(--destructive)/0.1)', borderColor: 'hsl(var(--destructive)/0.3)' },
    refunded: { variant: 'secondary', dotColor: 'hsl(var(--muted-foreground))', textColor: 'hsl(var(--muted-foreground))', bg: 'hsl(var(--muted-foreground)/0.1)', borderColor: 'hsl(var(--muted-foreground)/0.3)' },
    paid: { variant: 'success', dotColor: 'hsl(var(--success))', textColor: 'hsl(var(--success))', bg: 'hsl(var(--success)/0.1)', borderColor: 'hsl(var(--success)/0.3)' },
    processing: { variant: 'default', dotColor: 'hsl(var(--info))', textColor: 'hsl(var(--info))', bg: 'hsl(var(--info)/0.1)', borderColor: 'hsl(var(--info)/0.3)' },
    payment_failed: { variant: 'destructive', dotColor: 'hsl(var(--destructive))', textColor: 'hsl(var(--destructive))', bg: 'hsl(var(--destructive)/0.1)', borderColor: 'hsl(var(--destructive)/0.3)' },
}

function getStatusLabel(status: OrderStatus, statusLabels: Record<string, string>): string {
    return (statusLabels as Record<string, string>)[ORDER_STATUS_LABEL_KEY[status]] || status
}

function formatOrderDate(iso?: string | null): string {
    if (!iso) return '—'
    const d = new Date(iso)
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

// ───────── STATUS BADGE ─────────
// Uses the shared Badge component; colors preserved via inline style overrides
// so the exact hex values from the original STATUS_STYLE map are kept.
function StatusBadge({ status, label, className }: { status: OrderStatus; label: string; className?: string }) {
    const cfg = STATUS_BADGE[status] ?? STATUS_BADGE['pending']
    return (
        <Badge
            variant={cfg.variant}
            dot
            className={cn("rounded-full px-2.5 py-0.5 border-solid whitespace-nowrap", className)}
            style={{
                background: cfg.bg,
                borderColor: cfg.borderColor,
                color: cfg.textColor,
                // Override the dot span color via currentColor inheritance
            }}
        >
            {label}
        </Badge>
    )
}

interface InnerTableProps {
    orders: Order[]
    loading: boolean
    selectedRows: Set<string>
    onSelectionChange: (selectedIds: Set<string>) => void
    newOrderIds?: Set<string>
    /** Pagination row: rendered in the desktop Table card footer + below the mobile cards. */
    footer?: React.ReactNode
}

function OrdersTableInner({ orders, loading, selectedRows, onSelectionChange, newOrderIds, footer }: InnerTableProps) {
    const { t } = useI18n()
    const router = useRouter()
    const o = t.dashboard.orders
    const statusLabels = o.status
    const methodLabels = (o.detail as Record<string, unknown>).paymentMethods as Record<string, string>

    function navigateToOrder(id: string) {
        router.push(`/orders/${id}`)
    }

    function toggleRow(id: string) {
        const next = new Set(selectedRows)
        if (next.has(id)) next.delete(id)
        else next.add(id)
        onSelectionChange(next)
    }

    // Empty state — shown in place of the table (both mobile and desktop) when not loading and no orders.
    if (!loading && orders.length === 0) {
        return <TableEmptyState icon={<Package />} title={o.tableHeaders.noOrders} subtitle={o.tableHeaders.noOrdersSubtitle} />
    }

    return (
        <div className="w-full">
            {/* Card View (mobile + iPad mini, < 820px). 1 col on mobile, 2 cols from md.
                The table takes over from iPad Air (>=820) — matches blog + the
                dash-table-compact convention. */}
            <div className="grid grid-cols-1 md:grid-cols-2 min-[820px]:hidden w-full gap-4 content-start">
                {loading ? (
                    <div className="p-8 text-center text-slate-400 md:col-span-2">{o.tableHeaders.loading}</div>
                ) : (
                    orders.map((order) => {
                        const isSelected = selectedRows.has(order.id)

                        return (
                            <div
                                key={order.id}
                                onClick={() => navigateToOrder(order.id)}
                                className={`flex flex-row items-start gap-[12px] p-[17px] cursor-pointer border rounded-2xl ${newOrderIds?.has(order.id) ? 'bg-[hsl(var(--success)/0.1)] border-[hsl(var(--success)/0.3)]' : isSelected ? 'bg-[hsl(var(--primary)/0.05)] border-dash-border' : 'bg-dash-surface border-dash-border'}`}
                                style={{ transition: 'background 1s ease-out, border-color 1s ease-out' }}
                            >
                                <div className="pt-[4px]" onClick={(e) => e.stopPropagation()}>
                                    <Checkbox
                                        checked={isSelected}
                                        onCheckedChange={() => toggleRow(order.id)}
                                        aria-label={`Select order ${order.id}`}
                                    />
                                </div>
                                <div className="flex flex-col flex-1 gap-[8px]">
                                    <div className="flex items-center justify-between w-full">
                                        <span className="text-[14px] font-semibold leading-[1.4285714285714286em] text-slate-50 tracking-tight">
                                            {order.orderNumber}
                                        </span>
                                        {/* Card (mobile/tablet) badge is a touch smaller than the
                                            desktop table badge: 11px text, tighter padding + gap. */}
                                        <StatusBadge
                                            status={order.status}
                                            label={getStatusLabel(order.status, statusLabels)}
                                            className="text-[11px] px-2 py-0.5 gap-1"
                                        />
                                    </div>
                                    <span className="text-[14px] font-medium leading-[1.4285714285714286em] text-slate-400 truncate max-w-[200px]">
                                        {order.customerName || 'N/A'}
                                    </span>
                                    <div className="flex items-center gap-[8px]">
                                        <span className="text-[20px] font-semibold leading-[1.4em] text-slate-50">
                                            {order.currency || 'RM'} {typeof order.total === 'number' ? order.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : order.total}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="text-[12px] text-slate-400 truncate">{order.paymentMethod === 'ewallet' ? xenditChannelLabel(order.xenditChannelCode) : (methodLabels[order.paymentMethod ?? ''] ?? order.paymentMethod ?? '—')}</span>
                                        <span className="text-[12px] text-slate-500 shrink-0">{formatOrderDate(order.createdAt)}</span>
                                    </div>
                                </div>
                            </div>
                        )
                    })
                )}
            </div>

            {/* Card pager — shown with the cards (< 820px). From iPad Air up the pager
                lives inside the Table card footer, so hide this one at the same 820px
                cutoff to avoid rendering two pagers in the 820–1279 range. */}
            {footer && <div className="min-[820px]:hidden mt-4">{footer}</div>}

            {/* Table view (iPad Air >=820 and up). dash-table-compact (globals.css) shrinks
                font + padding below xl so the 6 columns fit the tablet width. No min-width:
                the table is always w-full so it fits whatever the content area is — this
                avoids a horizontal scrollbar on iPad Pro when the sidebar is open (the
                content shrinks below 1100px there). On real desktops the area is wider than
                1100px anyway, so dropping the floor is a no-op → desktop unchanged. */}
            <div className="hidden min-[820px]:block w-full">
                <Table className="table-fixed w-full dash-table-compact" footer={footer}>
                    {/* table-fixed + % colgroup. Desktop (>=1280): edges 16%, middle at
                        17% (Total 16%) → sums to 100%. Below 1280 (iPad Air compact): Total
                        stays narrow (13%, short content), Customer + Payment get 18% each.
                        Tablet sum is 99% (not 100) on purpose — a 1% buffer so the table
                        never exceeds its container and no horizontal scrollbar appears even
                        when the sidebar is open (which shrinks the content area). */}
                    <colgroup>
                        <col style={{ width: '16%' }} />
                        <col className="w-[18%] min-[1280px]:w-[17%]" />
                        <col className="w-[13%] min-[1280px]:w-[16%]" />
                        <col className="w-[18%] min-[1280px]:w-[17%]" />
                        <col style={{ width: '16%' }} />
                        <col style={{ width: '18%' }} />
                    </colgroup>

                    <TableHeader>
                        <TableRow style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                            <TableHead>{o.tableHeaders.orderNumber}</TableHead>
                            <TableHead>{o.tableHeaders.customer}</TableHead>
                            <TableHead>{o.tableHeaders.total}</TableHead>
                            <TableHead>{o.tableHeaders.paymentMethod}</TableHead>
                            <TableHead>{o.tableHeaders.orderDate}</TableHead>
                            <TableHead>{o.tableHeaders.status}</TableHead>
                        </TableRow>
                    </TableHeader>

                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center py-[60px]">
                                    <span style={{ color: 'var(--dash-text-muted)' }}>{o.tableHeaders.loading}</span>
                                </TableCell>
                            </TableRow>
                        ) : orders.map((order) => {
                            const isSelected = selectedRows.has(order.id)

                            return (
                                <TableRow
                                    key={order.id}
                                    clickable
                                    style={{
                                        background: newOrderIds?.has(order.id)
                                            ? 'hsl(var(--success)/0.12)'
                                            : isSelected ? 'hsl(var(--primary)/0.06)' : undefined,
                                        transition: 'background 1s ease-out',
                                    }}
                                    onMouseEnter={e => {
                                        if (!isSelected && !newOrderIds?.has(order.id))
                                            (e.currentTarget as HTMLTableRowElement).style.background = 'var(--dash-surface-hover)'
                                    }}
                                    onMouseLeave={e => {
                                        if (!isSelected && !newOrderIds?.has(order.id))
                                            (e.currentTarget as HTMLTableRowElement).style.background = ''
                                    }}
                                    onClick={() => navigateToOrder(order.id)}
                                >
                                    <TableCell style={{ color: 'var(--dash-text)', fontWeight: 600 }}>
                                        {order.orderNumber}
                                    </TableCell>
                                    <TableCell style={{ color: 'var(--dash-text)' }}>
                                        {order.customerName || 'N/A'}
                                    </TableCell>
                                    <TableCell className="whitespace-nowrap" style={{ color: 'var(--dash-text)', fontWeight: 600 }}>
                                        {order.currency || 'RM'} {typeof order.total === 'number' ? order.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : order.total}
                                    </TableCell>
                                    <TableCell style={{ color: 'var(--dash-text-muted)' }}>
                                        {order.paymentMethod === 'ewallet' ? xenditChannelLabel(order.xenditChannelCode) : (methodLabels[order.paymentMethod ?? ''] ?? order.paymentMethod ?? '—')}
                                    </TableCell>
                                    <TableCell className="whitespace-nowrap" style={{ color: 'var(--dash-text-muted)' }}>
                                        {formatOrderDate(order.createdAt)}
                                    </TableCell>
                                    <TableCell>
                                        <StatusBadge status={order.status} label={getStatusLabel(order.status, statusLabels)} />
                                    </TableCell>
                                </TableRow>
                            )
                        })}
                    </TableBody>
                </Table>
            </div>
        </div>
    )
}

export function OrdersTable({
    silentRefreshTrigger = 0,
    selectedRows = new Set(),
    onSelectionChange,
    onOrdersLoaded,
    searchQuery = '',
    statusFilter = 'all',
    dateFilter = 'all',
    paymentMethodFilter = '',
    sortOrder = '-createdAt',
}: {
    silentRefreshTrigger?: number
    selectedRows?: Set<string>
    onSelectionChange?: (selectedIds: Set<string>) => void
    onOrdersLoaded?: (orders: Order[]) => void
    searchQuery?: string
    statusFilter?: string
    dateFilter?: string
    paymentMethodFilter?: string
    sortOrder?: string
}) {
    const [page, setPage] = useState(1)
    const [limit, setLimit] = useState(10)
    const [newOrderIds, setNewOrderIds] = useState<Set<string>>(new Set())
    const { t } = useI18n()
    const scope = useQueryScope()
    const queryClient = useQueryClient()

    // A filter change starts on page 1 in the same render: no request for the old page number.
    const filtersKey = JSON.stringify([searchQuery, statusFilter, dateFilter, paymentMethodFilter, sortOrder])
    const [pageFilters, setPageFilters] = useState(filtersKey)
    if (pageFilters !== filtersKey) {
        setPageFilters(filtersKey)
        if (page !== 1) setPage(1)
    }

    const query = useOrdersPageQuery({ page, limit, sort: sortOrder, search: searchQuery, status: statusFilter, date: dateFilter, paymentMethod: paymentMethodFilter })
    // a failed page read keeps the rows last shown (the old screen logged it and kept them too)
    const shown = useKeptData(query.data)
    const orders = shown?.docs ?? []
    const total = shown?.totalDocs ?? 0
    // spinner rows while the rows on screen are not this page / these filters yet; a background refetch keeps them
    const loading = query.isPending || query.isPlaceholderData
    useEffect(() => {
        if (query.error) console.error('Failed to load orders:', query.error)
    }, [query.error])

    // GH-1579: bulk status changes with an active status filter shrink the dataset —
    // snap back when the refetched total strands page past the last valid page.
    useTablePageClamp(page, total, limit, setPage, !loading)

    // the parent keeps the loaded rows (bulk confirm reads their status)
    const onOrdersLoadedRef = useRef(onOrdersLoaded)
    onOrdersLoadedRef.current = onOrdersLoaded
    const loadedDocs = query.isPlaceholderData ? undefined : query.data?.docs
    useEffect(() => {
        if (loadedDocs) onOrdersLoadedRef.current?.(loadedDocs)
    }, [loadedDocs])

    // A new order arrived (notification): read page 1 again in the background and highlight the rows that are new.
    const highlightAfter = useRef<Set<string> | null>(null)
    useEffect(() => {
        if (silentRefreshTrigger === 0) return
        if (page === 1) highlightAfter.current = new Set(orders.map((ord) => ord.id))
        void queryClient.invalidateQueries({ queryKey: queryKeys.orders.lists(scope) })
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [silentRefreshTrigger])
    useEffect(() => {
        const before = highlightAfter.current
        if (!before || !loadedDocs || page !== 1) return
        highlightAfter.current = null
        const freshIds = new Set(loadedDocs.filter((ord) => !before.has(ord.id)).map((ord) => ord.id))
        if (freshIds.size === 0) return
        setNewOrderIds((cur) => new Set([...cur, ...freshIds]))
        const timer = setTimeout(() => {
            setNewOrderIds((cur) => {
                const next = new Set(cur)
                freshIds.forEach((id) => next.delete(id))
                return next
            })
        }, 4000)
        return () => clearTimeout(timer)
    }, [loadedDocs, page])

    return (
        // No outer card here — the base Table provides the single card; the pager is
        // passed into its footer slot (and rendered under the mobile cards by Inner).
        <div className="flex flex-col w-full">
            <OrdersTableInner
                orders={orders}
                loading={loading}
                selectedRows={selectedRows}
                onSelectionChange={onSelectionChange || (() => { })}
                newOrderIds={newOrderIds}
                footer={shouldShowTablePagination(total) ? (
                    <TablePagination
                        page={page}
                        total={total}
                        limit={limit}
                        onPageChange={(p) => setPage(p)}
                        onLimitChange={(l) => { setLimit(l); setPage(1) }}
                        labels={{ unit: t.dashboard.orders.orders }}
                    />
                ) : undefined}
            />
        </div>
    )
}
