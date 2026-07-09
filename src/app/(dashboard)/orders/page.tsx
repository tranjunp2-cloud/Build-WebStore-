import React, { Suspense } from 'react'
import { Metadata } from 'next'
import { OrdersClientLayout } from './_components/OrdersClientLayout'

export const metadata: Metadata = {
    title: 'Orders | Web Store',
    description: 'Manage and track your orders',
}

export default function OrdersPage() {

    return (
        <div className="flex flex-col gap-[22px] w-full">
            <Suspense>
                <OrdersClientLayout />
            </Suspense>
        </div>
    )
}
