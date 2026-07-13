"use client"

import React, { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2, ArrowLeft, Calendar, Truck, PackageCheck } from 'lucide-react'
import {
    CheckCircle, XCircle, Clock, CircleCheck, CircleAlert,
} from 'lucide-react'
import {
    OrderProgress,
    type OrderDetail,
} from './OrderDetailPanel'
import { ManualPaymentVerificationBlock } from './ManualPaymentVerificationBlock'
import { FulfillmentZone, type FulfillmentOrder } from './detail/fulfillment-zone'
import { OrderItemsCard } from './detail/order-items-card'
import { CustomerCard } from './detail/customer-card'
import { PaymentCard } from './detail/payment-card'
import { OrderActionsCard } from './detail/order-actions-card'
import { useI18n } from '@/i18n'

// ── Status badge mapping ──────────────────────────────────────────────────────
type StatusCls = 'ok' | 'blue' | 'warn' | 'danger'

interface StatusBadgeDef {
    cls: StatusCls
    icon: React.ReactNode
    text: string
}

// Raw Payload fields present at ?depth=2 but not typed in OrderDetail
interface RawOrder {
    createdAt?: string | null
    codAmount?: number | null
    notes?: string | null
    awbNo?: string | null
    shippingTrackingStatus?: string | null
}

function formatCreatedDate(iso?: string | null): string {
    if (!iso) return '—'
    const d = new Date(iso)
    return (
        d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) +
        ' · ' +
        d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
    )
}

// ── Main view ────────────────────────────────────────────────────────────────
export function OrderDetailView({ orderId }: { orderId: string }) {
    const router = useRouter()
    const { t, ti } = useI18n()
    const [order, setOrder] = useState<OrderDetail | null>(null)
    const [loading, setLoading] = useState(true)
    const [notFound, setNotFound] = useState(false)

    // `silent` = poll-triggered refresh: update the card in place without flipping the
    // full-page loading spinner (avoids a flash every time the background poll re-pulls).
    const fetchOrder = useCallback(async (opts?: { silent?: boolean }) => {
        if (!opts?.silent) setLoading(true)
        setNotFound(false)
        try {
            const res = await fetch(`/api/orders/${orderId}?depth=2`)
            if (res.status === 404) { setNotFound(true); return }
            if (!res.ok) throw new Error('fetch_failed')
            const result = await res.json()
            setOrder(result.data || result)
        } catch {
            if (!opts?.silent) toast.error(t.dashboard.orders.toast.loadFailed)
        } finally {
            if (!opts?.silent) setLoading(false)
        }
    }, [orderId, t.dashboard.orders.toast.loadFailed])

    useEffect(() => { fetchOrder() }, [fetchOrder])

    // Near-real-time updates from EP webhooks (async AWB, tracking status, cancel
    // auto-reopen) WITHOUT a manual refresh. Poll the slim /poll cursor every 20s while
    // the order is in-flight and the tab is visible; only re-pull the full order when
    // updatedAt actually changes. Self-stops on terminal states (delivered/cancelled/…)
    // and hidden tabs, so idle/closed orders cost zero requests.
    const orderUpdatedAt = (order as { updatedAt?: string } | null)?.updatedAt
    const orderStatus = (order as { status?: string } | null)?.status
    const orderTracking = (order as { shippingTrackingStatus?: string | null } | null)?.shippingTrackingStatus
    const isInFlight =
        !!orderStatus &&
        ['ready_to_ship', 'shipped'].includes(orderStatus) &&
        !['delivered', 'cancelled', 'returned_to_sender', 'lost'].includes(orderTracking ?? '')

    useEffect(() => {
        if (!isInFlight) return
        let stopped = false
        const tick = async () => {
            if (document.visibilityState !== 'visible') return
            try {
                const res = await fetch(`/api/orders/${orderId}/poll`)
                if (!res.ok) return
                const { data } = await res.json()
                if (stopped || !data?.updatedAt) return
                if (data.updatedAt !== orderUpdatedAt) fetchOrder({ silent: true })
            } catch {
                // transient network/DB blip — the next tick retries
            }
        }
        const id = setInterval(tick, 20000)
        return () => { stopped = true; clearInterval(id) }
    }, [isInFlight, orderId, orderUpdatedAt, fetchOrder])

    const handleBack = () => router.push('/orders')

    // Build i18n-aware status badge (defined inside component to close over t)
    const s = t.dashboard.orders.status
    function getStatusBadge(status: string): StatusBadgeDef {
        switch (status) {
            case 'completed':
                return { cls: 'ok',     icon: <CheckCircle />,  text: s.completed }
            case 'shipped':
                return { cls: 'ok',     icon: <Truck />,        text: s.shipped }
            case 'ready_to_ship':
                return { cls: 'ok',     icon: <PackageCheck />, text: s.readyToShip }
            case 'payment_failed':
                return { cls: 'danger', icon: <XCircle />,      text: s.paymentFailed }
            case 'cancelled':
                return { cls: 'danger', icon: <XCircle />,      text: s.cancelled }
            case 'refunded':
                return { cls: 'danger', icon: <XCircle />,      text: s.refunded }
            case 'pending':
            case 'new':
                return { cls: 'warn',   icon: <Clock />,        text: s.pending }
            case 'confirmed':
            case 'paid':
            case 'processing':
                return { cls: 'blue',   icon: <CircleCheck />,  text: s.confirmed }
            default:
                return { cls: 'blue',   icon: <CircleAlert />,  text: status }
        }
    }

    // ── Loading state ────────────────────────────────────────────────────────
    if (loading) {
        return (
            <div className="od-page">
                <div className="od-loading">
                    <Loader2 className="animate-spin" style={{ width: 32, height: 32 }} />
                </div>
            </div>
        )
    }

    // ── Not found ────────────────────────────────────────────────────────────
    const d = t.dashboard.orders.detail
    if (notFound || !order) {
        return (
            <div className="od-page">
                <div className="od-not-found">
                    <h2>{d.notFound}</h2>
                    <p>{ti(d.notFoundDesc, { id: orderId })}</p>
                    <button onClick={handleBack}>
                        <ArrowLeft style={{ width: 15, height: 15 }} /> {d.backToOrders}
                    </button>
                </div>
            </div>
        )
    }

    const badge = getStatusBadge(order.status)
    // Cast once to RawOrder for Payload fields not yet in generated types (tracked in OPEN_BLOCKERS)
    const raw = order as unknown as RawOrder

    return (
        <div className="od-page">
            {/* ── Header ─────────────────────────────────────────────────── */}
            <div className="od-page-head">
                <button className="od-back" onClick={handleBack}>
                    <ArrowLeft />
                    Orders
                </button>
                <div className="od-title-row">
                    <h1>{d.title}</h1>
                    <span className="od-id-pill">{order.orderNumber}</span>
                    <span className={`od-status ${badge.cls}`}>
                        {badge.icon}
                        {badge.text}
                    </span>
                    <span className="od-date">
                        <Calendar />
                        Created {formatCreatedDate(raw.createdAt)}
                    </span>
                </div>
            </div>

            {/* ── Full-width progress stepper ─────────────────────────── */}
            <section className="od-card od-progress">
                <div className="od-cap">{d.orderProgress}</div>
                <OrderProgress status={order.status} />
            </section>

            {/* ── Two-column grid ─────────────────────────────────────── */}
            <div className="od2">
                {/* LEFT 65% — actions + items + summary */}
                <div className="od2-main">
                    <section className="od-card od-fulfil">
                        <div className="od-cap">
                            <Truck style={{ width: 13, height: 13 }} />
                            {d.shippingFulfillment}
                        </div>
                        {/*
                         * fetchOrder() re-pulls client order state; router.refresh() busts RSC
                         * cache so the sidebar pending-badge re-renders. Both are needed together.
                         */}
                        <FulfillmentZone
                            order={order as unknown as FulfillmentOrder}
                            onUpdate={() => { fetchOrder(); router.refresh() }}
                        />
                    </section>

                    <section className="od-card">
                        <div className="od-cap">
                            <PackageCheck style={{ width: 13, height: 13 }} />
                            {d.orderItems}
                        </div>
                        <OrderItemsCard order={order} />
                    </section>
                </div>

                {/* RIGHT 35% — customer + payment + actions */}
                <div className="od2-side">
                    <CustomerCard order={{
                        customerName: order.customerName,
                        customerEmail: order.customerEmail,
                        customerPhone: order.customerPhone,
                        shippingAddress: order.shippingAddress,
                        codAmount: raw.codAmount ?? null,
                        notes: raw.notes ?? null,
                    }} />

                    <PaymentCard order={{
                        status: order.status,
                        paymentMethod: order.paymentMethod,
                        paymentStatus: order.paymentStatus,
                        xenditChannelCode: order.xenditChannelCode,
                        paymentProofImage: order.paymentProofImage,
                    }} />

                    {/* BT ManualPaymentVerificationBlock — same conditional as drawer */}
                    {order.paymentMethod === 'bank_transfer' &&
                        (order.paymentStatus === 'pending_verification' ||
                            order.paymentStatus === 'paid') && (
                        <ManualPaymentVerificationBlock
                            order={order}
                            onUpdate={() => { fetchOrder(); router.refresh() }}
                        />
                    )}

                    <OrderActionsCard
                        order={{
                            id: order.id,
                            orderNumber: order.orderNumber,
                            status: order.status,
                            total: order.total,
                            currency: order.currency,
                            paymentMethod: order.paymentMethod,
                            xenditChannelCode: order.xenditChannelCode ?? null,
                            awbNo: raw.awbNo ?? null,
                            shippingTrackingStatus: raw.shippingTrackingStatus ?? null,
                        }}
                        onUpdate={() => { fetchOrder(); router.refresh() }}
                    />
                </div>
            </div>
        </div>
    )
}
