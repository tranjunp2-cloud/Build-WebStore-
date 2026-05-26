'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { Toaster } from '@/components/ui/sonner'
import {
    ShoppingBag, Package, Truck, PackageCheck, ReceiptText,
    Calendar, CreditCard, Copy, Check, Hash, MapPin, ShieldCheck,
    CalendarClock, Navigation, LifeBuoy, Mail, ChevronDown,
    RefreshCw, Store, Star, ChevronRight,
} from 'lucide-react'

type TrackingStatus = 'processing' | 'in-transit' | 'delivered'

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
    currency: string
    customerName: string
    customerPhone: string | null
    trackingNumber: string | null
    createdAt: string
    items: OrderItem[]
    shippingAddress: ShippingAddress
}

type Props = { order: OrderData; slug: string }

const TERMINAL_STATUSES = new Set(['completed', 'cancelled', 'refunded', 'payment_failed'])
const POLL_INTERVAL = 30_000

const STATUS_CHANGE_LABELS: Record<string, { text: string; type: 'success' | 'error' }> = {
    new:          { text: 'Your order is being processed!',   type: 'success' },
    confirmed:    { text: 'Your order has been confirmed!',   type: 'success' },
    ready_to_ship: { text: 'Your order is ready to ship!',   type: 'success' },
    shipped:      { text: 'Your order has been shipped!',     type: 'success' },
    completed:    { text: 'Your order has been delivered!',   type: 'success' },
    cancelled:    { text: 'Your order has been cancelled.',   type: 'error' },
    refunded:     { text: 'Your order has been refunded.',    type: 'error' },
}

function getTrackingStatus(status: string): TrackingStatus {
    if (status === 'shipped') return 'in-transit'
    if (status === 'completed') return 'delivered'
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
    { key: 'shipped', label: 'Shipped', Icon: Truck },
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

    const STATUS_META = {
        'processing': { cls: 'processing', Icon: Package, eyebrow: 'Current Status', title: 'Processing' },
        'in-transit': { cls: 'in-transit', Icon: Truck, eyebrow: 'Current Status', title: 'In Transit' },
        'delivered': { cls: 'delivered', Icon: PackageCheck, eyebrow: 'Order Status', title: 'Delivered' },
    }
    const s = STATUS_META[trackingStatus]

    const paymentLabel = isPaid ? 'Paid' : (() => {
        const m: Record<string, string> = { bank_transfer: 'Bank Transfer', card: 'Credit Card', cod: 'COD', ewallet: 'e-Wallet' }
        return `Pending · ${m[order.paymentMethod ?? ''] ?? 'Pending'}`
    })()

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
                    <span className="ot-oh-id"><span className="hash">#</span>{order.orderNumber}</span>
                    <button className="ot-oh-copy" onClick={handleCopy} title="Copy order ID">
                        {copied ? <Check size={13} /> : <Copy size={13} />}
                    </button>
                    <span className={`ot-payment-chip ${isPaid ? 'paid' : 'pending'}`}>
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

function OtShippingCard({ order, trackingStatus }: { order: OrderData; trackingStatus: TrackingStatus }) {
    const [copied, setCopied] = useState(false)
    const trackingNo = order.trackingNumber
    const isInTransit = trackingStatus === 'in-transit'
    const isDelivered = trackingStatus === 'delivered'

    const handleCopy = () => {
        if (trackingNo) navigator.clipboard?.writeText(trackingNo)
        setCopied(true)
        setTimeout(() => setCopied(false), 1600)
    }

    return (
        <div className="ot-card">
            <div className="ot-card-head">
                <h3>Shipping Information</h3>
                <span className="ot-card-aux"><ShieldCheck size={12} /> Tracked shipment</span>
            </div>
            <div className="ot-ship-grid">
                <div className="ot-ship-info">
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
                            <span className="ot-tr-value" style={{ color: 'var(--f4)', fontStyle: 'italic' }}>Not yet assigned</span>
                        </div>
                    )}
                    <div className="ot-eta-card">
                        <div className="ot-eta-icon">
                            {isDelivered ? <PackageCheck size={20} /> : <CalendarClock size={20} />}
                        </div>
                        <div className="ot-eta-text">
                            <span className="ot-eta-lbl">{isDelivered ? 'Delivered on' : 'Estimated Delivery'}</span>
                            <div className="ot-eta-date">{isDelivered ? 'Delivered' : 'To be confirmed'}</div>
                            <div className="ot-eta-window">
                                {isDelivered ? 'Received by recipient' : 'Once shipped, tracking will be updated'}
                            </div>
                        </div>
                    </div>
                </div>
                <div className="ot-mini-map" role="button" aria-label="Delivery route">
                    <svg className="roads" viewBox="0 0 200 200" preserveAspectRatio="none">
                        <path d="M 0 60 L 200 80" stroke="#cfd6dd" strokeWidth="1.5" fill="none" />
                        <path d="M 0 130 L 200 110" stroke="#cfd6dd" strokeWidth="1.5" fill="none" />
                        <path d="M 70 0 L 90 200" stroke="#cfd6dd" strokeWidth="1.5" fill="none" />
                        <path d="M 140 0 L 130 200" stroke="#cfd6dd" strokeWidth="1.5" fill="none" />
                        <path className="map-route" d="M 36 50 C 70 90, 120 100, 170 150" />
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

    entries.push({ state: 'completed', Icon: ShoppingBag, title: 'Order placed', meta: `Order received #${order.orderNumber}`, date: formatDate(order.createdAt), time: formatTime(order.createdAt) })
    if (order.paymentStatus === 'paid') {
        entries.push({ state: 'completed', Icon: CreditCard, title: 'Payment confirmed', meta: formatMoney(order.total, order.currency), date: formatDate(order.createdAt), time: formatTime(order.createdAt) })
    }
    if (!['pending', 'unpaid', 'awaiting_payment', 'pending_verification'].includes(order.status)) {
        entries.push({ state: trackingStatus === 'processing' ? 'latest' : 'completed', Icon: Package, title: 'Order is being prepared', meta: 'Warehouse team is picking your items', date: formatDate(order.createdAt), time: '' })
    }
    if (trackingStatus === 'in-transit' || trackingStatus === 'delivered') {
        entries.push({ state: trackingStatus === 'in-transit' ? 'latest' : 'completed', Icon: Truck, title: 'Parcel out for delivery', meta: order.trackingNumber ? `Tracking: ${order.trackingNumber}` : 'Shipped to your address', date: '', time: '' })
    }
    if (trackingStatus === 'delivered') {
        entries.push({ state: 'latest', Icon: PackageCheck, title: 'Parcel delivered', meta: 'Received by recipient', date: '', time: '' })
    }

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
                    {order.tax > 0 && <div className="row"><span className="lbl">Tax</span><span className="val">{formatMoney(order.tax, order.currency)}</span></div>}
                    {order.shippingFee > 0 && <div className="row"><span className="lbl">Shipping</span><span className="val">{formatMoney(order.shippingFee, order.currency)}</span></div>}
                    <div className="row total"><span className="lbl">Total Paid</span><span className="val">{formatMoney(order.total, order.currency)}</span></div>
                </div>
            )}
        </div>
    )
}

function OtSide({ order, slug }: { order: OrderData; slug: string }) {
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

            <div className="ot-support">
                <div className="ot-support-head">
                    <div className="ot-support-icon"><LifeBuoy size={19} /></div>
                    <div>
                        <div className="ot-support-title">Need help?</div>
                        <div className="ot-support-sub">Contact the seller for assistance</div>
                    </div>
                </div>
                <button className="ot-support-btn primary"><Mail size={13} /> Email Support</button>
            </div>

            <div className="ot-back-row">
                <Link href={`/sites/${slug}/products`} className="ot-back-btn">
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

export default function OrderTrackingClient({ order, slug }: Props) {
    const [liveOrder, setLiveOrder] = useState(order)
    const statusRef = useRef(order.status)

    useEffect(() => {
        if (TERMINAL_STATUSES.has(statusRef.current)) return

        const orderNumber = order.orderNumber

        async function poll() {
            try {
                const res = await fetch(`/api/orders/track/${orderNumber}?slug=${encodeURIComponent(slug)}`)
                if (!res.ok) return
                const data = await res.json()

                if (data.status !== statusRef.current) {
                    statusRef.current = data.status
                    setLiveOrder(prev => ({
                        ...prev,
                        status: data.status,
                        paymentStatus: data.paymentStatus,
                        trackingNumber: data.trackingNumber,
                    }))
                    const label = STATUS_CHANGE_LABELS[data.status]
                    if (label) {
                        if (label.type === 'error') toast.error(label.text, { duration: 6000 })
                        else toast.success(label.text, { duration: 6000 })
                    }
                    if (data.terminal) clearInterval(timerId)
                }
            } catch {
                // retry on next tick
            }
        }

        const timerId = setInterval(() => {
            if (!document.hidden) poll()
        }, POLL_INTERVAL)

        function onVisible() {
            if (!document.hidden) poll()
        }
        document.addEventListener('visibilitychange', onVisible)

        return () => {
            clearInterval(timerId)
            document.removeEventListener('visibilitychange', onVisible)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const trackingStatus = getTrackingStatus(liveOrder.status)
    const isDelivered = trackingStatus === 'delivered'

    return (
        <div className={`ot-page${isDelivered ? ' is-delivered' : ''}`}>
            <Toaster position="top-center" />
            <header className="ck-header">
                <h1>Order Tracking</h1>
                <div className="crumbs">
                    <span>My Orders</span>
                    <ChevronRight size={14} />
                    <strong>#{liveOrder.orderNumber}</strong>
                </div>
                <Link href={`/sites/${slug}/products`} className="ot-shop-back">
                    <Store size={12} /> Back to Shop
                </Link>
            </header>

            <div className="ck-shell">
                <div className="ck-form-col">
                    {isDelivered && <OtDeliveredBanner order={liveOrder} />}
                    <OtOrderHead order={liveOrder} trackingStatus={trackingStatus} />
                    <OtStageTracker order={liveOrder} trackingStatus={trackingStatus} />
                    <OtShippingCard order={liveOrder} trackingStatus={trackingStatus} />
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
