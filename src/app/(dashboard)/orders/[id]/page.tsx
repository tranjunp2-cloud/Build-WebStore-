import React from 'react'
import type { Metadata } from 'next'
import { OrderDetailView } from '../_components/order-detail-view'
import '../order-detail.css'

export const metadata: Metadata = {
    title: 'Order Details | PrimeWeb',
}

// Auth guard is provided by the parent orders/layout.tsx (requirePermission('orders')).
// This page just unwraps the [id] param and renders the client view.
export default async function OrderDetailPage({
    params,
}: {
    params: Promise<{ id: string }>
}) {
    const { id } = await params
    return <OrderDetailView orderId={id} />
}
