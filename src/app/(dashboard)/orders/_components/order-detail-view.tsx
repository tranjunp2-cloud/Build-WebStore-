"use client"

import React, { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2, ArrowLeft, Calendar, Truck, PackageCheck, Info } from 'lucide-react'
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
import { CancelOrderModal } from './CancelOrderModal'
import { getMobileOrderActions } from './mobile-order-actions'
import type { CreateLabelFlowHandle } from './detail/create-label-flow'
import { useI18n } from '@/i18n'
import { useInvalidateOrders, useOrderDetailQuery } from './orders-queries'

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
    selfDeliveryCourier?: string | null
}

const DATE_LOCALES = { en: 'en-GB', ms: 'ms-MY' } as const

function formatCreatedDate(iso: string | null | undefined, locale: keyof typeof DATE_LOCALES): string {
    if (!iso) return '—'
    const d = new Date(iso)
    const tag = DATE_LOCALES[locale] ?? 'en-GB'
    return (
        d.toLocaleDateString(tag, { day: 'numeric', month: 'short', year: 'numeric' }) +
        ' · ' +
        d.toLocaleTimeString(tag, { hour: '2-digit', minute: '2-digit', hour12: false })
    )
}

// ── Main view ────────────────────────────────────────────────────────────────
export function OrderDetailView({ orderId }: { orderId: string }) {
    const router = useRouter()
    const { t, ti, locale } = useI18n()
    const [mobileActionLoading, setMobileActionLoading] = useState(false)
    const [mobileCancelOpen, setMobileCancelOpen] = useState(false)
    const [mobileActionBarHeight, setMobileActionBarHeight] = useState(0)
    const mobileShippingActionRef = useRef<CreateLabelFlowHandle | null>(null)
    const mobileActionBarRef = useRef<HTMLDivElement | null>(null)
    // The order.updatedAt a cancel-reopen toast has already fired for — dedup guard so a
    // slow silent refetch can't re-toast the same transition on the next 20s tick.
    const cancelToastedForRef = useRef<string | null>(null)

    // The order (cached per id). A write re-reads it in place through the dashboard's query invalidation;
    // child cards take it as props, their own forms (reject reason, weight...) stay as typed.
    const orderQuery = useOrderDetailQuery<OrderDetail>(orderId)
    const loaded = orderQuery.data
    const order = loaded && 'order' in loaded ? loaded.order : null
    const notFound = Boolean(loaded && 'notFound' in loaded)
    const loading = orderQuery.isPending
    const invalidateOrders = useInvalidateOrders()

    // Only the first read may say "could not load"; a failed background re-read keeps the order on screen.
    const loadFailed = orderQuery.isLoadingError
    useEffect(() => {
        if (loadFailed) toast.error(t.dashboard.orders.toast.loadFailed)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [loadFailed])

    /** re-read this order in place (no spinner); `everywhere`: a write from this page also made the lists stale */
    const fetchOrder = useCallback((opts?: { everywhere?: boolean }) => {
        if (opts?.everywhere) return void invalidateOrders()
        void orderQuery.refetch()
    }, [invalidateOrders, orderQuery.refetch])

    const mobileActions = getMobileOrderActions(order?.status ?? '')

    useEffect(() => {
        const element = mobileActionBarRef.current
        if (!element || mobileActions.length === 0) {
            setMobileActionBarHeight(0)
            return
        }

        const updateHeight = () => {
            const nextHeight = Math.ceil(element.getBoundingClientRect().height)
            setMobileActionBarHeight((current) => current === nextHeight ? current : nextHeight)
        }

        updateHeight()
        const observer = new ResizeObserver(updateHeight)
        observer.observe(element)
        return () => observer.disconnect()
    }, [mobileActions.length])

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
                if (stopped || !data?.updatedAt || data.updatedAt === orderUpdatedAt) return
                // This effect only runs while the order is in-flight, so a poll that now
                // reports confirmed + tracking 'cancelled' IS the webhook cancel auto-reopen
                // happening live — tell the merchant why the label just disappeared. Guard on
                // the updatedAt so a silent refetch slower than the 20s tick can't double-toast.
                if (
                    data.status === 'confirmed' &&
                    data.shippingTrackingStatus === 'cancelled' &&
                    cancelToastedForRef.current !== data.updatedAt
                ) {
                    cancelToastedForRef.current = data.updatedAt
                    toast.info(t.dashboard.orders.toast.shipmentCancelledOnEp)
                }
                fetchOrder()
            } catch {
                // transient network/DB blip — the next tick retries
            }
        }
        const id = setInterval(tick, 20000)
        return () => { stopped = true; clearInterval(id) }
    }, [isInFlight, orderId, orderUpdatedAt, fetchOrder, t.dashboard.orders.toast.shipmentCancelledOnEp])

    const handleBack = () => router.push('/orders')

    const handleMobileConfirm = async () => {
        setMobileActionLoading(true)
        try {
            const res = await fetch(`/api/orders/${orderId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'confirmed' }),
            })
            if (!res.ok) {
                const data = await res.json().catch(() => ({}))
                throw new Error(data?.error?.message ?? 'Failed to confirm order')
            }
            toast.success(t.dashboard.orders.fulfillment.orderConfirmed)
            fetchOrder({ everywhere: true })
            router.refresh()
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : t.dashboard.orders.fulfillment.confirmFailed)
        } finally {
            setMobileActionLoading(false)
        }
    }

    const handleMobileCancel = async (reason: string) => {
        setMobileActionLoading(true)
        try {
            const res = await fetch(`/api/orders/${orderId}/cancel`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ reason }),
            })
            if (!res.ok) {
                const data = await res.json().catch(() => ({}))
                throw new Error(data?.error?.message ?? 'Failed to cancel order')
            }
            toast.success(t.dashboard.orders.toast.updated)
            setMobileCancelOpen(false)
            fetchOrder({ everywhere: true })
            router.refresh()
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : t.dashboard.orders.toast.updateFailed)
        } finally {
            setMobileActionLoading(false)
        }
    }

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
        <div
            className={`od-page${mobileActions.length > 0 ? ' od-has-mobile-actions' : ''}`}
            style={mobileActionBarHeight > 0
                ? { '--od-mobile-actions-height': `${mobileActionBarHeight}px` } as React.CSSProperties
                : undefined}
        >
            {/* ── Header ─────────────────────────────────────────────────── */}
            <div className="od-page-head">
                <button className="od-back" onClick={handleBack}>
                    <ArrowLeft />
                    {d.backToOrdersShort}
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
                        {ti(d.createdOn, { date: formatCreatedDate(raw.createdAt, locale) })}
                    </span>
                </div>
            </div>

            {/* ── Full-width progress stepper ─────────────────────────── */}
            <section className="od-card od-progress">
                <div className="od-cap">{d.orderProgress}</div>
                <OrderProgress status={order.status} embedded />
            </section>

            {/* ── Two-column grid ─────────────────────────────────────── */}
            <div className="od2">
                {/* LEFT 65% — actions + items + summary */}
                <div className="od2-main">
                    <section id="order-fulfillment" className="od-card od-fulfil">
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
                            onUpdate={() => { fetchOrder({ everywhere: true }); router.refresh() }}
                            // Label creation reconciles silently (no page reload): the success
                            // card shows optimistically and the async AWB fills in via polling.
                            onLabelCreated={() => { fetchOrder({ everywhere: true }) }}
                            mobileShippingActionRef={mobileShippingActionRef}
                            hideMobileConfirmAction={mobileActions.includes('confirm')}
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
                            onUpdate={() => { fetchOrder({ everywhere: true }); router.refresh() }}
                        />
                    )}

                    <div className={mobileActions.length > 0 ? 'od-mobile-action-card-hidden' : undefined}>
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
                                selfDeliveryCourier: raw.selfDeliveryCourier ?? null,
                            }}
                            onUpdate={() => { fetchOrder({ everywhere: true }); router.refresh() }}
                        />
                    </div>
                </div>
            </div>

            {mobileActions.length > 0 && (
                <div ref={mobileActionBarRef} className="od-mobile-actions" aria-label={d.orderActionsTitle}>
                    {mobileActions.includes('confirm') && (
                        <p className="od-mobile-action-note">
                            <Info aria-hidden="true" />
                            {t.dashboard.orders.fulfillment.confirmHint}
                        </p>
                    )}
                    {mobileActions.map((action) => {
                        if (action === 'confirm') {
                            return (
                                <button
                                    key={action}
                                    className="od-mobile-action primary"
                                    disabled={mobileActionLoading}
                                    onClick={handleMobileConfirm}
                                >
                                    {t.dashboard.orders.actions.confirmOrder}
                                </button>
                            )
                        }

                        if (action === 'ship') {
                            return (
                                <button
                                    key={action}
                                    className="od-mobile-action primary"
                                    onClick={() => {
                                        if (mobileShippingActionRef.current) {
                                            mobileShippingActionRef.current.submit()
                                            return
                                        }
                                        document.getElementById('order-fulfillment')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                                    }}
                                >
                                    {t.dashboard.orders.actions.shipOrder}
                                </button>
                            )
                        }

                        return (
                            <button
                                key={action}
                                className="od-mobile-action danger"
                                disabled={mobileActionLoading}
                                onClick={() => setMobileCancelOpen(true)}
                            >
                                {t.dashboard.orders.actions.cancelOrder}
                            </button>
                        )
                    })}
                </div>
            )}

            <CancelOrderModal
                orderNumber={order.orderNumber}
                isOpen={mobileCancelOpen}
                isLoading={mobileActionLoading}
                mobileCancelNote={d.orderActionsNote}
                onBack={() => setMobileCancelOpen(false)}
                onConfirm={handleMobileCancel}
            />
        </div>
    )
}
