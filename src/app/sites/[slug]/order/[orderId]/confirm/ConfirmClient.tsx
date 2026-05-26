'use client'
import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
    ArrowLeft, Check, ChevronRight, ShieldCheck,
    Clock, Mail, Calendar, ShoppingBag, ReceiptText,
    Truck, MapPin, Hash, Info, Package,
    UploadCloud, FileImage, X, RotateCcw, Hourglass, AlertCircle,
    PhoneCall, PackageX, HandCoins, Banknote,
} from 'lucide-react'
import { TY_CSS } from './confirm-styles'
import { useI18n } from '@/i18n'
import { PROOF_ACCEPTED_TYPES, PROOF_MAX_SIZE_BYTES } from '@/lib/storefront/checkout'

type OrderItem = { productName: string; quantity: number; unitPrice: number; variant?: string; imageUrl?: string }
type ShippingAddress = { line1?: string; line2?: string; city?: string; state?: string; postcode?: string; country?: string }

export type ConfirmOrder = {
    id: number | string
    orderNumber: string
    items: OrderItem[]
    subtotal: number
    shippingFee?: number
    tax: number
    total: number
    currency: string
    paymentMethod?: string
    paymentStatus?: string
    paymentReference?: string
    stripePaymentIntentId?: string
    customerName: string
    customerEmail: string
    shippingAddress?: ShippingAddress
}

type Props = {
    order: ConfirmOrder
    slug: string
    bankName: string
    bankAccountNo: string
    bankAccountHolder: string
    merchantQrUrl: string
    uploadToken: string
}

type UploadStatus = 'empty' | 'staged' | 'uploading' | 'success'

function formatPrice(price: number, currency: string) {
    if (currency === 'MYR') return `RM ${price.toFixed(2)}`
    if (currency === 'SGD') return `S$${price.toFixed(2)}`
    return `$${price.toFixed(2)}`
}

function maskEmail(email: string) {
    const atIdx = email.lastIndexOf('@')
    if (atIdx < 0) return '**'
    const user = email.slice(0, atIdx)
    const domain = email.slice(atIdx + 1)
    return `${user.slice(0, 2)}**@${domain}`
}

function addBusinessDays(date: Date, days: number): Date {
    const result = new Date(date)
    let added = 0
    while (added < days) {
        result.setDate(result.getDate() + 1)
        const day = result.getDay()
        if (day !== 0 && day !== 6) added++
    }
    return result
}

const ICON_OK = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>'
const CopyIcon = () => (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect width="14" height="14" x="8" y="8" rx="2" ry="2" /><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
    </svg>
)

export default function ConfirmClient({ order, slug, bankName, bankAccountNo, bankAccountHolder, merchantQrUrl, uploadToken }: Props) {
    const router = useRouter()
    const { t } = useI18n()
    const cp = t.storefront.confirmPage

    const clearAndNavigate = useCallback(async (href: string, clearToken: boolean) => {
        if (clearToken) {
            await fetch(`/api/orders/${order.id}/clear-confirm-token`, { method: 'DELETE' }).catch(() => {})
            // Replace history entry so back button cannot return to confirm page after order is done
            window.location.replace(href)
        } else {
            router.push(href)
        }
    }, [order.id, router])

    const [uploadStatus, setUploadStatus] = useState<UploadStatus>(
        order.paymentStatus === 'pending_verification' || order.paymentStatus === 'paid' ? 'success' : 'empty'
    )
    const [uploadFile, setUploadFile] = useState<File | null>(null)
    const [dragging, setDragging] = useState(false)
    const [uploadError, setUploadError] = useState('')
    const [leaveHref, setLeaveHref] = useState('')
    const fileInputRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        const buttons = document.querySelectorAll<HTMLButtonElement>('[data-copy]')
        const cleanup: Array<() => void> = []
        buttons.forEach(btn => {
            const orig = btn.innerHTML
            const handler = () => {
                const txt = btn.dataset.copy
                if (!txt) return
                navigator.clipboard.writeText(txt).then(() => {
                    btn.innerHTML = `${ICON_OK} Copied!`
                    btn.classList.add('copied')
                    setTimeout(() => { btn.innerHTML = orig; btn.classList.remove('copied') }, 1500)
                })
            }
            btn.addEventListener('click', handler)
            cleanup.push(() => btn.removeEventListener('click', handler))
        })
        return () => cleanup.forEach(fn => fn())
    }, [])

    // Intercept browser back button and tab close when BT upload is still pending
    useEffect(() => {
        if (order.paymentMethod !== 'bank_transfer' || uploadStatus === 'success') return
        window.history.pushState(null, '', window.location.href)
        const onPop = () => {
            window.history.pushState(null, '', window.location.href)
            setLeaveHref(`/sites/${slug}`)
        }
        const onBeforeUnload = (e: BeforeUnloadEvent) => {
            e.preventDefault()
            e.returnValue = ''
        }
        window.addEventListener('popstate', onPop)
        window.addEventListener('beforeunload', onBeforeUnload)
        return () => {
            window.removeEventListener('popstate', onPop)
            window.removeEventListener('beforeunload', onBeforeUnload)
        }
    }, [order.paymentMethod, uploadStatus, slug])

    const currency = order.currency || 'MYR'
    const shippingFee = order.shippingFee ?? 0
    const isBT = order.paymentMethod === 'bank_transfer'
    const isCod = order.paymentMethod === 'cod'
    const isStripe = !isBT && !isCod
    const isPaid = order.paymentStatus === 'paid'
    // Order is "done" from the confirm page POV: BT approved, Stripe charged, or COD placed
    const isOrderSuccess = isPaid || isCod || isStripe
    const isSubmitted = isBT && uploadStatus === 'success' && !isPaid
    const addr = order.shippingAddress
    const addrLine = [addr?.city, addr?.state, addr?.postcode].filter(Boolean).join(', ')
    const placed = new Date().toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' })
    const maskedEmail = maskEmail(order.customerEmail)
    const fmtEstDay = (d: Date) => d.toLocaleDateString('en-MY', { day: 'numeric', month: 'short' })
    const today = new Date()
    const estDelivery = (isCod || (isBT && !isPaid))
        ? '3–5 working days (after verification)'
        : `${fmtEstDay(addBusinessDays(today, 3))} – ${fmtEstDay(addBusinessDays(today, 5))}`
    const ccySymbol = currency === 'MYR' ? 'RM' : currency === 'SGD' ? 'S$' : '$'

    const heroCheckClass = isPaid ? '' : isSubmitted ? 'info' : isBT ? 'warning' : ''
    const heroClass = isPaid ? '' : isSubmitted ? ' submitted' : isBT ? ' pending' : ''
    const heroTitle = isPaid
        ? 'Order Confirmed — Payment Verified!'
        : isSubmitted
            ? 'The order has been placed — Awaiting seller confirmation.'
            : isBT ? 'Order placed — Awaiting payment' : 'Order Successfully Placed!'
    const heroSub = isPaid
        ? 'Your payment has been verified by the seller. Your order is now being prepared for shipment.'
        : isSubmitted
            ? "Thanks! We've received your receipt. The seller will verify your transfer against bank records and confirm your order shortly — you'll get an email update."
            : isBT
                ? 'Please complete your bank transfer and upload the receipt below to avoid order cancellation.'
                : isCod
                    ? 'Your order is reserved. Our team will verify your address by phone, then dispatch it for cash-on-delivery.'
                    : 'Your payment was processed successfully. Sit tight — we are getting your order ready for shipment.'
    const badgeLabel = isPaid ? 'Payment Verified' : isSubmitted ? 'Awaiting seller confirmation' : isBT ? 'Awaiting Payment' : isCod ? 'Cash on Delivery' : 'Paid'
    const badgeTone = isPaid ? 'teal' : isSubmitted ? 'blue' : isBT ? 'amber' : isCod ? 'blue' : 'teal'
    const badgeIcon = isPaid ? <Check size={11} /> : isSubmitted ? <Hourglass size={11} /> : isBT ? <Clock size={11} /> : isCod ? <Banknote size={11} /> : <Check size={11} />
    const heroIcon = isPaid
        ? <Check size={36} strokeWidth={3} />
        : isSubmitted
            ? <Hourglass size={36} strokeWidth={2} />
            : isBT ? <Clock size={36} strokeWidth={2.5} /> : <Check size={36} strokeWidth={3} />

    const sumStatus = isPaid
        ? { tone: 'teal', s1: 'Payment verified · Order confirmed', s2: 'Warehouse is preparing your parcel.' }
        : isSubmitted
            ? { tone: 'blue', s1: 'Awaiting seller confirmation', s2: 'Seller will verify your transfer shortly.' }
            : isBT
                ? { tone: 'amber', s1: cp.sumStatusBtS1, s2: cp.sumStatusBtS2 }
                : isCod
                    ? { tone: 'blue', s1: 'Pending phone verification', s2: "We'll call to confirm your address." }
                    : { tone: 'teal', s1: 'Payment received · Processing', s2: 'Warehouse is preparing your parcel.' }

    const shipsText = isCod ? 'After phone verification' : isBT && !isPaid ? 'Within 24 h after verification' : 'Within 24 h'

    const validateFile = (f: File): boolean => {
        if (!PROOF_ACCEPTED_TYPES.includes(f.type)) {
            setUploadError('Invalid file type. Please upload a JPEG, PNG, or PDF.')
            return false
        }
        if (f.size > PROOF_MAX_SIZE_BYTES) {
            setUploadError('File too large. Maximum size is 5MB.')
            return false
        }
        setUploadError('')
        return true
    }

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files?.[0]
        if (f && validateFile(f)) { setUploadFile(f); setUploadStatus('staged') }
    }

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault()
        setDragging(false)
        const f = e.dataTransfer.files[0]
        if (f && validateFile(f)) { setUploadFile(f); setUploadStatus('staged') }
    }

    const handleUpload = async () => {
        if (!uploadFile || uploadStatus === 'uploading') return
        setUploadStatus('uploading')
        setUploadError('')
        try {
            const formData = new FormData()
            formData.append('file', uploadFile)
            formData.append('token', uploadToken)
            const res = await fetch(`/api/orders/${order.id}/upload-proof-direct`, {
                method: 'POST',
                body: formData,
            })
            if (!res.ok) {
                const err = await res.json().catch(() => ({}))
                throw new Error(err?.error === 'expired'
                    ? 'Payment window expired. Please contact the seller.'
                    : (err?.error ?? 'Submission failed'))
            }
            setUploadStatus('success')
        } catch (err) {
            setUploadError(err instanceof Error ? err.message : 'Upload failed. Please try again.')
            setUploadStatus('staged')
        }
    }

    const resetUpload = () => {
        setUploadFile(null)
        setUploadStatus('empty')
        setUploadError('')
        if (fileInputRef.current) fileInputRef.current.value = ''
    }

    return (
        <div className="ty-page">
            {/* ── Header ── */}
            <header className="ty-hd">
                <button
                    className="ty-back"
                    onClick={() => {
                        if (isBT && uploadStatus !== 'success') {
                            setLeaveHref(`/sites/${slug}`)
                        } else {
                            clearAndNavigate(`/sites/${slug}`, isOrderSuccess)
                        }
                    }}
                ><ArrowLeft size={16} /></button>
                <h1 className="ty-h1">Order Confirmation</h1>
                <div className="ty-crumbs">
                    <span>Cart</span><ChevronRight size={12} />
                    <span>Checkout</span><ChevronRight size={12} />
                    <strong>Confirmation</strong>
                    <span className="ty-ssl"><ShieldCheck size={11} /> SSL Secure</span>
                </div>
            </header>

            <div className="ty-shell">
                <div className="ty-left">
                    {/* ── Hero ── */}
                    <div className={`ty-hero${heroClass}`}>
                        <div className="ty-check-wrap">
                            <span className="ty-ring r1" aria-hidden="true" />
                            <span className="ty-ring r2" aria-hidden="true" />
                            <div className={`ty-check${heroCheckClass ? ` ${heroCheckClass}` : ''}`}>
                                {heroIcon}
                            </div>
                        </div>
                        <h2 className="ty-hero-title">{heroTitle}</h2>
                        <div className="ty-hero-order">
                            <span>Order ID</span>
                            <span className="ty-order-id">#{order.orderNumber}</span>
                            <button className="ty-copy-btn" data-copy={order.orderNumber} title="Copy order ID" aria-label="Copy order ID">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2" /><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" /></svg>
                            </button>
                            <span className={`ty-hero-badge tone-${badgeTone}`}>
                                {badgeIcon}
                                {badgeLabel}
                            </span>
                        </div>
                        <p className="ty-hero-sub">{heroSub}</p>
                    </div>

                    {/* ── Bank Transfer: Transfer Details ── */}
                    {isBT && (
                        <div className="ty-bank-block ty-bank-block-compact">
                            <div className="ty-block-head ty-block-head-compact">
                                <span className="ty-block-num">01</span>
                                <div className="ty-block-titles"><h3>Transfer Details</h3></div>
                                <span className="ty-amount-chip">
                                    <span className="ccy">{ccySymbol}</span>
                                    {order.total.toFixed(2)}
                                </span>
                            </div>
                            <div className="manual-top" style={{ marginTop: 4 }}>
                                <div className="qr-side">
                                    {merchantQrUrl
                                        // eslint-disable-next-line @next/next/no-img-element
                                        ? <img src={merchantQrUrl} alt="DuitNow QR" className="ty-qr-img" />
                                        : <div className="ty-qr-ph"><svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="4" height="4" rx="1" /><rect x="19" y="19" width="2" height="2" rx="0.5" /></svg></div>
                                    }
                                    <div className="scan-hint">Scan with Maybank2u · TNG · Boost · GrabPay</div>
                                </div>
                                <div className="bank-side">
                                    <ul className="bank-rows compact">
                                        {bankName && (
                                            <li className="bank-row">
                                                <span className="bk-label">Bank</span>
                                                <span className="bk-value">{bankName}</span>
                                            </li>
                                        )}
                                        {bankAccountHolder && (
                                            <li className="bank-row">
                                                <span className="bk-label">Holder</span>
                                                <span className="bk-value">{bankAccountHolder}</span>
                                            </li>
                                        )}
                                        {bankAccountNo && (
                                            <li className="bank-row copy-row">
                                                <span className="bk-label">Account No.</span>
                                                <span className="bk-value accent mono">{bankAccountNo}</span>
                                                <button className="copy-btn" data-copy={bankAccountNo} aria-label="Copy account number">
                                                    <CopyIcon /> Copy
                                                </button>
                                            </li>
                                        )}
                                        <li className="bank-row copy-row">
                                            <span className="bk-label">ORDER ID</span>
                                            <span className="bk-value accent mono">{order.orderNumber}</span>
                                            <button className="copy-btn" data-copy={order.orderNumber} aria-label="Copy order reference">
                                                <CopyIcon /> Copy
                                            </button>
                                        </li>
                                    </ul>
                                    <div className="ty-memo-note">
                                        <Info size={13} />
                                        <span>Please paste this <strong>Order ID</strong> into your bank transfer&apos;s <strong>reference / description</strong> field — it&apos;s how we match your payment to this order.</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ── Bank Transfer: Upload Receipt ── */}
                    {isBT && uploadStatus !== 'success' && (
                        <div className={`ty-upload-block${uploadStatus === 'empty' || uploadStatus === 'staged' ? ' ty-upload-required' : ''}`}>
                            <div className="ty-block-head ty-block-head-compact">
                                <span className="ty-block-num">02</span>
                                <div className="ty-block-titles"><h3>Upload Payment Receipt</h3></div>
                                <span className="ty-step-pill pending"><AlertCircle size={11} /> Action required</span>
                            </div>

                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/jpeg,image/png,application/pdf"
                                style={{ display: 'none' }}
                                onChange={handleFileSelect}
                            />

                            {uploadStatus === 'empty' && (
                                <div
                                    className={`ty-dropzone horizontal${dragging ? ' dragging' : ''}`}
                                    onClick={() => fileInputRef.current?.click()}
                                    onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
                                    onDragLeave={() => setDragging(false)}
                                    onDrop={handleDrop}
                                    role="button"
                                    tabIndex={0}
                                    onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
                                    aria-label="Upload payment receipt"
                                >
                                    <div className="ty-dz-icon"><UploadCloud size={18} /></div>
                                    <div className="ty-dz-text">
                                        <div className="ty-dz-title">Click to upload a receipt image</div>
                                        <div className="ty-dz-sub">JPG, PNG or PDF · Max 5 MB · Drag &amp; drop supported</div>
                                    </div>
                                    <button className="ty-dz-btn" onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click() }}>
                                        <FileImage size={13} /> Choose file
                                    </button>
                                </div>
                            )}

                            {(uploadStatus === 'staged' || uploadStatus === 'uploading') && uploadFile && (
                                <div className="ty-file-card">
                                    <div className="ty-file-thumb"><FileImage size={20} /></div>
                                    <div className="ty-file-info">
                                        <p className="ty-file-name">{uploadFile.name}</p>
                                        <div className="ty-file-meta">{uploadFile.type.split('/')[1]?.toUpperCase()} · {(uploadFile.size / 1024).toFixed(0)} KB · ready to submit</div>
                                    </div>
                                    {uploadStatus !== 'uploading' && (
                                        <button className="ty-file-x" title="Remove" onClick={resetUpload} aria-label="Remove file">
                                            <X size={16} />
                                        </button>
                                    )}
                                </div>
                            )}

                            {uploadError && <p className="ty-upload-error">{uploadError}</p>}

                            <div className="ty-upload-actions">
                                {(uploadStatus === 'staged' || uploadStatus === 'uploading') && (
                                    <>
                                        <button className="ty-btn ghost" onClick={resetUpload} disabled={uploadStatus === 'uploading'}>
                                            <RotateCcw size={13} /> Replace
                                        </button>
                                        <button className="ty-btn primary" onClick={handleUpload} disabled={uploadStatus === 'uploading'} aria-busy={uploadStatus === 'uploading'}>
                                            {uploadStatus === 'uploading'
                                                ? <><span className="ty-spin">↻</span> Uploading…</>
                                                : <><Check size={13} /> Done · Submit Receipt</>
                                            }
                                        </button>
                                    </>
                                )}
                            </div>

                            <div className="ty-email-note">
                                <Mail size={14} />
                                <span>A copy of your order details and a re-upload link has been sent to <strong>{maskedEmail}</strong>.</span>
                            </div>
                        </div>
                    )}

                    {/* ── Bank Transfer: Upload success / payment verified state ── */}
                    {isBT && uploadStatus === 'success' && (
                        <div className="ty-upload-block">
                            <div className="ty-block-head ty-block-head-compact">
                                <span className="ty-block-num">02</span>
                                <div className="ty-block-titles">
                                    <h3>Upload Payment Receipt</h3>
                                </div>
                                <span className={`ty-step-pill done${isPaid ? ' verified' : ''}`}>
                                    <Check size={11} /> {isPaid ? 'Verified' : 'Submitted'}
                                </span>
                            </div>
                            <div className="ty-success-state">
                                <div className={`ty-success-icon${isPaid ? ' verified' : ''}`}><Check size={20} strokeWidth={3} /></div>
                                <div className="ty-success-text">
                                    <p className="ty-success-title">
                                        {isPaid ? 'Payment verified by seller' : 'File uploaded successfully'}
                                    </p>
                                    <p className="ty-success-sub">
                                        {isPaid
                                            ? 'Your transfer has been confirmed. Your order is now being prepared for shipment.'
                                            : "We'll verify within 1–2 business hours and email you a confirmation."}
                                    </p>
                                </div>
                            </div>
                            {!isPaid && (
                                <>
                                    <div className="ty-upload-actions">
                                        <button className="ty-btn ghost" onClick={resetUpload}>
                                            <RotateCcw size={13} /> Upload a different file
                                        </button>
                                    </div>
                                    <div className="ty-email-note">
                                        <Mail size={14} />
                                        <span>A copy of your order details and a re-upload link has also been sent to <strong>{maskedEmail}</strong>.</span>
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    {/* ── Stripe: Payment Confirmed ── */}
                    {isStripe && (
                        <div className="ty-bank-block ty-unified">
                            <div className="ty-block-head no-num">
                                <div className="ty-block-titles">
                                    <h3>Payment &amp; Order Status</h3>
                                    <p>Payment captured by Stripe — your order is now being prepared for shipment.</p>
                                </div>
                                <span className="ty-step-pill done"><Check size={11} /> Confirmed</span>
                            </div>
                            <div className="ty-paid-card">
                                <div className="ty-paid-icon"><Check size={22} strokeWidth={3} /></div>
                                <div className="ty-paid-body">
                                    <p className="ty-paid-title">Your payment of <strong>{formatPrice(order.total, currency)}</strong> has been processed successfully via Stripe.</p>
                                    <p className="ty-paid-sub">Funds settle to the seller within 1–2 business days.</p>
                                </div>
                                <div className="ty-paid-brands" aria-hidden="true">
                                    <span className="brand-mark visa">VISA</span>
                                    <span className="brand-mark mc"><span className="mc-circles"><span /><span /></span></span>
                                    <span className="brand-mark amex">AMEX</span>
                                    <span className="brand-mark fpx">FPX</span>
                                </div>
                            </div>
                            {order.stripePaymentIntentId && (
                                <ul className="ty-paid-meta">
                                    <li>
                                        <span className="lbl"><Hash size={12} /> Transaction ID</span>
                                        <span className="val mono">{order.stripePaymentIntentId}</span>
                                        <button className="copy-btn" data-copy={order.stripePaymentIntentId} aria-label="Copy transaction ID">
                                            <CopyIcon /> Copy
                                        </button>
                                    </li>
                                </ul>
                            )}
                            <div className="ty-email-note">
                                <Mail size={14} />
                                <span>A receipt + tracking link will reach <strong>{maskedEmail}</strong> the moment the courier picks up your parcel.</span>
                            </div>
                        </div>
                    )}

                    {/* ── COD: Pay on Delivery ── */}
                    {isCod && (
                        <div className="ty-bank-block ty-unified">
                            <div className="ty-block-head no-num">
                                <div className="ty-block-titles">
                                    <h3>Pay on Delivery</h3>
                                    <p>Cash hand-off when the courier arrives — no app required.</p>
                                </div>
                                <span className="ty-step-pill pending">
                                    <PhoneCall size={11} /> Pending verification
                                </span>
                            </div>
                            <div className="ty-cod-card">
                                <div className="ty-cod-icon"><HandCoins size={26} /></div>
                                <div className="ty-cod-body">
                                    <p className="ty-cod-title">Please prepare exactly <strong>{formatPrice(order.total, currency)}</strong> in cash.</p>
                                    <p className="ty-cod-sub">You&apos;ll pay the courier rider when you receive your package. They cannot provide change for amounts above RM 200.</p>
                                </div>
                            </div>
                            <ul className="ty-cod-tips">
                                <li><Banknote size={14} /><span>Small notes preferred · couriers don&apos;t carry change.</span></li>
                                <li><PackageX size={14} /><span>Two failed delivery attempts will auto-cancel the order.</span></li>
                            </ul>
                            <div className="ty-email-note">
                                <Mail size={14} />
                                <span>A full order summary has been sent to <strong>{maskedEmail}</strong> for your records.</span>
                            </div>
                        </div>
                    )}

                </div>

                {/* ── Summary ── */}
                <div className="ty-right">
                    <div className="summary-card">
                        <h3 className="summary-head">Order Summary</h3>
                        <ul className="summary-items">
                            {order.items.map((item, idx) => (
                                <li key={idx} className="summary-item">
                                    <div className="item-thumb">
                                        {item.imageUrl
                                            // eslint-disable-next-line @next/next/no-img-element
                                            ? <img src={item.imageUrl} alt={item.productName} />
                                            : <ShoppingBag size={18} />}
                                    </div>
                                    <div className="item-info">
                                        <p className="item-name">{item.productName}</p>
                                        <div className="item-meta">
                                            <span className="qty">×{item.quantity}</span>
                                            {item.variant || formatPrice(item.unitPrice, currency)}
                                        </div>
                                    </div>
                                    <span className="item-price">{formatPrice(item.unitPrice * item.quantity, currency)}</span>
                                </li>
                            ))}
                        </ul>
                        <div className="summary-line"><span className="lbl">Subtotal</span><span className="val">{formatPrice(order.subtotal, currency)}</span></div>
                        <div className="summary-line"><span className="lbl">SST (6%)</span><span className="val">{formatPrice(order.tax, currency)}</span></div>
                        <div className="summary-line"><span className="lbl">Shipping</span><span className="val">{formatPrice(shippingFee, currency)}</span></div>
                        <div className="summary-total">
                            <span className="t-lbl">Total</span>
                            <span className="t-val"><span className="ccy">{ccySymbol}</span>{order.total.toFixed(2)}</span>
                        </div>
                        <div className={`ty-summary-status tone-${sumStatus.tone}`}>
                            <span className="ty-status-dot" aria-hidden="true" />
                            <div>
                                <div className="ty-status-line1">{sumStatus.s1}</div>
                                <div className="ty-status-line2">{sumStatus.s2}</div>
                            </div>
                        </div>
                        <div className="ty-summary-meta">
                            <div className="ty-meta-row"><Calendar size={13} /><span><strong>Placed</strong> · {placed}</span></div>
                            <div className="ty-meta-row"><Truck size={13} /><span><strong>Ships</strong> · {shipsText}</span></div>
                            <div className="ty-meta-row"><Package size={13} /><span><strong>Est. Delivery</strong> · {estDelivery}</span></div>
                            {addrLine && <div className="ty-meta-row"><MapPin size={13} /><span><strong>To</strong> · {order.customerName}, {addrLine}</span></div>}
                        </div>
                        <div className="ty-cta-row">
                            <button className="ty-btn primary lg" onClick={() => {
                                if (isBT && uploadStatus !== 'success') {
                                    setLeaveHref(`/sites/${slug}`)
                                } else {
                                    clearAndNavigate(`/sites/${slug}`, isOrderSuccess)
                                }
                            }}>
                                <ShoppingBag size={15} /> Continue Shopping
                            </button>
                            {(!isBT || isPaid) && (
                                <button className="ty-btn outline lg" onClick={() => clearAndNavigate(`/sites/${slug}/orders/${order.orderNumber}`, isOrderSuccess)}>
                                    <ReceiptText size={15} /> View My Orders
                                </button>
                            )}
                        </div>
                        <div className="summary-trust"><ShieldCheck size={11} /> Encrypted Checkout · Order Locked</div>
                    </div>
                </div>
            </div>

            {/* Leave warning modal — shown when BT buyer navigates away without uploading proof */}
            {leaveHref && (
                <div
                    style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', backdropFilter: 'blur(4px)', display: 'grid', placeItems: 'center', padding: '24px', zIndex: 200 }}
                    onClick={() => setLeaveHref('')}
                >
                    <div
                        style={{ background: 'var(--card)', border: '1px solid var(--bd)', borderRadius: '16px', overflow: 'hidden', maxWidth: '420px', width: '100%', boxShadow: '0 20px 60px -16px rgba(15,23,42,0.20),0 4px 16px -4px rgba(15,23,42,0.12)' }}
                        onClick={e => e.stopPropagation()}
                    >
                        <div style={{ background: '#fff4dc', borderBottom: '1px solid #f1d693', padding: '12px 20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <AlertCircle size={15} style={{ color: '#8a5c0a', flexShrink: 0 }} />
                            <p style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: '#8a5c0a', margin: 0 }}>{cp.leaveWarningBanner}</p>
                        </div>
                        <div style={{ padding: '20px' }}>
                            <p style={{ fontSize: '15px', fontWeight: 700, color: 'var(--f1)', margin: '0 0 8px' }}>{cp.leaveWarningTitle}</p>
                            <p style={{ fontSize: '13px', color: 'var(--f3)', lineHeight: 1.6, margin: '0 0 20px' }}>{cp.leaveWarningBody}</p>
                            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                <button className="ty-btn ghost" onClick={() => clearAndNavigate(leaveHref, isOrderSuccess)}>{cp.leaveAnyway}</button>
                                <button className="ty-btn primary" onClick={() => setLeaveHref('')}>{cp.stayUpload}</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <style>{TY_CSS}</style>
        </div>
    )
}
