"use client"

import React, { useState, useRef, useEffect } from 'react'
import { Package } from 'lucide-react'
import { useI18n } from '@/i18n'
import { OrdersPagination } from './OrdersPagination'

// ───────── TYPES ─────────
export type OrderStatus = 'pending' | 'new' | 'confirmed' | 'ready_to_ship' | 'shipped' | 'completed' | 'cancelled' | 'refunded' | 'paid' | 'payment_failed' | 'processing'

export interface Order {
    id: string
    orderNumber: string
    customerName: string
    total: number
    currency: string
    status: OrderStatus
    paymentMethod?: string | null
    createdAt?: string | null
}

const STATUS_STYLE: Record<OrderStatus, { bg: string; borderColor: string; dotColor: string; textColor: string }> = {
    'pending': { bg: 'rgba(255,105,0,0.1)', borderColor: 'rgba(255,105,0,0.3)', dotColor: '#FF6900', textColor: '#FF8904' },
    'new': { bg: 'rgba(255,105,0,0.1)', borderColor: 'rgba(255,105,0,0.3)', dotColor: '#FF6900', textColor: '#FF8904' },
    'confirmed': { bg: 'rgba(59,130,246,0.1)', borderColor: 'rgba(59,130,246,0.3)', dotColor: '#3B82F6', textColor: '#3B82F6' },
    'ready_to_ship': { bg: 'rgba(59,130,246,0.1)', borderColor: 'rgba(59,130,246,0.3)', dotColor: '#3B82F6', textColor: '#3B82F6' },
    'shipped': { bg: 'rgba(0,201,80,0.1)', borderColor: 'rgba(0,201,80,0.3)', dotColor: '#00C950', textColor: '#05DF72' },
    'completed': { bg: 'rgba(0,201,80,0.1)', borderColor: 'rgba(0,201,80,0.3)', dotColor: '#00C950', textColor: '#05DF72' },
    'cancelled': { bg: 'rgba(251,44,54,0.1)', borderColor: 'rgba(251,44,54,0.3)', dotColor: '#FB2C36', textColor: '#FF6467' },
    'refunded': { bg: 'rgba(178,53,74,0.1)', borderColor: '#B2354A', dotColor: '#B2354A', textColor: '#B2354A' },
    'paid': { bg: 'rgba(0,201,80,0.1)', borderColor: 'rgba(0,201,80,0.3)', dotColor: '#00C950', textColor: '#05DF72' },
    'processing': { bg: 'rgba(59,130,246,0.1)', borderColor: 'rgba(59,130,246,0.3)', dotColor: '#3B82F6', textColor: '#3B82F6' },
    'payment_failed': { bg: 'rgba(251,44,54,0.1)', borderColor: 'rgba(251,44,54,0.3)', dotColor: '#FB2C36', textColor: '#FF6467' },
}

function getStatusLabel(status: OrderStatus, statusLabels: Record<string, string>): string {
    const keyMap: Record<OrderStatus, string> = {
        'pending': 'pending',
        'new': 'pending',
        'confirmed': 'confirmed',
        'ready_to_ship': 'readyToShip',
        'shipped': 'shipped',
        'completed': 'completed',
        'cancelled': 'cancelled',
        'refunded': 'refunded',
        'paid': 'paid',
        'processing': 'processing',
        'payment_failed': 'pending',
    }
    return (statusLabels as any)[keyMap[status]] || status
}


function formatOrderDate(iso?: string | null): string {
    if (!iso) return '—'
    const d = new Date(iso)
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

// ───────── STATUS BADGE COMPONENT ─────────
function StatusBadge({ status, label }: { status: OrderStatus; label: string }) {
    const cfg = STATUS_STYLE[status] || STATUS_STYLE['pending']
    return (
        <span
            className="inline-flex items-center rounded-[12px]"
            style={{
                background: cfg.bg,
                border: `1px solid ${cfg.borderColor}`,
                gap: '8px',
                padding: '5px 13px',
            }}
        >
            <span
                className="shrink-0 rounded-full"
                style={{ width: 8, height: 8, background: cfg.dotColor }}
            />
            <span
                style={{
                    fontFamily: 'Inter, sans-serif',
                    fontWeight: 500,
                    fontSize: 14,
                    lineHeight: '1.4285714285714286em',
                    color: cfg.textColor,
                    whiteSpace: 'nowrap',
                }}
            >
                {label}
            </span>
        </span>
    )
}

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

function HeaderCell({ children }: { children: React.ReactNode }) {
    return (
        <span
            style={{
                fontFamily: 'Inter, sans-serif',
                fontWeight: 600,
                fontSize: 12,
                lineHeight: '1.3333333333333333em',
                letterSpacing: '0.025em',
                textTransform: 'uppercase',
                color: 'var(--dash-text-muted)',
            }}
        >
            {children}
        </span>
    )
}

function EmptyOrderState({ text }: { text: string }) {
    return (
        <div className="flex flex-col w-full items-center justify-center gap-[16px] py-[64px]">
            <Package className="w-[64px] h-[64px] text-[rgba(248,250,252,0.2)]" strokeWidth={2} />
            <span
                style={{
                    fontFamily: 'Inter, sans-serif',
                    fontWeight: 400,
                    fontSize: 16,
                    lineHeight: '1.5em',
                    color: 'var(--dash-text-muted)',
                }}
            >
                {text}
            </span>
        </div>
    )
}

interface TableProps {
    orders: Order[]
    loading: boolean
    onSelectOrder?: (orderId: string) => void
    selectedOrderId?: string | null
    selectedRows: Set<string>
    onSelectionChange: (selectedIds: Set<string>) => void
    newOrderIds?: Set<string>
}

function Table({ orders, loading, onSelectOrder, selectedOrderId, selectedRows, onSelectionChange, newOrderIds }: TableProps) {
    const { t } = useI18n()
    const o = t.dashboard.orders
    const statusLabels = o.status
    const methodLabels = (o.detail as any).paymentMethods as Record<string, string>
    const allSelected = orders.length > 0 && orders.every(o => selectedRows.has(o.id))
    const someSelected = orders.some(o => selectedRows.has(o.id)) && !allSelected
    const allCheckboxRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        if (allCheckboxRef.current) {
            allCheckboxRef.current.indeterminate = someSelected
        }
    }, [someSelected])

    function toggleAll(e: React.ChangeEvent<HTMLInputElement>) {
        if (e.target.checked) {
            const next = new Set(selectedRows)
            orders.forEach(o => next.add(o.id))
            onSelectionChange(next)
        } else {
            const next = new Set(selectedRows)
            orders.forEach(o => next.delete(o.id))
            onSelectionChange(next)
        }
    }

    function toggleRow(id: string) {
        const next = new Set(selectedRows)
        if (next.has(id)) next.delete(id)
        else next.add(id)
        onSelectionChange(next)
    }

    return (
        <div className="w-full">
            {/* Mobile View: Stacked Cards */}
            <div className="flex flex-col md:hidden w-full gap-4">
                {loading ? (
                    <div className="p-8 text-center text-slate-400">{o.tableHeaders.loading}</div>
                ) : orders.length === 0 ? (
                    <EmptyOrderState text={o.tableHeaders.noOrders} />
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
                                        <span className="text-[12px] text-slate-400">{methodLabels[order.paymentMethod ?? ''] ?? order.paymentMethod ?? '—'}</span>
                                        <span className="text-[12px] text-slate-500">{formatOrderDate(order.createdAt)}</span>
                                    </div>
                                </div>
                            </div>
                        )
                    })
                )}
            </div>

            {/* Desktop View: Table */}
            <div className="hidden md:block w-full overflow-x-auto overflow-y-auto" style={{ maxHeight: 685 }}>
                <table
                    className="w-full border-collapse"
                    style={{ tableLayout: 'fixed', minWidth: 1100 }}
                >
                    <colgroup>
                        <col style={{ width: '16%' }} />
                        <col style={{ width: '22%' }} />
                        <col style={{ width: '13%' }} />
                        <col style={{ width: '16%' }} />
                        <col style={{ width: '14%' }} />
                        <col style={{ width: '19%' }} />
                    </colgroup>

                    <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                        <tr style={{ background: 'var(--dash-surface)' }}>
                            <th className="text-left" style={{ height: 56, padding: '20px 24px' }}>
                                <HeaderCell>{o.tableHeaders.orderNumber}</HeaderCell>
                            </th>
                            <th className="text-left" style={{ height: 56, padding: '20px 24px' }}>
                                <HeaderCell>{o.tableHeaders.customer}</HeaderCell>
                            </th>
                            <th className="text-left" style={{ height: 56, padding: '20px 24px' }}>
                                <HeaderCell>{o.tableHeaders.total}</HeaderCell>
                            </th>
                            <th className="text-left" style={{ height: 56, padding: '20px 24px' }}>
                                <HeaderCell>{o.tableHeaders.paymentMethod}</HeaderCell>
                            </th>
                            <th className="text-left" style={{ height: 56, padding: '20px 24px' }}>
                                <HeaderCell>{o.tableHeaders.orderDate}</HeaderCell>
                            </th>
                            <th className="text-left" style={{ height: 56, padding: '20px 24px' }}>
                                <HeaderCell>{o.tableHeaders.status}</HeaderCell>
                            </th>
                        </tr>
                    </thead>

                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan={6} style={{ padding: '60px 24px', textAlign: 'center' }}>
                                    <span style={{ color: 'var(--dash-text-muted)' }}>{o.tableHeaders.loading}</span>
                                </td>
                            </tr>
                        ) : orders.length === 0 ? (
                            <tr>
                                <td colSpan={6} style={{ padding: 0 }}>
                                    <EmptyOrderState text={o.tableHeaders.noOrders} />
                                </td>
                            </tr>
                        ) : orders.map((order, i) => {
                            const isEdgeRow = i === 0 || i === orders.length - 1
                            const rowHeight = isEdgeRow ? 62 : 63
                            const textPadY = isEdgeRow ? 21 : 21.5
                            const isSelected = selectedRows.has(order.id)
                            const isDetailOpen = selectedOrderId === order.id

                            return (
                                <tr
                                    key={order.id}
                                    className="cursor-pointer"
                                    style={{
                                        height: rowHeight,
                                        borderBottom: i < orders.length - 1
                                            ? '1px solid var(--dash-border)'
                                            : 'none',
                                        background: isDetailOpen
                                            ? 'rgba(59,130,246,0.12)'
                                            : newOrderIds?.has(order.id)
                                                ? 'rgba(0,201,80,0.12)'
                                                : isSelected ? 'rgba(59,130,246,0.06)' : undefined,
                                        transition: 'background 1s ease-out',
                                    }}
                                    onMouseEnter={e => {
                                        if (!isSelected && !isDetailOpen && !newOrderIds?.has(order.id)) (e.currentTarget as HTMLTableRowElement).style.background = 'var(--dash-surface-hover)'
                                    }}
                                    onMouseLeave={e => {
                                        if (!isSelected && !isDetailOpen && !newOrderIds?.has(order.id)) (e.currentTarget as HTMLTableRowElement).style.background = ''
                                    }}
                                    onClick={() => {
                                        if (onSelectOrder) onSelectOrder(order.id)
                                    }}
                                >
                                    <td style={{ padding: `${textPadY}px 24px` }}>
                                        <span
                                            style={{
                                                fontFamily: 'Inter, sans-serif',
                                                fontWeight: 600,
                                                fontSize: 14,
                                                lineHeight: '1.4285714285714286em',
                                                color: 'var(--dash-text)',
                                            }}
                                        >
                                            {order.orderNumber}
                                        </span>
                                    </td>
                                    <td style={{ padding: `${textPadY}px 24px` }}>
                                        <span
                                            style={{
                                                fontFamily: 'Inter, sans-serif',
                                                fontWeight: 400,
                                                fontSize: 14,
                                                lineHeight: '1.4285714285714286em',
                                                color: 'var(--dash-text)',
                                            }}
                                        >
                                            {order.customerName || 'N/A'}
                                        </span>
                                    </td>
                                    <td style={{ padding: `${textPadY}px 24px` }}>
                                        <span
                                            style={{
                                                fontFamily: 'Inter, sans-serif',
                                                fontWeight: 600,
                                                fontSize: 14,
                                                lineHeight: '1.4285714285714286em',
                                                color: 'var(--dash-text)',
                                            }}
                                        >
                                            {order.currency || 'RM'} {typeof order.total === 'number' ? order.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : order.total}
                                        </span>
                                    </td>
                                    <td style={{ padding: `${textPadY}px 24px` }}>
                                        <span
                                            style={{
                                                fontFamily: 'Inter, sans-serif',
                                                fontWeight: 400,
                                                fontSize: 14,
                                                lineHeight: '1.4285714285714286em',
                                                color: 'var(--dash-text-muted)',
                                            }}
                                        >
                                            {methodLabels[order.paymentMethod ?? ''] ?? order.paymentMethod ?? '—'}
                                        </span>
                                    </td>
                                    <td style={{ padding: `${textPadY}px 24px` }}>
                                        <span
                                            style={{
                                                fontFamily: 'Inter, sans-serif',
                                                fontWeight: 400,
                                                fontSize: 13,
                                                lineHeight: '1.4285714285714286em',
                                                color: 'var(--dash-text-muted)',
                                                whiteSpace: 'nowrap',
                                            }}
                                        >
                                            {formatOrderDate(order.createdAt)}
                                        </span>
                                    </td>
                                    <td style={{ padding: '16px 24px' }}>
                                        <StatusBadge status={order.status} label={getStatusLabel(order.status, statusLabels)} />
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
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
    const [totalPages, setTotalPages] = useState(1)
    const [newOrderIds, setNewOrderIds] = useState<Set<string>>(new Set())

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
                let url = `/api/orders?page=${effectivePage}&limit=10&sort=${encodeURIComponent(sortOrder)}`
                if (searchQuery) url += `&search=${encodeURIComponent(searchQuery)}`
                if (statusFilter && statusFilter !== 'all') url += `&status=${encodeURIComponent(statusFilter)}`
                if (dateFilter && dateFilter !== 'all') url += `&date=${encodeURIComponent(dateFilter)}`
                if (paymentMethodFilter) url += `&paymentMethod=${encodeURIComponent(paymentMethodFilter)}`

                const res = await fetch(url)
                if (!res.ok) throw new Error('Failed to fetch')
                const data = await res.json()

                if (data.success && data.docs) {
                    setOrders(data.docs)
                    setTotalPages(data.totalPages || 1)
                    if (onOrdersLoaded) onOrdersLoaded(data.docs)
                }
            } catch (err) {
                console.error("Failed to load orders:", err)
            } finally {
                setLoading(false)
            }
        }
        fetchOrders()
    }, [page, refreshCounter, searchQuery, statusFilter, dateFilter, paymentMethodFilter, sortOrder])

    // Silent background merge — only on page 1, no loading spinner, preserves scroll/selection
    useEffect(() => {
        if (silentRefreshTrigger === 0) return
        if (page !== 1) return

        async function silentFetch() {
            try {
                let url = `/api/orders?page=1&limit=10&sort=${encodeURIComponent(sortOrderRef.current)}`
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
                    const existingIds = new Set(prev.map((o) => o.id))
                    const fresh = incoming.filter((o) => !existingIds.has(o.id))
                    if (fresh.length === 0) return prev
                    capturedFreshIds = new Set(fresh.map((o) => o.id))
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
                setTotalPages(data.totalPages || 1)
                if (onOrdersLoadedRef.current) onOrdersLoadedRef.current(incoming)
            } catch (err) {
                console.error('[Orders] Silent refresh failed:', err)
            }
        }
        silentFetch()
    }, [silentRefreshTrigger])

    return (
        <div
            className="flex flex-col w-full md:rounded-[16px] md:overflow-hidden md:bg-slate-800/60 md:border md:border-white/[0.08] md:p-[1px]"
        >
            <Table
                orders={orders}
                loading={loading}
                onSelectOrder={onSelectOrder}
                selectedOrderId={selectedOrderId}
                selectedRows={selectedRows}
                onSelectionChange={onSelectionChange || (() => { })}
                newOrderIds={newOrderIds}
            />

            <div className="flex items-center justify-end px-6 py-3">
                <OrdersPagination
                    currentPage={page}
                    totalPages={totalPages}
                    onPageChange={(p) => setPage(p)}
                />
            </div>
        </div>
    )
}
