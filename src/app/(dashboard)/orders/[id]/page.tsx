import React from 'react'
import type { Metadata } from 'next'
import { OrderDetailView } from '../_components/order-detail-view'
import '../order-detail.css'

export const metadata: Metadata = {
    title: 'Order Details',
}

// Auth guard is provided by the parent orders/layout.tsx (requirePermission('orders')).
// This page just unwraps the [id] param and renders the client view.
export default async function OrderDetailPage({
    params,
}: {
    params: Promise<{ id: string }>
}) {
    const { id } = await params
    // PD-F13b: key by id so Next.js remounts the whole subtree (incl. FulfillmentZone)
    // on order-id change — App Router preserves component state across dynamic-segment
    // navigations by default, which otherwise leaks FulfillmentZone's local state
    // (localAwb, forceCodBlocked, forceMissing, …) from the previous order.
    return <OrderDetailView key={id} orderId={id} />
}
