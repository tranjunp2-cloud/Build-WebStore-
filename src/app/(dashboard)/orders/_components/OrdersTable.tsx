"use client"

import React, { useState, useRef, useEffect } from 'react'
import { Package } from 'lucide-react'
import { useI18n } from '@/i18n'
import { TablePagination } from '@/components/ui/table-pagination'
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
import { ORDER_STATUS_LABEL_KEY, type OrderStatus } from '@/lib/orders/status-groups'

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
    pending:         { variant: 'warning',     dotColor: '#FF6900', textColor: '#FF8904', bg: 'rgba(255,105,0,0.1)', borderColor: 'rgba(255,105,0,0.3)' },
    new:             { variant: 'warning',     dotColor: '#FF6900', textColor: '#FF8904', bg: 'rgba(255,105,0,0.1)', borderColor: 'rgba(255,105,0,0.3)' },
    confirmed:       { variant: 'default',     dotColor: '#3B82F6', textColor: '#3B82F6', bg: 'rgba(59,130,246,0.1)', borderColor: 'rgba(59,130,246,0.3)' },
    ready_to_ship:   { variant: 'default',     dotColor: '#3B82F6', textColor: '#3B82F6', bg: 'rgba(59,130,246,0.1)', borderColor: 'rgba(59,130,246,0.3)' },
    shipped:         { variant: 'success',     dotColor: '#00C950', textColor: '#05DF72', bg: 'rgba(0,201,80,0.1)',  borderColor: 'rgba(0,201,80,0.3)' },
    completed:       { variant: 'success',     dotColor: '#00C950', textColor: '#05DF72', bg: 'rgba(0,201,80,0.1)',  borderColor: 'rgba(0,201,80,0.3)' },
    cancelled:       { variant: 'destructive', dotColor: '#FB2C36', textColor: '#FF6467', bg: 'rgba(251,44,54,0.1)', borderColor: 'rgba(251,44,54,0.3)' },
    refunded:        { variant: 'secondary',   dotColor: '#B2354A', textColor: '#B2354A', bg: 'rgba(178,53,74,0.1)', borderColor: '#B2354A' },
    paid:            { variant: 'success',     dotColor: '#00C950', textColor: '#05DF72', bg: 'rgba(0,201,80,0.1)',  borderColor: 'rgba(0,201,80,0.3)' },
    processing:      { variant: 'default',     dotColor: '#3B82F6', textColor: '#3B82F6', bg: 'rgba(59,130,246,0.1)', borderColor: 'rgba(59,130,246,0.3)' },
    payment_failed:  { variant: 'destructive', dotColor: '#FB2C36', textColor: '#FF6467', bg: 'rgba(251,44,54,0.1)', borderColor: 'rgba(251,44,54,0.3)' },
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
function StatusBadge({ status, label }: { status: OrderStatus; label: string }) {
    const cfg = STATUS_BADGE[status] ?? STATUS_BADGE['pending']
    return (
        <Badge
            variant={cfg.variant}
            dot
            className="rounded-full px-2.5 py-0.5 border-solid whitespace-nowrap"
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

// ───────── CHECKBOX (row selection with indeterminate support) ─────────
// Kept as a checkbox (not Switch) because it needs indeterminate state for
// "select all" semantics which Switch does not model.
function Checkbox({
    checked,
    indeterminate,
    onChange,
    inputRef,
    'aria-label': ariaLabel,
}: {
    checked: boolean
    indeterminate?: boolean
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
    inputRef?: React.Ref<HTMLInputElement>
    'aria-label'?: string
}) {
    return (
        <label className="relative flex items-center justify-center cursor-pointer" style={{ width: 18, height: 18 }}>
            <input
                ref={inputRef}
                type="checkbox"
                checked={checked}
                onChange={onChange}
                aria-label={ariaLabel}
                className="peer sr-only"
            />
            <div
                style={{
                    width: 18,
                    height: 18,
                    borderRadius: 6,
                    border: checked || indeterminate ? '1px solid #2563EB' : '1px solid var(--dash-border)',
                    background: checked || indeterminate ? '#2563EB' : 'transparent',
                    transition: 'background 0.2s, border 0.2s'
                }}
            />
            {checked && !indeterminate && (
                <svg
                    width="12"
                    height="12"
                    viewBox="0 0 12 12"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    className="absolute pointer-events-none text-white left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
                >
                    <path
                        d="M10 3L4.5 8.5L2 6"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                </svg>
            )}
            {indeterminate && (
                <svg
                    width="10"
                    height="2"
                    viewBox="0 0 10 2"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    className="absolute pointer-events-none text-white left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
                >
                    <rect width="10" height="2" rx="1" fill="currentColor" />
                </svg>
            )}
        </label>
    )
}

interface InnerTableProps {
    orders: Order[]
    loading: boolean
    onSelectOrder?: (orderId: string) => void
    selectedOrderId?: string | null
    selectedRows: Set<string>
    onSelectionChange: (selectedIds: Set<string>) => void
    newOrderIds?: Set<string>
    /** Pagination row: rendered in the desktop Table card footer + below the mobile cards. */
    footer?: React.ReactNode
}

function OrdersTableInner({ orders, loading, onSelectOrder, selectedOrderId, selectedRows, onSelectionChange, newOrderIds, footer }: InnerTableProps) {
    const { t } = useI18n()
    const o = t.dashboard.orders
    const statusLabels = o.status
    const methodLabels = (o.detail as Record<string, unknown>).paymentMethods as Record<string, string>
    const allSelected = orders.length > 0 && orders.every(ord => selectedRows.has(ord.id))
    const someSelected = orders.some(ord => selectedRows.has(ord.id)) && !allSelected
    const allCheckboxRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        if (allCheckboxRef.current) {
            allCheckboxRef.current.indeterminate = someSelected
        }
    }, [someSelected])

    function toggleAll(e: React.ChangeEvent<HTMLInputElement>) {
        if (e.target.checked) {
            const next = new Set(selectedRows)
            orders.forEach(ord => next.add(ord.id))
            onSelectionChange(next)
        } else {
            const next = new Set(selectedRows)
            orders.forEach(ord => next.delete(ord.id))
            onSelectionChange(next)
        }
    }

    function toggleRow(id: string) {
        const next = new Set(selectedRows)
        if (next.has(id)) next.delete(id)
        else next.add(id)
        onSelectionChange(next)
    }

    // Empty state — shown in place of the table (both mobile and desktop) when not loading and no orders.
    if (!loading && orders.length === 0) {
        return <TableEmptyState icon={<Package />} title={o.tableHeaders.noOrders} />
    }

    return (
        <div className="w-full">
            {/* Mobile View: Stacked Cards */}
            <div className="flex flex-col md:hidden w-full gap-4">
                {loading ? (
                    <div className="p-8 text-center text-slate-400">{o.tableHeaders.loading}</div>
                ) : (
                    orders.map((order) => {
                        const isSelected = selectedRows.has(order.id)
                        const isDetailOpen = selectedOrderId === order.id

                        return (
                            <div
                                key={order.id}
                                onClick={() => { if (onSelectOrder) onSelectOrder(order.id) }}
                                className={`flex flex-row items-start gap-[12px] p-[17px] cursor-pointer border rounded-2xl ${isDetailOpen ? 'bg-blue-500/10 border-blue-500/30' : newOrderIds?.has(order.id) ? 'bg-emerald-500/10 border-emerald-500/30' : isSelected ? 'bg-blue-500/5 border-dash-border' : 'bg-dash-surface border-dash-border'}`}
                                style={{ transition: 'background 1s ease-out, border-color 1s ease-out' }}
                            >
                                <div className="pt-[4px]" onClick={(e) => e.stopPropagation()}>
                                    <Checkbox
                                        checked={isSelected}
                                        onChange={() => toggleRow(order.id)}
                                        aria-label={`Select order ${order.id}`}
                                    />
                                </div>
                                <div className="flex flex-col flex-1 gap-[8px]">
                                    <div className="flex items-center justify-between w-full">
                                        <span className="text-[14px] font-semibold leading-[1.4285714285714286em] text-slate-50 tracking-tight">
                                            {order.orderNumber}
                                        </span>
                                        <StatusBadge status={order.status} label={getStatusLabel(order.status, statusLabels)} />
                                    </div>
                                    <span className="text-[14px] font-medium leading-[1.4285714285714286em] text-slate-400 truncate max-w-[200px]">
                                        {order.customerName || 'N/A'}
                                    </span>
                                    <div className="flex items-center gap-[8px]">
                                        <span className="text-[20px] font-semibold leading-[1.4em] text-slate-50">
                                            {order.currency || 'RM'} {typeof order.total === 'number' ? order.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : order.total}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-[12px]">
                                        <span className="text-[12px] text-slate-400">{order.paymentMethod === 'ewallet' ? xenditChannelLabel(order.xenditChannelCode) : (methodLabels[order.paymentMethod ?? ''] ?? order.paymentMethod ?? '—')}</span>
                                        <span className="text-[12px] text-slate-500">{formatOrderDate(order.createdAt)}</span>
                                    </div>
                                </div>
                            </div>
                        )
                    })
                )}
            </div>

            {/* Mobile pager (the desktop pager lives in the Table card footer slot) */}
            {footer && <div className="md:hidden">{footer}</div>}

            {/* Desktop View: Table — base primitives; pager sits in the card footer slot */}
            <div className="hidden md:block w-full">
                <Table minWidth={1100} className="table-fixed w-full" footer={footer}>
                    {/* table-fixed + % colgroup: 4 middle columns (customer, total, payment,
                        date) equal width (17%); edge columns (order #, status) 16%. All columns
                        left-aligned for an even left-to-right rhythm. */}
                    <colgroup>
                        <col style={{ width: '16%' }} />
                        <col style={{ width: '17%' }} />
                        <col style={{ width: '17%' }} />
                        <col style={{ width: '17%' }} />
                        <col style={{ width: '17%' }} />
                        <col style={{ width: '16%' }} />
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
                            const isDetailOpen = selectedOrderId === order.id

                            return (
                                <TableRow
                                    key={order.id}
                                    clickable
                                    style={{
                                        background: isDetailOpen
                                            ? 'rgba(59,130,246,0.12)'
                                            : newOrderIds?.has(order.id)
                                                ? 'rgba(0,201,80,0.12)'
                                                : isSelected ? 'rgba(59,130,246,0.06)' : undefined,
                                        transition: 'background 1s ease-out',
                                    }}
                                    onMouseEnter={e => {
                                        if (!isSelected && !isDetailOpen && !newOrderIds?.has(order.id))
                                            (e.currentTarget as HTMLTableRowElement).style.background = 'var(--dash-surface-hover)'
                                    }}
                                    onMouseLeave={e => {
                                        if (!isSelected && !isDetailOpen && !newOrderIds?.has(order.id))
                                            (e.currentTarget as HTMLTableRowElement).style.background = ''
                                    }}
                                    onClick={() => {
                                        if (onSelectOrder) onSelectOrder(order.id)
                                    }}
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
    onSelectOrder,
    selectedOrderId,
    refreshCounter = 0,
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
    onSelectOrder?: (orderId: string) => void
    selectedOrderId?: string | null
    refreshCounter?: number
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
    const [orders, setOrders] = useState<Order[]>([])
    const [loading, setLoading] = useState(true)
    const [page, setPage] = useState(1)
    const [total, setTotal] = useState(0)
    const [limit, setLimit] = useState(10)
    const [newOrderIds, setNewOrderIds] = useState<Set<string>>(new Set())
    const { t } = useI18n()

    // Refs keep latest filter values accessible inside the silentFetch effect without
    // adding them as deps (which would turn silent-refresh into a full reload on every filter change)
    const searchQueryRef = useRef(searchQuery)
    const statusFilterRef = useRef(statusFilter)
    const dateFilterRef = useRef(dateFilter)
    const paymentMethodFilterRef = useRef(paymentMethodFilter)
    const sortOrderRef = useRef(sortOrder)
    const onOrdersLoadedRef = useRef(onOrdersLoaded)
    useEffect(() => { searchQueryRef.current = searchQuery }, [searchQuery])
    useEffect(() => { statusFilterRef.current = statusFilter }, [statusFilter])
    useEffect(() => { dateFilterRef.current = dateFilter }, [dateFilter])
    useEffect(() => { paymentMethodFilterRef.current = paymentMethodFilter }, [paymentMethodFilter])
    useEffect(() => { sortOrderRef.current = sortOrder }, [sortOrder])
    useEffect(() => { onOrdersLoadedRef.current = onOrdersLoaded }, [onOrdersLoaded])

    // Track previous filter values to detect changes and compute effectivePage in one effect,
    // avoiding the double-fetch race condition that arises from a separate page-reset effect.
    const prevFiltersRef = useRef({ searchQuery, statusFilter, dateFilter, paymentMethodFilter, sortOrder })

    useEffect(() => {
        const prev = prevFiltersRef.current
        const filtersChanged =
            prev.searchQuery !== searchQuery ||
            prev.statusFilter !== statusFilter ||
            prev.dateFilter !== dateFilter ||
            prev.paymentMethodFilter !== paymentMethodFilter ||
            prev.sortOrder !== sortOrder
        prevFiltersRef.current = { searchQuery, statusFilter, dateFilter, paymentMethodFilter, sortOrder }

        // When filters change, fetch page 1 immediately — don't wait for setPage(1) re-render.
        // Also sync the page state for pagination display.
        const effectivePage = filtersChanged ? 1 : page
        if (filtersChanged && page !== 1) setPage(1)

        async function fetchOrders() {
            try {
                setLoading(true)
                let url = `/api/orders?page=${effectivePage}&limit=${limit}&sort=${encodeURIComponent(sortOrder)}`
                if (searchQuery) url += `&search=${encodeURIComponent(searchQuery)}`
                if (statusFilter && statusFilter !== 'all') url += `&status=${encodeURIComponent(statusFilter)}`
                if (dateFilter && dateFilter !== 'all') url += `&date=${encodeURIComponent(dateFilter)}`
                if (paymentMethodFilter) url += `&paymentMethod=${encodeURIComponent(paymentMethodFilter)}`

                const res = await fetch(url)
                if (!res.ok) throw new Error('Failed to fetch')
                const data = await res.json()

                if (data.success && data.docs) {
                    setOrders(data.docs)
                    setTotal(data.totalDocs ?? data.total ?? data.docs.length)
                    if (onOrdersLoaded) onOrdersLoaded(data.docs)
                }
            } catch (err) {
                console.error("Failed to load orders:", err)
            } finally {
                setLoading(false)
            }
        }
        fetchOrders()
    }, [page, limit, refreshCounter, searchQuery, statusFilter, dateFilter, paymentMethodFilter, sortOrder])

    // Silent background merge — only on page 1, no loading spinner, preserves scroll/selection
    useEffect(() => {
        if (silentRefreshTrigger === 0) return
        if (page !== 1) return

        async function silentFetch() {
            try {
                let url = `/api/orders?page=1&limit=${limit}&sort=${encodeURIComponent(sortOrderRef.current)}`
                // Use refs to read latest filter values — avoids stale closure without triggering full reload on filter change
                if (searchQueryRef.current) url += `&search=${encodeURIComponent(searchQueryRef.current)}`
                if (statusFilterRef.current && statusFilterRef.current !== 'all') url += `&status=${encodeURIComponent(statusFilterRef.current)}`
                if (dateFilterRef.current && dateFilterRef.current !== 'all') url += `&date=${encodeURIComponent(dateFilterRef.current)}`
                if (paymentMethodFilterRef.current) url += `&paymentMethod=${encodeURIComponent(paymentMethodFilterRef.current)}`

                const res = await fetch(url)
                if (!res.ok) return
                const data = await res.json()
                if (!data.success || !data.docs) return

                const incoming: Order[] = data.docs
                // Use a captured variable to read computed fresh IDs after the updater runs.
                // This avoids both stale closure (functional form reads fresh prev) and
                // side-effect-in-updater (setNewOrderIds called outside, once, not in updater).
                let capturedFreshIds: Set<string> | null = null
                setOrders((prev) => {
                    const existingIds = new Set(prev.map((ord) => ord.id))
                    const fresh = incoming.filter((ord) => !existingIds.has(ord.id))
                    if (fresh.length === 0) return prev
                    capturedFreshIds = new Set(fresh.map((ord) => ord.id))
                    return [...fresh, ...prev]
                })
                if (capturedFreshIds) {
                    const freshIds = capturedFreshIds as Set<string>
                    setNewOrderIds((cur) => new Set([...cur, ...freshIds]))
                    setTimeout(() => {
                        setNewOrderIds((cur) => {
                            const next = new Set(cur)
                            freshIds.forEach((id) => next.delete(id))
                            return next
                        })
                    }, 4000)
                }
                if (onOrdersLoadedRef.current) onOrdersLoadedRef.current(incoming)
            } catch (err) {
                console.error('[Orders] Silent refresh failed:', err)
            }
        }
        silentFetch()
    }, [silentRefreshTrigger])

    return (
        // No outer card here — the base Table provides the single card; the pager is
        // passed into its footer slot (and rendered under the mobile cards by Inner).
        <div className="flex flex-col w-full">
            <OrdersTableInner
                orders={orders}
                loading={loading}
                onSelectOrder={onSelectOrder}
                selectedOrderId={selectedOrderId}
                selectedRows={selectedRows}
                onSelectionChange={onSelectionChange || (() => { })}
                newOrderIds={newOrderIds}
                footer={total > 0 ? (
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
