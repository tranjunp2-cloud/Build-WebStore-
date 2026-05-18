"use client"

import React, { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { useI18n } from '@/i18n'
import { OrdersMetrics } from './OrdersMetrics'
import { OrdersActionBar } from './OrdersActionBar'
import { OrdersTable, Order } from './OrdersTable'
import { OrderDetailPanel } from './OrderDetailPanel'
import { AwaitingVerificationChip } from './AwaitingVerificationChip'

// ─── ORDERS CLIENT LAYOUT ───
// Table stays full width at all times.
// OrderDetailPanel slides in as a FIXED overlay from the right edge of the screen.
export function OrdersClientLayout() {
    const { t, ti } = useI18n()
    const o = t.dashboard.orders
    const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null)
    const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set())
    const [currentOrders, setCurrentOrders] = useState<Order[]>([])
    const [refreshCounter, setRefreshCounter] = useState(0)
    const [isConfirming, setIsConfirming] = useState(false)

    // Filters
    const [searchQuery, setSearchQuery] = useState('')
    const [debouncedSearch, setDebouncedSearch] = useState('')
    const [statusFilter, setStatusFilter] = useState('all')
    const [dateFilter, setDateFilter] = useState('all')

    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedSearch(searchQuery)
        }, 500)
        return () => clearTimeout(handler)
    }, [searchQuery])

    const isOpen = selectedOrderId !== null

    function handleSelectOrder(orderId: string) {
        // Toggle: click the same row again to close
        setSelectedOrderId(prev => prev === orderId ? null : orderId)
    }

    const pendingSelectedOrders = Array.from(selectedRows)
        .map(id => currentOrders.find(o => o.id === id))
        .filter(o => o && o.status === 'pending')

    const pendingCount = pendingSelectedOrders.length

    async function handleBulkConfirm() {
        if (pendingCount === 0 || isConfirming) return
        setIsConfirming(true)
        try {
            await Promise.all(pendingSelectedOrders.map(async (o) => {
                const res = await fetch(`/api/orders/${o!.id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ status: 'confirmed' })
                })
                if (!res.ok) throw new Error('Update failed')
            }))
            toast.success(ti(t.dashboard.orders.toast.bulkSuccess, { count: pendingCount }))
            setSelectedRows(new Set())
            setRefreshCounter(prev => prev + 1)
        } catch (error) {
            toast.error(t.dashboard.orders.toast.loadFailed)
        } finally {
            setIsConfirming(false)
        }
    }

    return (
        // Main content always takes full width
        <div className="relative flex flex-col gap-[22px] w-full">
            {/* Page Header */}
            <div className="flex flex-col gap-1 w-full">
                <h1 className="text-2xl font-bold text-[#F8FAFC] leading-8">
                    {o.pageTitle}
                </h1>
                <p className="text-sm font-normal text-[rgba(248,250,252,0.6)] leading-5">
                    {o.pageSubtitle}
                </p>
            </div>

            <OrdersMetrics refreshCounter={refreshCounter} />
            <AwaitingVerificationChip />
            <OrdersActionBar
                pendingCount={pendingCount}
                onBulkConfirm={handleBulkConfirm}
                isConfirming={isConfirming}
                onSearch={setSearchQuery}
                onFilterStatus={setStatusFilter}
                onFilterDate={setDateFilter}
            />
            <OrdersTable
                onSelectOrder={handleSelectOrder}
                selectedOrderId={selectedOrderId}
                selectedRows={selectedRows}
                onSelectionChange={setSelectedRows}
                onOrdersLoaded={setCurrentOrders}
                refreshCounter={refreshCounter}
                searchQuery={debouncedSearch}
                statusFilter={statusFilter}
                dateFilter={dateFilter}
            />

            {isOpen && (
                <div
                    className="fixed inset-0 z-40"
                    style={{ background: 'rgba(0, 0, 0, 0.6)', backdropFilter: 'blur(2px)', top: 56 }}
                    onClick={() => setSelectedOrderId(null)}
                />
            )}

            {/* Order Detail Panel — fixed overlay, slides in from right on md, fullscreen on mobile */}
            <div
                className={`fixed z-50 overflow-y-auto transition-transform duration-300 shadow-2xl right-0 w-full top-0 h-[100dvh] md:w-[488px] md:top-[80px] md:h-[calc(100vh-80px)] ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
                style={{
                    background: 'rgba(11, 17, 32, 0.95)',
                    borderLeft: '1px solid rgba(255, 255, 255, 0.08)',
                    borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                    backdropFilter: 'blur(20px)',
                }}
            >
                <OrderDetailPanel
                    orderId={selectedOrderId}
                    onClose={() => setSelectedOrderId(null)}
                    onUpdate={() => setRefreshCounter(prev => prev + 1)}
                />
            </div>
        </div>
    )
}

