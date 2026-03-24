'use client'

import { useState, useEffect } from 'react'
import { Truck, CheckCircle, Search, SlidersHorizontal, PackageOpen, ArrowUpDown, Banknote, QrCode } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useI18n } from '@/i18n'
import type { Order } from './types'
import { STATUS_CONFIG, formatPrice } from './types'
import { EmptyState } from './components/OrdersEmptyState'
import { OrdersStatsBar } from './components/OrdersStatsBar'
import { OrderDrawer } from './components/OrderDrawer'
import { OrderStatusBadge } from './components/OrderStatusBadge'
import { CancelOrderModal } from './components/CancelOrderModal'

export default function OrdersPage() {
    const { t } = useI18n()
    const o = t.dashboard.orders
    const [orders, setOrders] = useState<Order[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [filterStatus, setFilterStatus] = useState<string>('all')
    const [filterPayment, setFilterPayment] = useState<string>('all')
    const [searchQuery, setSearchQuery] = useState('')
    const [sortBy, setSortBy] = useState<string>('date_desc')
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)

    // Cancel state
    const [cancellingOrderId, setCancellingOrderId] = useState<string | null>(null)
    const [isCancelling, setIsCancelling] = useState(false)

    // Bulk action state
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
    const [isBulkConfirming, setIsBulkConfirming] = useState(false)
    const [updatingId, setUpdatingId] = useState<string | null>(null)

    const fetchOrders = async (silent = false) => {
        if (!silent) setIsLoading(true)
        try {
            const res = await fetch('/api/orders', { credentials: 'include' })
            if (!res.ok) throw new Error('Failed to load')
            const data = await res.json()
            setOrders(data.docs || [])
        } catch (err: any) {
            console.error('[Load Orders]', err)
            if (!silent) toast.error(o.toast.loadFailed)
        } finally {
            setIsLoading(false)
        }
    }

    // Auto-refresh every 60s (AC-1)
    useEffect(() => {
        fetchOrders()
        const interval = setInterval(() => fetchOrders(true), 60000)
        return () => clearInterval(interval)
    }, [])

    const handleStatusChange = async (id: string, newStatus: string) => {
        if (newStatus === 'cancelled') {
            setCancellingOrderId(id)
            return
        }

        setUpdatingId(id)
        try {
            const res = await fetch(`/api/orders/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error?.message || 'Update failed')

            toast.success(o.toast.updated)

            // Sync local state
            setOrders(prev => prev.map(order => order.id === id ? { ...order, status: newStatus as any } : order))
            if (selectedOrder?.id === id) {
                setSelectedOrder(prev => prev ? { ...prev, status: newStatus as any } : null)
            }
        } catch (error: any) {
            toast.error(o.toast.updateFailed.replace('{message}', error.message))
        } finally {
            setUpdatingId(null)
        }
    }

    const confirmCancelOrder = async (reason: string) => {
        if (!cancellingOrderId) return
        setIsCancelling(true)
        try {
            const res = await fetch(`/api/orders/${cancellingOrderId}/cancel`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ reason }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error?.message || 'Cancel failed')

            toast.success('Order cancelled successfully')

            // Sync local state
            setOrders(prev => prev.map(order => order.id === cancellingOrderId ? { ...order, status: 'cancelled', cancelReason: reason } : order))
            if (selectedOrder?.id === cancellingOrderId) {
                setSelectedOrder(prev => prev ? { ...prev, status: 'cancelled', cancelReason: reason } : null)
            }
            setCancellingOrderId(null)
        } catch (error: any) {
            toast.error(error.message)
        } finally {
            setIsCancelling(false)
        }
    }

    const handleBulkConfirm = async () => {
        const ids = Array.from(selectedIds)
        if (!ids.length) return

        setIsBulkConfirming(true)
        try {
            const res = await fetch('/api/orders/bulk-update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ orderIds: ids, status: 'confirmed' }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error?.message || 'Bulk update failed')

            toast.success(o.toast.bulkSuccess.replace('{count}', data.data.succeeded))
            if (data.data.failed > 0) {
                toast.error(o.toast.bulkFailed.replace('{count}', data.data.failed))
            }

            setSelectedIds(new Set())
            fetchOrders(true)
        } catch (error: any) {
            toast.error(o.toast.updateFailed.replace('{message}', error.message))
        } finally {
            setIsBulkConfirming(false)
        }
    }

    const filtered = orders
        .filter(order =>
            (filterStatus === 'all' || order.status === filterStatus) &&
            (filterPayment === 'all' || order.paymentMethod === filterPayment) &&
            (searchQuery === '' ||
                order.orderNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
                order.customerName.toLowerCase().includes(searchQuery.toLowerCase()))
        )
        .sort((a, b) => {
            switch (sortBy) {
                case 'date_asc':
                    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
                case 'total_desc':
                    return b.total - a.total
                case 'total_asc':
                    return a.total - b.total
                case 'date_desc':
                default:
                    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            }
        })

    const pendingCount = filtered.filter(order => order.status === 'pending').length
    const canBulkConfirm = selectedIds.size > 0 && Array.from(selectedIds).every(id =>
        orders.find(order => order.id === id)?.status === 'pending'
    )

    // Filter tabs config
    const filterTabs = [
        { key: 'all', label: o.filters.all },
        { key: 'pending', label: o.filters.pending },
        { key: 'confirmed', label: o.filters.confirmed },
        { key: 'ready_to_ship', label: o.filters.readyToShip },
        { key: 'shipped', label: o.filters.shipped },
        { key: 'completed', label: o.filters.completed },
        { key: 'cancelled', label: o.filters.cancelled },
    ]

    if (!isLoading && orders.length === 0) {
        return (
            <div className="space-y-6">
                <div>
                    <h1 className="text-2xl font-bold text-white">{o.title}</h1>
                    <p className="mt-1 text-sm text-gray-400">{o.trackOrders}</p>
                </div>
                {/* Empty State components */}
                <div className="rounded-xl border border-white/10 bg-[#1E293B]/30 backdrop-blur-sm overflow-hidden">
                    <EmptyState
                        icon={PackageOpen}
                        title={o.noOrdersYet}
                        description={o.noOrdersDesc}
                    />
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-6 relative min-h-[80vh]">
            {/* Header & Stats */}
            <div className="flex flex-col gap-6 md:flex-row justify-between md:items-end">
                <div>
                    <h1 className="text-2xl font-bold text-white">{o.title}</h1>
                    <p className="mt-1 text-sm text-gray-400">{o.subtitle}</p>
                </div>
                {canBulkConfirm && (
                    <button
                        disabled={isBulkConfirming}
                        onClick={handleBulkConfirm}
                        className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-medium text-white transition-colors hover:bg-blue-500 disabled:opacity-50"
                    >
                        {isBulkConfirming ? <span className="animate-spin text-lg">↻</span> : <CheckCircle className="h-4 w-4" />}
                        {o.confirm} {selectedIds.size} {o.orders}
                    </button>
                )}
            </div>

            <OrdersStatsBar orders={orders} />

            {/* Toolbar (Search, Sort & Filters) */}
            <div className="flex flex-col gap-4">
                {/* Row 1: Search + Sort */}
                <div className="flex flex-col gap-3 sm:flex-row justify-between">
                    <div className="relative w-full sm:w-72">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder={o.search}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full rounded-lg border border-white/10 bg-[#1E293B]/60 pl-9 pr-4 py-2 text-sm text-white placeholder:text-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors"
                        />
                    </div>

                    {/* Sort Dropdown */}
                    <div className="relative">
                        <ArrowUpDown className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                        <select
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value)}
                            className="appearance-none rounded-lg border border-white/10 bg-[#1E293B]/60 pl-9 pr-8 py-2 text-sm text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors cursor-pointer"
                        >
                            <option value="date_desc">Date: Newest first</option>
                            <option value="date_asc">Date: Oldest first</option>
                            <option value="total_desc">Total: High → Low</option>
                            <option value="total_asc">Total: Low → High</option>
                        </select>
                    </div>
                </div>

                {/* Row 2: Status tabs + Payment filter */}
                <div className="flex flex-col gap-3 sm:flex-row justify-between">
                    <div className="flex flex-nowrap overflow-x-auto gap-1 rounded-lg border border-white/10 bg-[#1E293B] p-0.5 whitespace-nowrap scrollbar-hide">
                        {filterTabs.map(tab => (
                            <button key={tab.key} onClick={() => setFilterStatus(tab.key)}
                                className={cn('rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                                    filterStatus === tab.key ? 'bg-blue-500/15 text-blue-400' : 'text-gray-500 hover:text-gray-300')}>
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    {/* Payment method filter */}
                    <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-[#1E293B] p-0.5">
                        <button onClick={() => setFilterPayment('all')}
                            className={cn('rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                                filterPayment === 'all' ? 'bg-emerald-500/15 text-emerald-400' : 'text-gray-500 hover:text-gray-300')}>
                            All Pay
                        </button>
                        <button onClick={() => setFilterPayment('cod')}
                            className={cn('rounded-md px-3 py-1.5 text-xs font-medium transition-colors inline-flex items-center gap-1.5',
                                filterPayment === 'cod' ? 'bg-emerald-500/15 text-emerald-400' : 'text-gray-500 hover:text-gray-300')}>
                            <Banknote className="h-3 w-3" /> COD
                        </button>
                        <button onClick={() => setFilterPayment('qr_banking')}
                            className={cn('rounded-md px-3 py-1.5 text-xs font-medium transition-colors inline-flex items-center gap-1.5',
                                filterPayment === 'qr_banking' ? 'bg-emerald-500/15 text-emerald-400' : 'text-gray-500 hover:text-gray-300')}>
                            <QrCode className="h-3 w-3" /> QR Banking
                        </button>
                    </div>
                </div>
            </div>

            {/* List / Table */}
            <div className="rounded-xl border border-white/10 bg-[#1E293B]/30 overflow-hidden">
                <div className="hidden sm:grid grid-cols-[40px_1fr_140px_100px_140px_100px] gap-4 border-b border-white/10 px-6 py-3 text-xs font-medium uppercase text-gray-500">
                    <div className="flex items-center">
                        <input
                            type="checkbox"
                            className="rounded border-white/20 bg-white/5"
                            checked={selectedIds.size === filtered.length && filtered.length > 0}
                            onChange={(e) => {
                                if (e.target.checked) setSelectedIds(new Set(filtered.map(order => order.id)))
                                else setSelectedIds(new Set())
                            }}
                        />
                    </div>
                    <span>{o.table.orderId}</span>
                    <span>{o.table.items}</span>
                    <span>{o.table.total}</span>
                    <span>{o.table.status}</span>
                    <span>{o.table.date}</span>
                </div>

                <div className="divide-y divide-white/5">
                    {filtered.map(order => (
                        <div key={order.id} className="relative block w-full sm:grid sm:grid-cols-[40px_1fr_140px_100px_140px_100px] gap-2 sm:gap-4 px-4 sm:px-6 py-4 hover:bg-white/5 transition-colors sm:items-center">

                            {/* Checkbox */}
                            <div className="absolute top-4 right-4 sm:static sm:flex sm:items-center -mt-0.5">
                                <input
                                    type="checkbox"
                                    className="rounded border-white/20 bg-white/5"
                                    checked={selectedIds.has(order.id)}
                                    onChange={(e) => {
                                        const newSet = new Set(selectedIds)
                                        if (e.target.checked) newSet.add(order.id)
                                        else newSet.delete(order.id)
                                        setSelectedIds(newSet)
                                    }}
                                />
                            </div>

                            {/* Info */}
                            <div className="cursor-pointer" onClick={() => setSelectedOrder(order)}>
                                <p className="text-sm font-medium text-white">#{order.orderNumber}</p>
                                <p className="text-sm text-gray-400 mt-0.5 truncate">{order.customerName}</p>
                            </div>

                            {/* Items count */}
                            <div className="text-sm text-gray-500 cursor-pointer hidden sm:block" onClick={() => setSelectedOrder(order)}>
                                {order.items.length} {order.items.length !== 1 ? o.table.itemPlural : o.table.item}
                            </div>

                            {/* Total */}
                            <div className="text-sm font-medium text-white cursor-pointer mt-2 sm:mt-0" onClick={() => setSelectedOrder(order)}>
                                {formatPrice(order.total, order.currency)}
                            </div>

                            {/* Status */}
                            <div className="mt-2 sm:mt-0 flex items-center">
                                <OrderStatusBadge
                                    order={order}
                                    onStatusChange={handleStatusChange}
                                    isUpdating={updatingId}
                                />
                            </div>

                            {/* Date */}
                            <div className="text-xs text-gray-500 mt-2 sm:mt-0 cursor-pointer hidden sm:block" onClick={() => setSelectedOrder(order)}>
                                {new Date(order.createdAt).toLocaleDateString('en-MY')}
                            </div>
                        </div>
                    ))}
                </div>

                {filtered.length === 0 && (
                    <div className="py-12 text-center text-sm text-gray-500">
                        {o.noOrdersFound}
                    </div>
                )}
            </div>

            {/* Overlays */}
            {selectedOrder && (
                <>
                    <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={() => setSelectedOrder(null)} />
                    <OrderDrawer
                        order={selectedOrder}
                        onClose={() => setSelectedOrder(null)}
                        onStatusChange={handleStatusChange}
                        isUpdating={updatingId}
                    />
                </>
            )}

            <CancelOrderModal
                isOpen={cancellingOrderId !== null}
                onClose={() => setCancellingOrderId(null)}
                onConfirm={confirmCancelOrder}
                isSubmitting={isCancelling}
            />
        </div>
    )
}
