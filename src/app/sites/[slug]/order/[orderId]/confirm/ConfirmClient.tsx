'use client'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import {
    ArrowLeft, Check, ChevronRight, ShieldCheck,
    Banknote, Clock, Mail, Calendar, ShoppingBag, ReceiptText,
    Truck, MapPin, Hash, Info,
    UploadCloud, FileImage, X, RotateCcw, Hourglass, AlertCircle,
} from 'lucide-react'
import { TY_CSS } from './confirm-styles'

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
    const [user, domain] = email.split('@')
    return `${user.slice(0, 2)}**@${domain}`
}

const ICON_OK = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>'
const ACCEPTED_MIME = ['image/jpeg', 'image/png', 'application/pdf']
const MAX_BYTES = 5 * 1024 * 1024

export default function ConfirmClient({ order, slug, bankName, bankAccountNo, bankAccountHolder, merchantQrUrl, uploadToken }: Props) {
    const [uploadStatus, setUploadStatus] = useState<UploadStatus>('empty')
    const [uploadFile, setUploadFile] = useState<File | null>(null)
    const [dragging, setDragging] = useState(false)
    const [uploadError, setUploadError] = useState('')
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

    const currency = order.currency || 'MYR'
    const shippingFee = order.shippingFee ?? 10
    const isBT = order.paymentMethod === 'bank_transfer'
    const isCod = order.paymentMethod === 'cod'
    const isStripe = !isBT && !isCod
    const isSubmitted = isBT && uploadStatus === 'success'
    const addr = order.shippingAddress
    const addrLine = [addr?.city, addr?.state, addr?.postcode].filter(Boolean).join(', ')
    const placed = new Date().toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' })
    const maskedEmail = maskEmail(order.customerEmail)
    const ccySymbol = currency === 'MYR' ? 'RM' : currency === 'SGD' ? 'S$' : '$'

    // Hero — changes after receipt submitted
    const heroCheckClass = isSubmitted ? 'info' : isBT ? 'warning' : isCod ? 'blue' : ''
    const heroClass = isSubmitted ? ' submitted' : isBT ? ' pending' : ''
    const heroTitle = isSubmitted
        ? 'Order placed — Awaiting seller confirmation.'
        : isBT ? 'Order placed — Awaiting payment' : 'Order Successfully Placed!'
    const heroSub = isSubmitted
        ? "Thanks! We've received your receipt. The seller will verify your transfer against bank records and confirm your order shortly — you'll get an email update."
        : isBT
            ? 'Please complete your bank transfer and upload the receipt below to avoid order cancellation.'
            : isCod
                ? 'Your order is reserved. Our team will verify your address by phone, then dispatch it for cash-on-delivery.'
                : 'Your payment was processed successfully. Sit tight — we are getting your order ready for shipment.'
    const badgeLabel = isSubmitted ? 'Awaiting seller confirmation' : isBT ? 'Awaiting Payment' : isCod ? 'Cash on Delivery' : 'Paid'
    const badgeTone = isSubmitted ? 'blue' : isBT ? 'amber' : isCod ? 'blue' : 'teal'
    const badgeIcon = isSubmitted ? <Hourglass size={11} /> : isBT ? <Clock size={11} /> : isCod ? <Banknote size={11} /> : <Check size={11} />
    const heroIcon = isSubmitted
        ? <Hourglass size={36} strokeWidth={2} />
        : isBT ? <Clock size={36} strokeWidth={2.5} /> : isCod ? <Banknote size={36} strokeWidth={2} /> : <Check size={36} strokeWidth={3} />

    const sumStatus = isSubmitted
        ? { tone: 'blue', s1: 'Awaiting seller confirmation', s2: 'Seller will verify your transfer shortly.' }
        : isBT
            ? { tone: 'amber', s1: 'Action Required — Upload Receipt', s2: "We can't ship until your transfer is verified." }
            : isCod
                ? { tone: 'blue', s1: 'Pending phone verification', s2: "We'll call to confirm your address." }
                : { tone: 'teal', s1: 'Payment received · Processing', s2: 'Warehouse is preparing your parcel.' }

    const shipsText = isCod ? 'After phone verification' : isBT ? 'Within 24 h after verification' : 'Within 24 h'

    // Upload handlers
    const validateFile = (f: File): boolean => {
        if (!ACCEPTED_MIME.includes(f.type)) {
            setUploadError('Invalid file type. Please upload a JPEG, PNG, or PDF.')
            return false
        }
        if (f.size > MAX_BYTES) {
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
                <Link href={`/sites/${slug}/products`} className="ty-back"><ArrowLeft size={16} /></Link>
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
                        <div className="ty-block ty-block-compact">
                            <div className="ty-block-hd ty-block-hd-compact">
                                <span className="ty-block-num">01</span>
                                <div className="ty-block-titles"><h3>Transfer Details</h3></div>
                                <span className="ty-amount-chip">
                                    <span className="ccy">{ccySymbol}</span>
                                    {order.total.toFixed(2)}
                                </span>
                            </div>
                            <div className="ty-bank-top">
                                <div className="ty-qr-side">
                                    {merchantQrUrl
                                        ? <img src={merchantQrUrl} alt="DuitNow QR" className="ty-qr-img" />
                                        : <div className="ty-qr-ph"><svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="4" height="4" rx="1" /><rect x="19" y="19" width="2" height="2" rx="0.5" /></svg></div>
                                    }
                                    <div className="ty-qr-hint">Scan with Maybank2u · TNG · Boost · GrabPay</div>
                                </div>
                                <div className="ty-bank-side">
                                    <ul className="ty-bank-rows">
                                        {bankName && (
                                            <li className="ty-bank-row">
                                                <span className="ty-bk-lbl">Bank</span>
                                                <span className="ty-bk-val">{bankName}</span>
                                            </li>
                                        )}
                                        {bankAccountHolder && (
                                            <li className="ty-bank-row">
                                                <span className="ty-bk-lbl">Holder</span>
                                                <span className="ty-bk-val">{bankAccountHolder}</span>
                                            </li>
                                        )}
                                        {bankAccountNo && (
                                            <li className="ty-bank-row ty-copy-row">
                                                <span className="ty-bk-lbl">Account No.</span>
                                                <span className="ty-bk-val mono">{bankAccountNo}</span>
                                                <button className="ty-copy-btn-row" data-copy={bankAccountNo} aria-label="Copy account number">
                                                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2" /><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" /></svg>
                                                    Copy
                                                </button>
                                            </li>
                                        )}
                                        <li className="ty-bank-row ty-copy-row">
                                            <span className="ty-bk-lbl">Order ID</span>
                                            <span className="ty-bk-val mono accent">{order.orderNumber}</span>
                                            <button className="ty-copy-btn-row" data-copy={order.orderNumber} aria-label="Copy order reference">
                                                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2" /><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" /></svg>
                                                Copy
                                            </button>
                                        </li>
                                    </ul>
                                    <div className="ty-memo-note">
                                        <Info size={13} />
                                        <span>Please paste this <strong>Order ID</strong> into your bank transfer&apos;s <strong>description</strong> field — it&apos;s how we match your payment to this order.</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ── Bank Transfer: Upload Receipt (inline) ── */}
                    {isBT && uploadStatus !== 'success' && (
                        <div className={`ty-block ty-block-compact${uploadStatus === 'empty' || uploadStatus === 'staged' ? ' ty-upload-required' : ''}`}>
                            <div className="ty-block-hd ty-block-hd-compact">
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

                            {/* Empty — dropzone */}
                            {(uploadStatus === 'empty') && (
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

                            {/* Staged — file selected */}
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

                            {uploadError && (
                                <p className="ty-upload-error">{uploadError}</p>
                            )}

                            <div className="ty-upload-actions">
                                {(uploadStatus === 'staged' || uploadStatus === 'uploading') && (
                                    <>
                                        <button className="ty-ul-btn ghost" onClick={resetUpload} disabled={uploadStatus === 'uploading'}>
                                            <RotateCcw size={13} /> Replace
                                        </button>
                                        <button className="ty-ul-btn primary" onClick={handleUpload} disabled={uploadStatus === 'uploading'} aria-busy={uploadStatus === 'uploading'}>
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
                                <span>A copy of your order details has been sent to <strong>{maskedEmail}</strong> for your records.</span>
                            </div>
                        </div>
                    )}

                    {/* ── Bank Transfer: Upload success state ── */}
                    {isBT && uploadStatus === 'success' && (
                        <div className="ty-block ty-block-compact">
                            <div className="ty-block-hd ty-block-hd-compact">
                                <span className="ty-block-num">02</span>
                                <div className="ty-block-titles"><h3>Upload Payment Receipt</h3></div>
                                <span className="ty-step-pill done"><Check size={11} /> Submitted</span>
                            </div>
                            <div className="ty-success-state">
                                <div className="ty-success-icon"><Check size={20} strokeWidth={3} /></div>
                                <div className="ty-success-text">
                                    <p className="ty-success-title">File uploaded successfully</p>
                                    <p className="ty-success-sub">We&apos;ll verify within 1–2 business hours and email you a confirmation.</p>
                                </div>
                            </div>
                            <div className="ty-upload-actions">
                                <button className="ty-ul-btn ghost" onClick={resetUpload}>
                                    <RotateCcw size={13} /> Upload a different file
                                </button>
                            </div>
                        </div>
                    )}

                    {/* ── Stripe: Payment Confirmed ── */}
                    {isStripe && (
                        <div className="ty-block">
                            <div className="ty-block-hd">
                                <div className="ty-block-titles">
                                    <h3>Payment &amp; Order Status</h3>
                                    <p>Payment captured — your order is now being prepared for shipment.</p>
                                </div>
                                <span className="ty-step-pill done"><Check size={11} /> Confirmed</span>
                            </div>
                            <div className="ty-paid-card">
                                <div className="ty-paid-icon"><Check size={22} strokeWidth={3} /></div>
                                <div className="ty-paid-body">
                                    <p className="ty-paid-title">Payment of <strong>{formatPrice(order.total, currency)}</strong> processed successfully.</p>
                                    <p className="ty-paid-sub">Funds settle to the seller within 1–2 business days.</p>
                                </div>
                                <div className="ty-paid-brands" aria-hidden="true">
                                    <span className="ty-brand visa">VISA</span>
                                    <span className="ty-brand mc"><span className="mc-c" /><span className="mc-c" /></span>
                                    <span className="ty-brand amex">AMEX</span>
                                    <span className="ty-brand fpx">FPX</span>
                                </div>
                            </div>
                            {order.stripePaymentIntentId && (
                                <ul className="ty-paid-meta">
                                    <li>
                                        <span className="ty-pm-lbl"><Hash size={12} /> Transaction ID</span>
                                        <span className="ty-pm-val mono">{order.stripePaymentIntentId}</span>
                                        <button className="ty-copy-btn-row" data-copy={order.stripePaymentIntentId} aria-label="Copy transaction ID">
                                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2" /><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" /></svg>
                                            Copy
                                        </button>
                                    </li>
                                </ul>
                            )}
                            <div className="ty-email-note">
                                <Mail size={14} />
                                <span>A receipt and tracking link will reach <strong>{maskedEmail}</strong> once your parcel is picked up.</span>
                            </div>
                        </div>
                    )}

                    {/* ── COD: Pay on Delivery ── */}
                    {isCod && (
                        <div className="ty-block">
                            <div className="ty-block-hd">
                                <div className="ty-block-titles">
                                    <h3>Pay on Delivery</h3>
                                    <p>Cash hand-off when the courier arrives — no app required.</p>
                                </div>
                                <span className="ty-step-pill blue">
                                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.99 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.9 1.17h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 8.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" /></svg>
                                    Pending verification
                                </span>
                            </div>
                            <div className="ty-cod-card">
                                <div className="ty-cod-icon"><Banknote size={26} /></div>
                                <div className="ty-cod-body">
                                    <p className="ty-cod-title">Please prepare exactly <strong>{formatPrice(order.total, currency)}</strong> in cash.</p>
                                    <p className="ty-cod-sub">You&apos;ll pay the courier rider when you receive your package. They cannot provide change for amounts above RM 200.</p>
                                </div>
                            </div>
                            <ul className="ty-cod-tips">
                                <li><Banknote size={14} /><span>Small notes preferred — couriers don&apos;t carry change.</span></li>
                                <li><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /><line x1="12" y1="22" x2="12" y2="12" /><path d="m3.3 7 8.7 5 8.7-5" /></svg><span>Two failed delivery attempts will auto-cancel the order.</span></li>
                            </ul>
                            <div className="ty-email-note">
                                <Mail size={14} />
                                <span>A full order summary has been sent to <strong>{maskedEmail}</strong> for your records.</span>
                            </div>
                        </div>
                    )}

                    {/* ── Order Items ── */}
                    <div className="ty-block">
                        <div className="ty-block-hd" style={{ marginBottom: 14 }}>
                            <div className="ty-block-titles">
                                <h3>Order Items</h3>
                                <p>{order.items.length} item{order.items.length !== 1 ? 's' : ''} in this order</p>
                            </div>
                        </div>
                        <ul className="ty-items">
                            {order.items.map((item, idx) => (
                                <li key={idx} className="ty-item">
                                    <div className="ty-item-th">
                                        {item.imageUrl
                                            // eslint-disable-next-line @next/next/no-img-element
                                            ? <img src={item.imageUrl} alt={item.productName} />
                                            : <ShoppingBag size={18} />}
                                    </div>
                                    <div className="ty-item-info">
                                        <div className="ty-item-top" data-tooltip={item.productName}>
                                            <p className="ty-item-nm">{item.productName}</p>
                                            <span className="ty-item-pr">{formatPrice(item.unitPrice * item.quantity, currency)}</span>
                                        </div>
                                        {item.variant && <p className="ty-item-var">{item.variant}</p>}
                                        <p className="ty-item-qty">Qty: {item.quantity} × {formatPrice(item.unitPrice, currency)}</p>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>

                {/* ── Summary ── */}
                <div className="ty-right">
                    <div className="sum-card">
                        <h3 className="sum-hd">Order Summary</h3>
                        <ul className="sum-items">
                            {order.items.map((item, idx) => (
                                <li key={idx} className="sum-item">
                                    <div className="s-th">
                                        {item.imageUrl
                                            // eslint-disable-next-line @next/next/no-img-element
                                            ? <img src={item.imageUrl} alt={item.productName} />
                                            : <ShoppingBag size={18} />}
                                    </div>
                                    <div className="s-info">
                                        <div className="s-top" data-tooltip={item.productName}>
                                            <p className="s-nm">{item.productName}</p>
                                            <span className="s-pr">{formatPrice(item.unitPrice * item.quantity, currency)}</span>
                                        </div>
                                        <p className="s-mt"><span className="s-qty">×{item.quantity}</span> {formatPrice(item.unitPrice, currency)}</p>
                                    </div>
                                </li>
                            ))}
                        </ul>
                        <div className="sum-row"><span className="sr-l">Subtotal</span><span className="sr-v">{formatPrice(order.subtotal, currency)}</span></div>
                        <div className="sum-row"><span className="sr-l">SST (6%)</span><span className="sr-v">{formatPrice(order.tax, currency)}</span></div>
                        <div className="sum-row"><span className="sr-l">Shipping</span><span className="sr-v">{formatPrice(shippingFee, currency)}</span></div>
                        <div className="sum-total">
                            <span className="st-l">Total</span>
                            <span className="st-v"><span className="st-ccy">{ccySymbol}</span>{order.total.toFixed(2)}</span>
                        </div>
                        <div className={`ty-sum-status tone-${sumStatus.tone}`}>
                            <span className="ty-dot" aria-hidden="true" />
                            <div>
                                <p className="ty-s1">{sumStatus.s1}</p>
                                <p className="ty-s2">{sumStatus.s2}</p>
                            </div>
                        </div>
                        <div className="ty-meta">
                            <div className="ty-mr"><Calendar size={13} /><span><strong>Placed</strong> · {placed}</span></div>
                            <div className="ty-mr"><Truck size={13} /><span><strong>Ships</strong> · {shipsText}</span></div>
                            {addrLine && <div className="ty-mr"><MapPin size={13} /><span><strong>To</strong> · {order.customerName}, {addrLine}</span></div>}
                        </div>
                        <div className="ty-ctas">
                            <Link href={`/sites/${slug}/products`} className="ty-cta primary">
                                <ShoppingBag size={15} /> Continue Shopping
                            </Link>
                            <Link href={`/sites/${slug}/orders/${order.id}`} className="ty-cta secondary">
                                <ReceiptText size={15} /> View My Orders
                            </Link>
                        </div>
                        <div className="sum-trust"><ShieldCheck size={11} /> Encrypted Checkout · Order Locked</div>
                    </div>
                </div>
            </div>

            <style>{TY_CSS}</style>
        </div>
    )
}
