"use client"

import React, { useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { useI18n } from '@/i18n'
import { OrdersMetrics } from './OrdersMetrics'
import { OrdersActionBar } from './OrdersActionBar'
import { OrdersTable, Order } from './OrdersTable'
import { AwaitingVerificationChip } from './AwaitingVerificationChip'

// ─── ORDERS CLIENT LAYOUT ───
// Table spans full width; clicking a row navigates to /orders/[id] (full-page route).
// The old right-slide drawer has been removed — see Phase 02 plan for history.
export function OrdersClientLayout() {
    const { t, ti } = useI18n()
    const o = t.dashboard.orders
    const searchParams = useSearchParams()
    const router = useRouter()

    // Redirect legacy ?order=<id> deep-links to /orders/[id].
    // Intentional: the table renders for one frame before router.replace fires — acceptable flash for
    // a deep-link-only path and not worth an SSR redirect given the dashboard's client-only layout.
    useEffect(() => {
        const legacyOrderId = searchParams.get('order')
        if (legacyOrderId) {
            router.replace(`/orders/${legacyOrderId}`)
        }
    }, [searchParams, router])

    // Refresh the orders table/metrics (client) AND re-render server components so the
    // sidebar pending-orders badge updates without a manual reload (server hook busts its cache).
    function refreshAfterMutation() {
        setRefreshCounter(prev => prev + 1)
        router.refresh()
    }

    const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set())
    const [currentOrders, setCurrentOrders] = useState<Order[]>([])
    const [refreshCounter, setRefreshCounter] = useState(0)
    const [silentRefreshTrigger, setSilentRefreshTrigger] = useState(0)
    const [isConfirming, setIsConfirming] = useState(false)

    // Filters
    const [searchQuery, setSearchQuery] = useState('')
    const [debouncedSearch, setDebouncedSearch] = useState('')
    const [statusFilter, setStatusFilter] = useState('all')
    const [dateFilter, setDateFilter] = useState('all')
    const [paymentMethodFilter, setPaymentMethodFilter] = useState('')
    const [sortOrder, setSortOrder] = useState('-createdAt')

    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedSearch(searchQuery)
        }, 500)
        return () => clearTimeout(handler)
    }, [searchQuery])

    // Listen for ORDER_NEW notification → silently prepend new orders without full reload
    useEffect(() => {
        function handleNotification(e: Event) {
            const detail = (e as CustomEvent).detail
            if (detail?.type === 'ORDER_NEW') {
                setSilentRefreshTrigger(prev => prev + 1)
            }
        }
        window.addEventListener('notification-toast', handleNotification)
        return () => window.removeEventListener('notification-toast', handleNotification)
    }, [])

    const pendingSelectedOrders = Array.from(selectedRows)
        .map(id => currentOrders.find(ord => ord.id === id))
        .filter(ord => ord && ord.status === 'pending')

    const pendingCount = pendingSelectedOrders.length

    async function handleBulkConfirm() {
        if (pendingCount === 0 || isConfirming) return
        setIsConfirming(true)
        try {
            await Promise.all(pendingSelectedOrders.map(async (ord) => {
                const res = await fetch(`/api/orders/${ord!.id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ status: 'confirmed' })
                })
                if (!res.ok) throw new Error('Update failed')
            }))
            toast.success(ti(t.dashboard.orders.toast.bulkSuccess, { count: pendingCount }))
            setSelectedRows(new Set())
            refreshAfterMutation()
        } catch {
            toast.error(t.dashboard.orders.toast.loadFailed)
        } finally {
            setIsConfirming(false)
        }
    }

    return (
        <div className="relative flex flex-col gap-[22px] w-full">
            {/* Page Header */}
            <div className="flex flex-col gap-1 w-full">
                <h1 className="text-2xl font-bold text-dash-text leading-8">
                    {o.pageTitle}
                </h1>
                <p className="text-sm font-normal text-dash-text-muted leading-5">
                    {o.pageSubtitle}
                </p>
            </div>

            <OrdersMetrics refreshCounter={refreshCounter} />
            <AwaitingVerificationChip />
            <OrdersActionBar
                pendingCount={pendingCount}
                onBulkConfirm={handleBulkConfirm}
                isConfirming={isConfirming}
                search={searchQuery}
                onSearch={setSearchQuery}
                onFilterStatus={setStatusFilter}
                onFilterDate={setDateFilter}
                onFilterPaymentMethod={setPaymentMethodFilter}
                onSort={setSortOrder}
            />
            <OrdersTable
                selectedRows={selectedRows}
                onSelectionChange={setSelectedRows}
                onOrdersLoaded={setCurrentOrders}
                refreshCounter={refreshCounter}
                silentRefreshTrigger={silentRefreshTrigger}
                searchQuery={debouncedSearch}
                statusFilter={statusFilter}
                dateFilter={dateFilter}
                paymentMethodFilter={paymentMethodFilter}
                sortOrder={sortOrder}
            />
        </div>
    )
}
