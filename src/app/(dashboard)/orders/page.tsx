import React from 'react'
import { Metadata } from 'next'
import { OrdersMetrics } from './_components/OrdersMetrics'
import { OrdersActionBar } from './_components/OrdersActionBar'
import { OrdersTable } from './_components/OrdersTable'

export const metadata: Metadata = {
    title: 'Orders | PrimeWeb',
    description: 'Manage and track your orders',
}

export default function OrdersPage() {

    return (
        <div className="flex flex-col gap-[22px] w-full">
            {/* Header Info */}
            <div className="flex flex-col gap-1 w-full">
                <h1 className="text-2xl font-bold text-[#F8FAFC] leading-8">
                    Orders
                </h1>
                <p className="text-sm font-normal text-[rgba(248,250,252,0.6)] leading-5">
                    Manage and track your orders
                </p>
            </div>

            {/* Metrics Cards */}
            <OrdersMetrics />

            {/* Action Bar (Search, Filter, Confirm) */}
            <OrdersActionBar />

            {/* Data Table */}
            <OrdersTable />
        </div>
    )
}
