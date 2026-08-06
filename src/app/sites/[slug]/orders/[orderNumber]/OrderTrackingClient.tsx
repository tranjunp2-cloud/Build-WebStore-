'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { toast } from 'sonner'
import {
    ShoppingBag, Package, Truck, PackageCheck, ReceiptText,
    Calendar, CreditCard, Copy, Check, Hash, MapPin, ShieldCheck,
    CalendarClock, Navigation, ChevronDown,
    RefreshCw, Store, Star, ChevronRight, XCircle, RotateCcw, ScanBarcode,
} from 'lucide-react'
import { formatTrackingEventDisplay } from '@/lib/shipping/tracking-event-display'

type TrackingStatus = 'processing' | 'in-transit' | 'delivered' | 'cancelled' | 'refunded' | 'payment_failed'

type OrderItem = {
    productName: string
    variant: string | null
    quantity: number
    unitPrice: number
    imageUrl?: string | null
}

type ShippingAddress = {
    line1?: string | null
    line2?: string | null
    city?: string | null
    state?: string | null
    postcode?: string | null
    country?: string | null
}

type EpTrackingHistoryEntry = {
    status?: string | null
    description: string
    eventTime: string
    collectionMethod?: 'pickup' | 'dropoff' | null
}

type OrderData = {
    id: number | string
    orderNumber: string
    status: string
    paymentStatus: string
    paymentMethod: string | null
    total: number
    subtotal: number
    shippingFee: number
    tax: number
    discountCode?: string | null
    discountAmount?: number | null
    currency: string
    customerName: string
    customerPhone: string | null
    trackingNumber: string | null
    awbNo?: string | null
    shippingCourier?: string | null
    /** Friendly name from the EP rate response ("Pos Malaysia Berhad (Melplus)"). */
    shippingCourierName?: string | null
    /** EP courier_logo URL captured at label creation — absent on old orders / failed lookups. */
    shippingCourierLogo?: string | null
    selfDeliveryCourier?: string | null
    collectionMethod?: 'pickup' | 'dropoff' | null
    shippingTrackingStatus?: string | null
    shippingTrackingHistory?: EpTrackingHistoryEntry[]
    createdAt: string
    items: OrderItem[]
    shippingAddress: ShippingAddress
}

type Props = { order: OrderData; slug: string }

const TERMINAL_STATUSES = new Set(['completed', 'cancelled', 'refunded', 'payment_failed'])


function getTrackingStatus(status: string, paymentStatus?: string): TrackingStatus {
    if (status === 'shipped') return 'in-transit'
    if (status === 'completed') return 'delivered'
    if (status === 'refunded') return 'refunded'
    // Auto-cancelled after payment failure → show as payment_failed (retry window may still apply on the order page)
    if (status === 'cancelled' && (paymentStatus === 'payment_failed' || paymentStatus === 'failed')) return 'payment_failed'
    // Webhook-failed order (status='payment_failed') is retryable, not cancelled
    if (status === 'payment_failed') return 'payment_failed'
    if (status === 'cancelled') return 'cancelled'
    return 'processing'
}

function formatMoney(amount: number, currency: string) {
    return `${currency} ${amount.toFixed(2)}`
}

function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatTime(iso: string) {
    return new Date(iso).toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit' })
}

const STAGES = [
    { key: 'placed', label: 'Order Placed', Icon: ShoppingBag },
    { key: 'processing', label: 'Processing', Icon: Package },
    { key: 'shipped', label: 'Shipping', Icon: Truck },
    { key: 'delivered', label: 'Delivered', Icon: PackageCheck },
] as const

function getStageStates(trackingStatus: TrackingStatus) {
    const map: Record<typeof STAGES[number]['key'], 'done' | 'active' | 'pending'> = {
        placed: 'done',
        processing: trackingStatus === 'processing' ? 'active' : 'done',
        shipped: trackingStatus === 'in-transit' ? 'active' : trackingStatus === 'delivered' ? 'done' : 'pending',
        delivered: trackingStatus === 'delivered' ? 'done' : 'pending',
    }
    return map
}

function OtOrderHead({ order, trackingStatus }: { order: OrderData; trackingStatus: TrackingStatus }) {
    const [copied, setCopied] = useState(false)
    const isPaid = order.paymentStatus === 'paid'
    const isPaymentFailed = order.paymentStatus === 'failed' || order.paymentStatus === 'payment_failed'

    const STATUS_META = {
        'processing': { cls: 'processing', Icon: Package, eyebrow: 'Current Status', title: 'Processing' },
        'in-transit': { cls: 'in-transit', Icon: Truck, eyebrow: 'Current Status', title: 'In Transit' },
        'delivered': { cls: 'delivered', Icon: PackageCheck, eyebrow: 'Order Status', title: 'Delivered' },
        'cancelled': { cls: 'cancelled', Icon: XCircle, eyebrow: 'Order Status', title: 'Cancelled' },
        'refunded': { cls: 'refunded', Icon: RotateCcw, eyebrow: 'Order Status', title: 'Refunded' },
        'payment_failed': { cls: 'cancelled', Icon: XCircle, eyebrow: 'Order Status', title: 'Payment Failed' },
    }
    const s = STATUS_META[trackingStatus]

    const paymentLabel = isPaid
        ? 'Paid'
        : isPaymentFailed
            ? 'Payment Failed'
            : (() => {
                const m: Record<string, string> = { bank_transfer: 'Bank Transfer', card: 'Credit Card', fpx: 'FPX', cod: 'COD', ewallet: 'e-Wallet' }
                return `Pending · ${m[order.paymentMethod ?? ''] ?? 'Pending'}`
            })()
    const chipClass = isPaid ? 'paid' : isPaymentFailed ? 'failed' : 'pending'

    const handleCopy = () => {
        navigator.clipboard?.writeText(order.orderNumber)
        setCopied(true)
        setTimeout(() => setCopied(false), 1600)
    }

    return (
        <div className="ot-order-head">
            <div className="ot-oh-left">
                <span className="ot-oh-eyebrow"><ReceiptText size={12} /> Order Details</span>
                <div className="ot-oh-id-row">
                    <span className="ot-oh-id">{order.orderNumber}</span>
                    <button className="ot-oh-copy" onClick={handleCopy} title="Copy order ID">
                        {copied ? <Check size={13} /> : <Copy size={13} />}
                    </button>
                    <span className={`ot-payment-chip ${chipClass}`}>
                        <span className="dot" />
                        {paymentLabel}
                    </span>
                </div>
                <div className="ot-oh-meta">
                    <span><Calendar size={13} /> Placed <strong>{formatDate(order.createdAt)}</strong></span>
                    <span><Package size={13} /> {order.items.length} item{order.items.length !== 1 ? 's' : ''}</span>
                    <span><CreditCard size={13} /> {formatMoney(order.total, order.currency)}</span>
                </div>
            </div>
            <div className={`ot-status-badge ${s.cls}`}>
                <div className="ot-status-icon"><s.Icon size={22} /></div>
                <div className="ot-status-text">
                    <span className="ot-status-eyebrow">{s.eyebrow}</span>
                    <span className="ot-status-title">{s.title}</span>
                </div>
            </div>
        </div>
    )
}

function OtStageTracker({ order, trackingStatus }: { order: OrderData; trackingStatus: TrackingStatus }) {
    if (trackingStatus === 'cancelled' || trackingStatus === 'refunded' || trackingStatus === 'payment_failed') return null
    const states = getStageStates(trackingStatus)
    const placedDate = formatDate(order.createdAt)
    const etaText = trackingStatus === 'delivered'
        ? <>Delivered</>
        : trackingStatus === 'in-transit'
            ? <>Arriving soon</>
            : <>Estimated arrival <strong>soon</strong></>

    return (
        <div className="ot-tracker">
            <div className="ot-tracker-head">
                <h3>Delivery Progress</h3>
                <span className="ot-tracker-eta">{etaText}</span>
            </div>
            <div className="ot-stages">
                {STAGES.map(({ key, label, Icon }) => {
                    const state = states[key]
                    const date = key === 'placed' ? placedDate
                        : key === 'delivered' && trackingStatus === 'delivered' ? 'Delivered'
                        : key === 'shipped' && trackingStatus !== 'processing' ? (trackingStatus === 'in-transit' ? 'In transit' : 'Shipped')
                        : state === 'pending' ? 'Est. Soon' : ''
                    return (
                        <div key={key} className={`ot-stage ${state}`}>
                            <span className="ot-stage-rail" />
                            <span className="ot-stage-node">
                                {state === 'done' ? <Check size={18} /> : <Icon size={18} />}
                            </span>
                            <span className="ot-stage-label">{label}</span>
                            <span className="ot-stage-date">{date}</span>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}

/** Single card for everything shipping-related. The AWB and the tracking number are the same
 *  string for an EP shipment, so the old two-card split ("Shipping Information" + "Shipment
 *  Tracking") printed it twice and scattered courier / ETA / history across both. */
function OtShippingCard({ order, trackingStatus }: { order: OrderData; trackingStatus: TrackingStatus }) {
    const [copied, setCopied] = useState(false)
    const [logoFailed, setLogoFailed] = useState(false)
    const {
        awbNo,
        shippingCourier,
        shippingCourierName,
        shippingCourierLogo,
        selfDeliveryCourier,
        shippingTrackingHistory,
    } = order
    const trackingNo = awbNo || order.trackingNumber
    const isInTransit = trackingStatus === 'in-transit'
    const isDelivered = trackingStatus === 'delivered'
    const history = shippingTrackingHistory ?? []
    const isEp = !selfDeliveryCourier && (Boolean(awbNo) || history.length > 0)
    // `shippingCourier` is EP's machine code ("EP-CR0DW") — never show it to a buyer. Fall back
    // to it only when the friendly name is missing (orders placed before it was persisted).
    const courierLabel = selfDeliveryCourier || shippingCourierName || shippingCourier
    // EP cancelled the shipment: the reopen wipes awbNo, so without this the buyer would read the
    // generic "being prepared" line and watch their tracking history vanish — as if the order had
    // never shipped. Say what happened and keep the history.
    const shipmentCancelled = order.shippingTrackingStatus === 'cancelled'

    const handleCopy = () => {
        if (trackingNo) navigator.clipboard?.writeText(trackingNo)
        setCopied(true)
        setTimeout(() => setCopied(false), 1600)
    }

    return (
        <div className="ot-card">
            <div className="ot-card-head">
                <h3>Shipping Information</h3>
                <span className="ot-card-aux">
                    {isEp ? <><ScanBarcode size={12} /> EasyParcel</> : <><ShieldCheck size={12} /> Tracked shipment</>}
                </span>
            </div>
            <div className="ot-ship-grid">
                <div className="ot-ship-info">
                    {courierLabel && (
                        <div className="ot-courier-tile">
                            {shippingCourierLogo && !logoFailed ? (
                                // eslint-disable-next-line @next/next/no-img-element -- external EP CDN host, not in next.config
                                <img
                                    className="ot-courier-logo"
                                    src={shippingCourierLogo}
                                    alt={courierLabel}
                                    onError={() => setLogoFailed(true)}
                                />
                            ) : (
                                <span className="ot-courier-icon"><Truck size={18} /></span>
                            )}
                            <span className="ot-courier-name">{courierLabel}</span>
                        </div>
                    )}
                    {!courierLabel && (
                        <div className="ot-tracking-row">
                            <span className="ot-tr-label"><Truck size={12} /> Courier</span>
                            <span className="ot-tr-value pending">Not yet assigned</span>
                        </div>
                    )}
                    {trackingNo ? (
                        <div className="ot-tracking-row">
                            <span className="ot-tr-label"><Hash size={12} /> Tracking No.</span>
                            <span className="ot-tr-value">
                                {isInTransit
                                    ? <a href="#" target="_blank" rel="noreferrer">{trackingNo}</a>
                                    : trackingNo}
                            </span>
                            <button className={`ot-tr-copy ${copied ? 'copied' : ''}`} onClick={handleCopy}>
                                {copied ? <Check size={12} /> : <Copy size={12} />}
                                {copied ? 'Copied' : 'Copy'}
                            </button>
                        </div>
                    ) : (
                        <div className="ot-tracking-row">
                            <span className="ot-tr-label"><Hash size={12} /> Tracking No.</span>
                            <span className="ot-tr-value pending">Not yet assigned</span>
                        </div>
                    )}
                    {!trackingNo && shipmentCancelled && (
                        <p style={{ fontSize: '0.875rem', color: 'var(--f4, #6b7280)', margin: 0 }}>
                            The earlier shipment was cancelled. Your order is safe — the seller is arranging a new delivery, and a new tracking number will appear here.
                        </p>
                    )}
                    {/* Estimated delivery — DELIBERATELY HIDDEN, not forgotten.
                     *
                     * We have no honest number to put here. Probed EP's live quotation
                     * (2026-07-14, 23 couriers): 18 of 23 return delivery_duration = null,
                     * Pos Malaysia (Melplus) among them. The 5 that answer send a JSON blob
                     * ({"type":"days","value":"3"}), not the prose string EP's docs imply, and
                     * it is counted from PICKUP — a date we don't even know until a label is
                     * bought. EP publishes no delivery date on any endpoint.
                     *
                     * So the box could only ever show a number we invented. Showing nothing
                     * beats showing a date the buyer will hold us to. Restore this once the
                     * ETA source is decided — see docs/qa/F36-easyparcel-delivery.md § 3.18j.
                     *
                     * <div className="ot-eta-card">
                     *     <div className="ot-eta-icon">
                     *         {isDelivered ? <PackageCheck size={20} /> : <CalendarClock size={20} />}
                     *     </div>
                     *     <div className="ot-eta-text">
                     *         <span className="ot-eta-lbl">{isDelivered ? 'Delivered on' : 'Estimated Delivery'}</span>
                     *         <div className="ot-eta-date">{isDelivered ? 'Delivered' : 'To be confirmed'}</div>
                     *         <div className="ot-eta-window">
                     *             {isDelivered ? 'Received by recipient' : 'Once shipped, tracking will be updated'}
                     *         </div>
                     *     </div>
                     * </div>
                     */}
                </div>
                <div className="ot-mini-map" role="button" aria-label="Delivery route">
                    <svg className="roads" viewBox="0 0 200 200" preserveAspectRatio="none">
                        <path d="M 0 60 L 200 80" stroke="#cfd6dd" strokeWidth="1.5" fill="none" />
                        <path d="M 0 130 L 200 110" stroke="#cfd6dd" strokeWidth="1.5" fill="none" />
                        <path d="M 70 0 L 90 200" stroke="#cfd6dd" strokeWidth="1.5" fill="none" />
                        <path d="M 140 0 L 130 200" stroke="#cfd6dd" strokeWidth="1.5" fill="none" />
                        <path className="map-route" d="M 45 49 C 78 68, 122 86, 163 115" />
                    </svg>
                    <div className="map-pin-from"><span>A</span></div>
                    <div className="map-pin-to"><span>B</span></div>
                    {isInTransit && <div className="map-courier"><Truck size={14} /></div>}
                    <div className="ot-mini-map-foot">
                        <div className="mm-route">
                            <Navigation size={11} />
                            <span>Seller → Your address</span>
                        </div>
                    </div>
                </div>
            </div>

        </div>
    )
}

function OtTimeline({ order, trackingStatus }: { order: OrderData; trackingStatus: TrackingStatus }) {
    type Entry = { state: 'latest' | 'completed'; Icon: React.ElementType; title: string; meta?: string; date: string; time: string }
    const entries: Entry[] = []
    const history = order.shippingTrackingHistory ?? []

    entries.push({ state: 'completed', Icon: ShoppingBag, title: 'Order placed', meta: `Order received ${order.orderNumber}`, date: formatDate(order.createdAt), time: formatTime(order.createdAt) })
    if (order.paymentStatus === 'paid') {
        entries.push({ state: 'completed', Icon: CreditCard, title: 'Payment confirmed', meta: formatMoney(order.total, order.currency), date: formatDate(order.createdAt), time: formatTime(order.createdAt) })
    }
    if (!['pending', 'unpaid', 'awaiting_payment', 'pending_verification'].includes(order.status)) {
        entries.push({ state: 'completed', Icon: Package, title: 'Order is being prepared', meta: 'Warehouse team is picking your items', date: formatDate(order.createdAt), time: '' })
    }
    if (trackingStatus === 'in-transit' || trackingStatus === 'delivered') {
        entries.push({ state: 'completed', Icon: Truck, title: 'Parcel out for delivery', meta: order.trackingNumber ? `Tracking: ${order.trackingNumber}` : 'Shipped to your address', date: '', time: '' })
    }
    if (trackingStatus === 'delivered') {
        entries.push({ state: 'completed', Icon: PackageCheck, title: 'Parcel delivered', meta: 'Received by recipient', date: '', time: '' })
    }

    // Courier events belong in the activity log, not in the shipping-info card — a buyer shouldn't
    // have to read two timelines. EP stores them oldest-first, and they always follow the lifecycle
    // events above. Kept even when awbNo is null: an EP cancel wipes the AWB, and dropping the
    // history with it would erase every update the buyer had already seen.
    for (const h of history) {
        const display = formatTrackingEventDisplay(h, order.collectionMethod)
        entries.push({
            state: 'completed',
            Icon: Package,
            title: display.title,
            meta: display.note ?? undefined,
            date: h.eventTime ? formatDate(h.eventTime) : '',
            time: h.eventTime ? formatTime(h.eventTime) : '',
        })
    }

    // An order-level cancel/refund outranks any courier event — it goes last, and last is 'latest'.
    if (trackingStatus === 'cancelled') {
        entries.push({ state: 'completed', Icon: XCircle, title: 'Order cancelled', meta: 'This order has been cancelled', date: '', time: '' })
    }
    if (trackingStatus === 'refunded') {
        entries.push({ state: 'completed', Icon: RotateCcw, title: 'Order refunded', meta: 'A refund has been processed for this order', date: '', time: '' })
    }

    // Exactly one 'latest': the newest thing that happened. Entries are built chronologically, so
    // that is simply the last one — which reproduces the old per-branch highlighting and extends
    // it to courier events without a second rule to keep in sync.
    entries[entries.length - 1].state = 'latest'

    return (
        <div className="ot-card">
            <div className="ot-card-head">
                <h3>Activity Timeline</h3>
                <span className="ot-card-aux"><RefreshCw size={12} /> Live updates</span>
            </div>
            <ul className="ot-timeline">
                {[...entries].reverse().map((it, idx) => (
                    <li key={idx} className={`ot-tl-item ${it.state}`}>
                        <span className="ot-tl-node"><it.Icon size={13} /></span>
                        <div className="ot-tl-body">
                            <div className="ot-tl-title">{it.title}</div>
                            {it.meta && <div className="ot-tl-meta">{it.meta}</div>}
                        </div>
                        <div className="ot-tl-stamp">
                            {it.date && <span className="date">{it.date}</span>}
                            {it.time && <span className="time">{it.time}</span>}
                        </div>
                    </li>
                ))}
            </ul>
        </div>
    )
}

function OtItems({ order }: { order: OrderData }) {
    const [open, setOpen] = useState(true)
    return (
        <div className="ot-card">
            <div className="ot-card-head">
                <h3>Items in this Order</h3>
                <span className="ot-card-aux">
                    <button className={open ? 'is-open' : ''} onClick={() => setOpen(o => !o)}>
                        {open ? 'Hide details' : 'Show details'}
                        <ChevronDown size={12} className="chev" />
                    </button>
                </span>
            </div>
            <ul className={`ot-items-list ${open ? 'open' : 'collapsed'}`}>
                {order.items.map((item, idx) => (
                    <li key={idx} className="ot-item">
                        <div className="ot-item-thumb">
                            {item.imageUrl
                                // eslint-disable-next-line @next/next/no-img-element
                                ? <img src={item.imageUrl} alt={item.productName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                : <Package size={26} />}
                        </div>
                        <div className="ot-item-info">
                            <p className="ot-item-name">{item.productName}</p>
                            <div className="ot-item-attr">
                                <span className="qty">×{item.quantity}</span>
                                {item.variant && <span>{item.variant}</span>}
                            </div>
                        </div>
                        <div className="ot-item-price">
                            <span className="ccy">{order.currency}</span>
                            {(item.unitPrice * item.quantity).toFixed(2)}
                        </div>
                    </li>
                ))}
            </ul>
            {open && (
                <div className="ot-items-totals">
                    <div className="row"><span className="lbl">Subtotal</span><span className="val">{formatMoney(order.subtotal, order.currency)}</span></div>
                    {(order.discountAmount ?? 0) > 0 && <div className="row"><span className="lbl">Discount{order.discountCode ? ` (${order.discountCode})` : ''}</span><span className="val">−{formatMoney((order.discountAmount ?? 0) / 100, order.currency)}</span></div>}
                    {order.tax > 0 && <div className="row"><span className="lbl">Tax</span><span className="val">{formatMoney(order.tax, order.currency)}</span></div>}
                    {order.shippingFee > 0 && <div className="row"><span className="lbl">Shipping</span><span className="val">{formatMoney(order.shippingFee, order.currency)}</span></div>}
                    <div className="row total"><span className="lbl">Total Paid</span><span className="val">{formatMoney(order.total, order.currency)}</span></div>
                </div>
            )}
        </div>
    )
}

function OtSide({ order, slug }: { order: OrderData; slug: string }) {
    const pathname = usePathname()
    const shopBase = pathname.startsWith('/sites/') ? `/sites/${slug}` : ''
    const addr = order.shippingAddress
    const hasAddr = addr?.line1 || addr?.city

    return (
        <div className="ot-side">
            {hasAddr && (
                <div className="ot-card">
                    <div className="ot-card-head">
                        <h3>Delivery Address</h3>
                        <span className="ot-card-aux"><MapPin size={12} /> Shipping</span>
                    </div>
                    <div className="ot-addr-block">
                        <div className="ot-addr-name">{order.customerName}</div>
                        {order.customerPhone && <div className="ot-addr-phone">{order.customerPhone}</div>}
                        <div className="ot-addr-lines">
                            {addr.line1}<br />
                            {addr.line2 && <>{addr.line2}<br /></>}
                            {addr.postcode && <em>{addr.postcode} </em>}{addr.city}<br />
                            {addr.state}{addr.country && addr.country !== 'Malaysia' ? `, ${addr.country}` : ', Malaysia'}
                        </div>
                        <span className="ot-addr-tag"><Check size={11} /> Address Verified</span>
                    </div>
                </div>
            )}

            <div className="ot-back-row">
                <Link href={shopBase || '/'} className="ot-back-btn">
                    <Store size={14} /> Back to Shop
                </Link>
            </div>
        </div>
    )
}

function OtDeliveredBanner({ order }: { order: OrderData }) {
    return (
        <div className="ot-delivered-banner">
            <div className="ot-db-icon"><PackageCheck size={22} /></div>
            <div className="ot-db-text">
                <h4 className="ot-db-title">Your parcel was delivered!</h4>
                <p className="ot-db-sub">Hope you love your order. Thank you for shopping with us.</p>
            </div>
            <button className="ot-db-cta"><Star size={13} /> Rate this order</button>
        </div>
    )
}

// Stripe failure paymentStatus is 'failed' (webhook) or 'payment_failed' (auto-cancel cron) — accept both.
const PAY_NOW_STATUSES = new Set(['awaiting_payment', 'failed', 'payment_failed'])
const PAID_STATUSES = new Set(['paid', 'cancelled', 'refunded', 'completed'])

export default function OrderTrackingClient({ order, slug }: Props) {
    const [liveOrder, setLiveOrder] = useState(order)
    const [isRetrying, setIsRetrying] = useState(false)
    const statusRef = useRef(order.status)
    const pathname = usePathname()
    const shopBase = pathname.startsWith('/sites/') ? `/sites/${slug}` : ''

    // Browser Back from Stripe (after retry-payment) → confirm Payment Failed. The inline script in
    // page.tsx covers no-store fresh loads; this pageshow handler covers bfcache restores.
    useEffect(() => {
        const onPageShow = () => {
            const raw = sessionStorage.getItem('pw_stripe_pending')
            if (!raw) return
            sessionStorage.removeItem('pw_stripe_pending')
            try {
                const { orderId, slug: s } = JSON.parse(raw)
                if (orderId && s) {
                    const isLocal = window.location.pathname.startsWith('/sites/')
                    window.location.replace(isLocal ? `/sites/${s}/order/${orderId}/confirm?cancelled=1` : `/order/${orderId}/confirm?cancelled=1`)
                }
            } catch { /* malformed flag — ignore */ }
        }
        window.addEventListener('pageshow', onPageShow)
        return () => window.removeEventListener('pageshow', onPageShow)
    }, [])

    useEffect(() => {
        if (TERMINAL_STATUSES.has(statusRef.current)) return

        const url = `/api/orders/stream/${order.orderNumber}?slug=${encodeURIComponent(slug)}`
        const es = new EventSource(url)
        let errorCount = 0
        const MAX_ERRORS = 5

        es.onmessage = (e) => {
            errorCount = 0
            try {
                const data = JSON.parse(e.data)
                statusRef.current = data.status
                setLiveOrder(prev => ({
                    ...prev,
                    status: data.status,
                    paymentStatus: data.paymentStatus,
                    trackingNumber: data.trackingNumber,
                    awbNo: data.awbNo,
                    shippingCourier: data.shippingCourier,
                    shippingCourierName: data.shippingCourierName,
                    shippingCourierLogo: data.shippingCourierLogo,
                    selfDeliveryCourier: data.selfDeliveryCourier,
                    collectionMethod: data.collectionMethod,
                    shippingTrackingStatus: data.shippingTrackingStatus,
                    shippingTrackingHistory: data.shippingTrackingHistory,
                }))
                if (data.terminal) es.close()
            } catch {
                // ignore malformed events
            }
        }

        es.onerror = () => {
            if (TERMINAL_STATUSES.has(statusRef.current)) { es.close(); return }
            // Stop reconnecting after repeated failures (e.g. persistent 404/500)
            errorCount++
            if (errorCount >= MAX_ERRORS) es.close()
        }

        return () => es.close()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // Pay Now is a Stripe-only retry. BT orders use the receipt-upload flow, not a Stripe session.
    const isStripeOrder = liveOrder.paymentMethod === 'card' || liveOrder.paymentMethod === 'fpx'
    const showPayNow =
        isStripeOrder &&
        PAY_NOW_STATUSES.has(liveOrder.paymentStatus) &&
        !PAID_STATUSES.has(liveOrder.paymentStatus)

    async function handleRetry() {
        setIsRetrying(true)
        try {
            // Read magic-link token from URL if present (no SSR — client-only)
            const urlToken = typeof window !== 'undefined'
                ? new URLSearchParams(window.location.search).get('token') ?? undefined
                : undefined

            const res = await fetch(`/api/orders/${liveOrder.id}/retry-payment`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: urlToken }),
            })
            const data = await res.json()
            if (res.ok && data.success && data.data?.sessionUrl) {
                // Flag for the back-redirect script: browser Back from Stripe → confirm Payment Failed
                sessionStorage.setItem('pw_stripe_pending', JSON.stringify({ orderId: liveOrder.id, slug }))
                window.location.href = data.data.sessionUrl
            } else {
                toast.error(data.error?.message || 'Could not start payment. Please try again.')
            }
        } catch {
            toast.error('Could not start payment. Please try again.')
        } finally {
            setIsRetrying(false)
        }
    }

    const trackingStatus = getTrackingStatus(liveOrder.status, liveOrder.paymentStatus)
    const isDelivered = trackingStatus === 'delivered'
    const isNegativeTerminal = trackingStatus === 'cancelled' || trackingStatus === 'refunded' || trackingStatus === 'payment_failed'

    return (
        <div className={`ot-page${isDelivered ? ' is-delivered' : ''}`}>
            <header className="ck-header">
                <h1>Order Tracking</h1>
                <div className="crumbs">
                    <span>My Orders</span>
                    <ChevronRight size={14} />
                    <strong>{liveOrder.orderNumber}</strong>
                </div>
                <Link href={shopBase || '/'} className="ot-shop-back">
                    <Store size={12} /> Back to Shop
                </Link>
            </header>

            <div className="ck-shell">
                <div className="ck-form-col">
                    {isDelivered && <OtDeliveredBanner order={liveOrder} />}
                    <OtOrderHead order={liveOrder} trackingStatus={trackingStatus} />
                    {showPayNow && (
                        <div className="ot-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                            <div>
                                <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>
                                    {(liveOrder.paymentStatus === 'failed' || liveOrder.paymentStatus === 'payment_failed') ? 'Payment failed' : 'Payment pending'}
                                </div>
                                <div style={{ fontSize: '0.875rem', color: 'var(--f4, #6b7280)' }}>
                                    Complete your payment to confirm the order.
                                </div>
                            </div>
                            <button
                                className="ot-support-btn primary"
                                onClick={handleRetry}
                                disabled={isRetrying}
                                style={{ whiteSpace: 'nowrap' }}
                            >
                                <CreditCard size={13} />
                                {isRetrying ? 'Redirecting…' : 'Pay Now'}
                            </button>
                        </div>
                    )}
                    <OtStageTracker order={liveOrder} trackingStatus={trackingStatus} />
                    {!isNegativeTerminal && <OtShippingCard order={liveOrder} trackingStatus={trackingStatus} />}
                    <OtTimeline order={liveOrder} trackingStatus={trackingStatus} />
                    <OtItems order={liveOrder} />
                </div>
                <div className="ck-summary-col">
                    <OtSide order={liveOrder} slug={slug} />
                </div>
            </div>
        </div>
    )
}
