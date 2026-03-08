'use client'

import { useState, useEffect } from 'react'
import {
    ClipboardList, Search, ChevronDown, Loader2,
    Clock, CheckCircle, Truck, Package, XCircle, RefreshCcw,
} from 'lucide-react'
import { cn } from '@/lib/utils'

type Order = {
    id: string
    orderNumber: string
    customerName: string
    customerEmail: string
    total: number
    currency: string
    status: string
    items: Array<{ productName: string; quantity: number; unitPrice: number }>
    createdAt: string
}

const STATUS_CONFIG: Record<string, { color: string; icon: any; label: string }> = {
    pending: { color: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30', icon: Clock, label: 'Pending' },
    paid: { color: 'bg-blue-500/15 text-blue-400 border-blue-500/30', icon: CheckCircle, label: 'Paid' },
    processing: { color: 'bg-purple-500/15 text-purple-400 border-purple-500/30', icon: Package, label: 'Processing' },
    shipped: { color: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30', icon: Truck, label: 'Shipped' },
    completed: { color: 'bg-green-500/15 text-green-400 border-green-500/30', icon: CheckCircle, label: 'Completed' },
    cancelled: { color: 'bg-red-500/15 text-red-400 border-red-500/30', icon: XCircle, label: 'Cancelled' },
    refunded: { color: 'bg-gray-500/15 text-gray-400 border-gray-500/30', icon: RefreshCcw, label: 'Refunded' },
}

function formatPrice(amount: number, currency: string) {
    if (currency === 'MYR') return `RM ${amount.toFixed(2)}`
    if (currency === 'SGD') return `S$${amount.toFixed(2)}`
    return `$${amount.toFixed(2)}`
}

export default function OrdersPage() {
    const [orders, setOrders] = useState<Order[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [filterStatus, setFilterStatus] = useState<string>('all')
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)

    useEffect(() => {
        loadOrders()
    }, [])

    const loadOrders = async () => {
        setIsLoading(true)
        try {
            const res = await fetch('/api/orders', { credentials: 'include' })
            if (res.ok) {
                const data = await res.json()
                setOrders(data.docs || [])
            }
        } catch (err) {
            console.error('Failed to load orders', err)
        } finally {
            setIsLoading(false)
        }
    }

    const filtered = orders.filter(o =>
        filterStatus === 'all' || o.status === filterStatus
    )

    if (!isLoading && orders.length === 0) {
        return (
            <div className="flex h-full items-center justify-center">
                <div className="text-center">
                    <ClipboardList className="mx-auto h-12 w-12 text-gray-600" />
                    <h2 className="mt-4 text-lg font-semibold text-white">No orders yet</h2>
                    <p className="mt-1 text-sm text-gray-500">Orders will appear here when customers make purchases</p>
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-white">Orders</h1>
                <p className="mt-1 text-sm text-gray-400">{orders.length} order{orders.length !== 1 ? 's' : ''}</p>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-1 rounded-lg border border-white/10 bg-[#1E293B] p-0.5">
                {['all', 'pending', 'paid', 'processing', 'shipped', 'completed', 'cancelled'].map(s => (
                    <button key={s} onClick={() => setFilterStatus(s)}
                        className={cn('rounded-md px-3 py-1.5 text-xs font-medium transition-colors capitalize',
                            filterStatus === s ? 'bg-blue-500/15 text-blue-400' : 'text-gray-500 hover:text-gray-300')}>
                        {s}
                    </button>
                ))}
            </div>

            {isLoading ? (
                <div className="flex h-48 items-center justify-center">
                    <Loader2 className="h-6 w-6 animate-spin text-blue-400" />
                </div>
            ) : (
                <div className="rounded-xl border border-white/10 bg-[#1E293B]/30 overflow-hidden">
                    <div className="grid grid-cols-[1fr_140px_100px_120px_100px] gap-4 border-b border-white/10 px-6 py-3 text-xs font-medium uppercase text-gray-500">
                        <span>Order</span>
                        <span>Customer</span>
                        <span>Total</span>
                        <span>Status</span>
                        <span>Date</span>
                    </div>

                    <div className="divide-y divide-white/5">
                        {filtered.map(order => {
                            const statusConfig = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending
                            const StatusIcon = statusConfig.icon
                            return (
                                <button key={order.id}
                                    onClick={() => setSelectedOrder(selectedOrder?.id === order.id ? null : order)}
                                    className="grid w-full grid-cols-[1fr_140px_100px_120px_100px] gap-4 px-6 py-4 text-left hover:bg-white/5 transition-colors items-center">
                                    <div>
                                        <p className="text-sm font-medium text-white">#{order.orderNumber}</p>
                                        <p className="text-xs text-gray-500">{order.items.length} item{order.items.length !== 1 ? 's' : ''}</p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-white truncate">{order.customerName}</p>
                                        <p className="text-xs text-gray-500 truncate">{order.customerEmail}</p>
                                    </div>
                                    <p className="text-sm font-medium text-white">{formatPrice(order.total, order.currency)}</p>
                                    <span className={cn('inline-flex w-fit items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium', statusConfig.color)}>
                                        <StatusIcon className="h-2.5 w-2.5" /> {statusConfig.label}
                                    </span>
                                    <span className="text-xs text-gray-500">
                                        {new Date(order.createdAt).toLocaleDateString('en-MY')}
                                    </span>
                                </button>
                            )
                        })}
                    </div>

                    {filtered.length === 0 && (
                        <div className="py-12 text-center text-sm text-gray-500">
                            No orders match your filters
                        </div>
                    )}
                </div>
            )}

            {/* Order Detail Drawer */}
            {selectedOrder && (
                <div className="rounded-xl border border-white/10 bg-[#1E293B]/60 p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-white">Order #{selectedOrder.orderNumber}</h3>
                        <button onClick={() => setSelectedOrder(null)} className="text-gray-500 hover:text-white text-sm">Close ✕</button>
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                            <p className="text-gray-500">Customer</p>
                            <p className="text-white">{selectedOrder.customerName}</p>
                            <p className="text-gray-400">{selectedOrder.customerEmail}</p>
                        </div>
                        <div>
                            <p className="text-gray-500">Total</p>
                            <p className="text-2xl font-bold text-white">{formatPrice(selectedOrder.total, selectedOrder.currency)}</p>
                        </div>
                    </div>

                    <div className="mt-4">
                        <p className="text-xs font-medium uppercase text-gray-500 mb-2">Items</p>
                        <div className="space-y-2">
                            {selectedOrder.items.map((item, i) => (
                                <div key={i} className="flex items-center justify-between rounded-lg bg-white/5 px-4 py-2">
                                    <div>
                                        <p className="text-sm text-white">{item.productName}</p>
                                        <p className="text-xs text-gray-500">Qty: {item.quantity}</p>
                                    </div>
                                    <p className="text-sm font-medium text-white">{formatPrice(item.unitPrice * item.quantity, selectedOrder.currency)}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
