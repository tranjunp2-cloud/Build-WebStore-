import React from 'react'
import { Metadata } from 'next'
import { OrdersClientLayout } from './_components/OrdersClientLayout'

export const metadata: Metadata = {
    title: 'Orders | PrimeWeb',
    description: 'Manage and track your orders',
}

export default function OrdersPage() {

    return (
        <div className="flex flex-col gap-[22px] w-full">
            {/* Header + Client layout (manages selectedOrder state) */}
            <OrdersClientLayout />
        </div>
    )
}
