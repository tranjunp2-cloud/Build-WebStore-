'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCartStore } from '@/store/cartStore'
import { trackEvent } from '@/lib/analytics/track-event'
import { ArrowLeft, Loader2, ShoppingBag, Upload, X, Banknote, QrCode, AlertCircle } from 'lucide-react'
import { useI18n } from '@/i18n'

function formatPrice(price: number, currency: string) {
    if (currency === 'MYR') return `RM ${price.toFixed(2)}`
    if (currency === 'SGD') return `S$${price.toFixed(2)}`
    return `$${price.toFixed(2)}`
}

type CheckoutForm = {
    name: string
    email: string
    phone: string
    line1: string
    line2: string
    city: string
    state: string
    postcode: string
}

const initialForm: CheckoutForm = {
    name: '', email: '', phone: '',
    line1: '', line2: '', city: '', state: '', postcode: '',
}

const MY_STATES = [
    'Johor', 'Kedah', 'Kelantan', 'Kuala Lumpur', 'Labuan', 'Melaka',
    'Negeri Sembilan', 'Pahang', 'Penang', 'Perak', 'Perlis',
    'Putrajaya', 'Sabah', 'Sarawak', 'Selangor', 'Terengganu',
]

const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/jpg']
const MAX_FILE_SIZE = 2 * 1024 * 1024 // 2MB

export default function CheckoutPage({ params }: { params: Promise<{ slug: string }> }) {
    const { t } = useI18n()
    const ck = t.storefront.checkout
    const [slug, setSlug] = useState('')
    const [siteId, setSiteId] = useState('')
    const [isOwner, setIsOwner] = useState(false)
    const { items, subtotal, clearCart } = useCartStore()

    const [merchantQrUrl, setMerchantQrUrl] = useState<string | null>(null)
    const [enableCod, setEnableCod] = useState(true)
    const [enableQrBanking, setEnableQrBanking] = useState(true)

    const [form, setForm] = useState<CheckoutForm>(initialForm)
    const [paymentMethod, setPaymentMethod] = useState<'cod' | 'qr_banking'>('cod')
    const [proofFile, setProofFile] = useState<File | null>(null)
    const [proofPreview, setProofPreview] = useState<string | null>(null)
    const [proofError, setProofError] = useState<string | null>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)

    const router = useRouter()

    const [isPlacing, setIsPlacing] = useState(false)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        params.then(p => setSlug(p.slug))
    }, [params])

    // Get siteId from slug using public storefront endpoint (avoids auth-gated /api/tenants)
    useEffect(() => {
        if (!slug) return
        async function fetchSite() {
            try {
                const res = await fetch(`/api/storefront/site-by-slug?slug=${encodeURIComponent(slug)}`)
                if (!res.ok) {
                    setError('Unable to load store. Please refresh.')
                    return
                }
                const data = await res.json()
                if (data.siteId) setSiteId(String(data.siteId))
                if (data.merchantQrCodeUrl) setMerchantQrUrl(data.merchantQrCodeUrl)
                if (data.enableCod === false) {
                    setEnableCod(false)
                    setPaymentMethod('qr_banking')
                }
                if (data.enableQrBanking === false) setEnableQrBanking(false)

                // Check if current user is tenant member (skip tracking for owners) — best-effort
                try {
                    const meRes = await fetch('/api/users/me')
                    if (meRes.ok) {
                        const meData = await meRes.json()
                        const userTenantIds = (meData.user?.tenants ?? []).map((t: { tenant: string | { id: string } }) =>
                            typeof t.tenant === 'object' ? String(t.tenant.id) : String(t.tenant)
                        )
                        setIsOwner(userTenantIds.includes(String(data.tenantId)))
                    }
                } catch { }
            } catch { }
        }
        fetchSite()
    }, [slug])

    const currency = items[0]?.currency || 'MYR'
    const sub = subtotal()
    const shippingFee = sub > 0 ? 10 : 0 // Flat RM10 shipping
    const tax = Math.round(sub * 0.06 * 100) / 100
    const total = sub + shippingFee + tax

    const updateField = (field: keyof CheckoutForm, value: string) => {
        setForm(prev => ({ ...prev, [field]: value }))
    }

    // Payment proof upload handler
    const handleProofUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        setProofError(null)

        if (!file) return

        if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
            setProofError(ck.invalidImage)
            setProofFile(null)
            setProofPreview(null)
            return
        }

        if (file.size > MAX_FILE_SIZE) {
            setProofError(ck.fileTooLarge)
            setProofFile(null)
            setProofPreview(null)
            return
        }

        setProofFile(file)
        const reader = new FileReader()
        reader.onloadend = () => setProofPreview(reader.result as string)
        reader.readAsDataURL(file)
    }

    const removeProof = () => {
        setProofFile(null)
        setProofPreview(null)
        setProofError(null)
        if (fileInputRef.current) fileInputRef.current.value = ''
    }

    // Can place order?
    const canPlaceOrder =
        siteId !== '' &&
        form.name.trim() && form.email.trim() &&
        items.length > 0 &&
        (paymentMethod === 'cod' || (paymentMethod === 'qr_banking' && proofFile))

    const handlePlaceOrder = async () => {
        if (!canPlaceOrder) return

        setIsPlacing(true)
        setError(null)

        try {
            // Step 1: Upload proof image if QR Banking
            let paymentProofImageId: string | undefined
            if (paymentMethod === 'qr_banking' && proofFile) {
                const formData = new FormData()
                formData.append('file', proofFile)
                formData.append('alt', `Payment proof - ${form.name}`)

                const uploadRes = await fetch('/api/media', {
                    method: 'POST',
                    body: formData,
                })
                if (!uploadRes.ok) {
                    throw new Error(ck.uploadFailed)
                }
                const uploadData = await uploadRes.json()
                paymentProofImageId = uploadData.doc?.id
            }

            // Step 2: Create order
            const payload: Record<string, unknown> = {
                siteId,
                items: items.map(i => ({ productId: i.productId, quantity: i.quantity })),
                customer: {
                    name: form.name,
                    email: form.email,
                    phone: form.phone,
                    address: {
                        line1: form.line1,
                        line2: form.line2,
                        city: form.city,
                        state: form.state,
                        postcode: form.postcode,
                        country: 'Malaysia',
                    },
                },
                paymentMethod,
            }

            if (paymentProofImageId) {
                payload.paymentProofImage = paymentProofImageId
            }

            const res = await fetch('/api/orders/checkout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            })

            const data = await res.json()

            if (res.ok && data.success) {
                clearCart()
                if (siteId) {
                    trackEvent({
                        siteId,
                        event: 'purchase',
                        isOwner,
                        metadata: {
                            orderNumber: data.data.orderNumber,
                            total: data.data.total,
                            currency: data.data.currency,
                            itemCount: items.length,
                        },
                    })
                }
                router.push(`/sites/${slug}/order/${data.data.orderId}/confirm`)
            } else {
                // AC-2: Cart preserved on error
                setError(data.error?.message || 'Failed to place order')
            }
        } catch (err: unknown) {
            // AC-2: Cart preserved on error
            setError(err instanceof Error ? err.message : ck.networkError)
        } finally {
            setIsPlacing(false)
        }
    }

    // ─── Empty Cart ────────────────────────────────────────────
    if (items.length === 0 && !isPlacing) {
        return (
            <div style={{
                fontFamily: 'Inter, sans-serif', minHeight: '100vh',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: '24px',
            }}>
                <div style={{ textAlign: 'center' }}>
                    <ShoppingBag size={48} style={{ opacity: 0.2, margin: '0 auto 16px' }} />
                    <h2 style={{ fontSize: '20px', fontWeight: 600 }}>{ck.cartEmpty}</h2>
                    <Link href={`/sites/${slug}/products`}
                        style={{ color: '#0ea5e9', fontSize: '14px', marginTop: '8px', display: 'inline-block' }}>
                        {ck.browseProducts}
                    </Link>
                </div>
            </div>
        )
    }

    // ─── Shared Styles ─────────────────────────────────────────
    const inputStyle: React.CSSProperties = {
        width: '100%', padding: '12px 16px', borderRadius: '10px',
        border: '1px solid #e5e7eb', fontSize: '14px', outline: 'none',
        boxSizing: 'border-box',
    }

    return (
        <div style={{ fontFamily: 'Inter, sans-serif', minHeight: '100vh', background: '#fafafa' }}>
            {/* Nav */}
            <nav style={{ padding: '16px 24px', borderBottom: '1px solid #eee', background: 'white' }}>
                <Link href={`/sites/${slug}/products`} style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    color: '#666', textDecoration: 'none', fontSize: '14px',
                }}>
                    <ArrowLeft size={16} /> {ck.backToProducts}
                </Link>
            </nav>

            <div className="checkout-layout" style={{
                display: 'grid', gap: '32px', maxWidth: '1100px', margin: '0 auto',
                padding: '32px 24px',
            }}>
                {/* ─── Left: Form ──────────────────────────────────── */}
                <div style={{ minWidth: 0 }}>
                    <h1 style={{ fontSize: '24px', fontWeight: 700, margin: '0 0 32px' }}>{ck.title}</h1>

                    {/* Error Banner */}
                    {error && (
                        <div style={{
                            background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '12px',
                            padding: '14px 16px', fontSize: '13px', color: '#dc2626', marginBottom: '24px',
                            display: 'flex', alignItems: 'center', gap: '10px',
                        }}>
                            <AlertCircle size={16} style={{ flexShrink: 0 }} />
                            <span>{error}</span>
                        </div>
                    )}

                    {/* Contact */}
                    <section style={{ marginBottom: '32px' }}>
                        <h2 style={{ fontSize: '16px', fontWeight: 600, margin: '0 0 16px' }}>{ck.contactInfo}</h2>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <input placeholder={ck.fullName} value={form.name}
                                onChange={e => updateField('name', e.target.value)} style={inputStyle} />
                            <input type="email" placeholder={ck.emailAddress} value={form.email}
                                onChange={e => updateField('email', e.target.value)} style={inputStyle} />
                            <input placeholder={ck.phone} value={form.phone}
                                onChange={e => updateField('phone', e.target.value)} style={inputStyle} />
                        </div>
                    </section>

                    {/* Shipping */}
                    <section style={{ marginBottom: '32px' }}>
                        <h2 style={{ fontSize: '16px', fontWeight: 600, margin: '0 0 16px' }}>{ck.shippingAddress}</h2>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <input placeholder={ck.addressLine1} value={form.line1}
                                onChange={e => updateField('line1', e.target.value)} style={inputStyle} />
                            <input placeholder={ck.addressLine2} value={form.line2}
                                onChange={e => updateField('line2', e.target.value)} style={inputStyle} />
                            <div className="checkout-grid-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                <input placeholder={ck.city} value={form.city}
                                    onChange={e => updateField('city', e.target.value)} style={inputStyle} />
                                <select value={form.state}
                                    onChange={e => updateField('state', e.target.value)}
                                    style={{ ...inputStyle, color: form.state ? '#111' : '#9ca3af' }}>
                                    <option value="">{ck.state}</option>
                                    {MY_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>
                            <input placeholder={ck.postcode} value={form.postcode}
                                onChange={e => updateField('postcode', e.target.value)}
                                style={{ ...inputStyle, maxWidth: '200px' }} />
                        </div>
                    </section>

                    {/* ─── Payment Method ───────────────────────── */}
                    <section style={{ marginBottom: '32px' }}>
                        <h2 style={{ fontSize: '16px', fontWeight: 600, margin: '0 0 16px' }}>{ck.paymentMethod}</h2>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {/* COD Option */}
                            {enableCod && (
                                <label
                                    onClick={() => setPaymentMethod('cod')}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: '14px',
                                        padding: '16px 20px', borderRadius: '12px', cursor: 'pointer',
                                        border: `2px solid ${paymentMethod === 'cod' ? '#111' : '#e5e7eb'}`,
                                        background: paymentMethod === 'cod' ? '#f8fafc' : 'white',
                                        transition: 'all 0.15s',
                                    }}>
                                    <div style={{
                                        width: '20px', height: '20px', borderRadius: '50%',
                                        border: `2px solid ${paymentMethod === 'cod' ? '#111' : '#ccc'}`,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                                    }}>
                                        {paymentMethod === 'cod' && <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#111' }} />}
                                    </div>
                                    <Banknote size={20} color="#666" />
                                    <div>
                                        <p style={{ fontSize: '14px', fontWeight: 600, margin: 0 }}>{ck.cod}</p>
                                        <p style={{ fontSize: '12px', color: '#999', margin: '2px 0 0' }}>{ck.codDesc}</p>
                                    </div>
                                </label>
                            )}

                            {/* QR Banking Option */}
                            {enableQrBanking && (
                                <label
                                    onClick={() => setPaymentMethod('qr_banking')}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: '14px',
                                        padding: '16px 20px', borderRadius: '12px', cursor: 'pointer',
                                        border: `2px solid ${paymentMethod === 'qr_banking' ? '#111' : '#e5e7eb'}`,
                                        background: paymentMethod === 'qr_banking' ? '#f8fafc' : 'white',
                                        transition: 'all 0.15s',
                                    }}>
                                    <div style={{
                                        width: '20px', height: '20px', borderRadius: '50%',
                                        border: `2px solid ${paymentMethod === 'qr_banking' ? '#111' : '#ccc'}`,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                                    }}>
                                        {paymentMethod === 'qr_banking' && <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#111' }} />}
                                    </div>
                                    <QrCode size={20} color="#666" />
                                    <div>
                                        <p style={{ fontSize: '14px', fontWeight: 600, margin: 0 }}>{ck.qrBanking}</p>
                                        <p style={{ fontSize: '12px', color: '#999', margin: '2px 0 0' }}>{ck.qrBankingDesc}</p>
                                    </div>
                                </label>
                            )}
                        </div>

                        {/* QR Banking Details */}
                        {paymentMethod === 'qr_banking' && (
                            <div style={{
                                marginTop: '20px', padding: '24px', borderRadius: '16px',
                                background: 'white', border: '1px solid #e5e7eb',
                            }}>
                                {/* Merchant QR Code */}
                                <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                                    <p style={{ fontSize: '14px', fontWeight: 600, margin: '0 0 16px' }}>
                                        {ck.scanToPay}
                                    </p>
                                    {merchantQrUrl ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img src={merchantQrUrl} alt="Merchant QR Code"
                                            style={{ width: '200px', height: '200px', objectFit: 'contain', borderRadius: '12px', border: '1px solid #e5e7eb', display: 'block', margin: '0 auto' }} />
                                    ) : (
                                        <div style={{
                                            width: '200px', height: '200px', margin: '0 auto',
                                            borderRadius: '16px', background: '#f8fafc',
                                            border: '2px dashed #d1d5db',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            flexDirection: 'column', gap: '8px',
                                        }}>
                                            <QrCode size={48} color="#9ca3af" />
                                            <p style={{ fontSize: '11px', color: '#999', margin: 0 }}>{ck.merchantQr}</p>
                                        </div>
                                    )}
                                    <p style={{ fontSize: '12px', color: '#999', margin: '12px 0 0' }}>
                                        {ck.amount} <strong>{formatPrice(total, currency)}</strong>
                                    </p>
                                </div>

                                {/* Upload Proof */}
                                <div>
                                    <p style={{ fontSize: '14px', fontWeight: 600, margin: '0 0 12px' }}>
                                        {ck.uploadProof} <span style={{ color: '#ef4444' }}>*</span>
                                    </p>

                                    {proofPreview ? (
                                        <div style={{ position: 'relative', display: 'inline-block' }}>
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img src={proofPreview} alt="Payment proof"
                                                style={{
                                                    maxWidth: '100%', maxHeight: '200px', borderRadius: '12px',
                                                    border: '1px solid #e5e7eb',
                                                }} />
                                            <button onClick={removeProof}
                                                style={{
                                                    position: 'absolute', top: '-8px', right: '-8px',
                                                    width: '24px', height: '24px', borderRadius: '50%',
                                                    background: '#ef4444', color: 'white', border: 'none',
                                                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                }}>
                                                <X size={14} />
                                            </button>
                                        </div>
                                    ) : (
                                        <div
                                            onClick={() => fileInputRef.current?.click()}
                                            style={{
                                                padding: '32px', borderRadius: '12px', textAlign: 'center',
                                                border: '2px dashed #d1d5db', cursor: 'pointer',
                                                background: '#fafafa', transition: 'border-color 0.15s',
                                            }}
                                            onMouseEnter={e => (e.currentTarget.style.borderColor = '#9ca3af')}
                                            onMouseLeave={e => (e.currentTarget.style.borderColor = '#d1d5db')}
                                        >
                                            <Upload size={24} color="#9ca3af" style={{ margin: '0 auto 8px' }} />
                                            <p style={{ fontSize: '13px', color: '#666', margin: '0 0 4px' }}>
                                                {ck.clickToUpload}
                                            </p>
                                            <p style={{ fontSize: '11px', color: '#999', margin: 0 }}>
                                                {ck.uploadHint}
                                            </p>
                                        </div>
                                    )}

                                    <input ref={fileInputRef} type="file" accept="image/jpeg,image/png"
                                        onChange={handleProofUpload} style={{ display: 'none' }} />

                                    {proofError && (
                                        <p style={{ fontSize: '12px', color: '#ef4444', margin: '8px 0 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <AlertCircle size={14} /> {proofError}
                                        </p>
                                    )}
                                </div>
                            </div>
                        )}
                    </section>

                    {/* Place Order Button */}
                    <button onClick={handlePlaceOrder}
                        disabled={isPlacing || !canPlaceOrder}
                        style={{
                            width: '100%', padding: '16px', background: canPlaceOrder ? '#111' : '#d1d5db',
                            color: 'white', borderRadius: '12px', border: 'none', fontSize: '16px', fontWeight: 600,
                            cursor: canPlaceOrder ? 'pointer' : 'not-allowed',
                            opacity: isPlacing ? 0.7 : 1,
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                            transition: 'all 0.15s',
                        }}>
                        {isPlacing ? (
                            <><Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> {ck.placingOrder}</>
                        ) : (
                            <>{ck.placeOrder}{formatPrice(total, currency)}</>
                        )}
                    </button>

                    {paymentMethod === 'qr_banking' && !proofFile && (
                        <p style={{ fontSize: '12px', color: '#f59e0b', textAlign: 'center', margin: '8px 0 0' }}>
                            {ck.uploadRequired}
                        </p>
                    )}
                </div>

                {/* ─── Right: Order Summary ─────────────────────── */}
                <div className="checkout-summary" style={{
                    background: 'white', borderRadius: '16px', padding: '24px',
                    border: '1px solid #eee', height: 'fit-content', position: 'sticky', top: '24px',
                }}>
                    <h2 style={{ fontSize: '16px', fontWeight: 600, margin: '0 0 20px' }}>{ck.orderSummary}</h2>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
                        {items.map(item => (
                            <div key={item.productId} style={{
                                display: 'flex', gap: '12px', alignItems: 'center',
                            }}>
                                {/* Thumbnail */}
                                <div style={{
                                    width: '48px', height: '48px', borderRadius: '8px',
                                    background: '#f8f8f8', flexShrink: 0, overflow: 'hidden',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                }}>
                                    {item.imageUrl ? (
                                        <>
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img src={item.imageUrl} alt={item.name}
                                                style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                        </>
                                    ) : (
                                        <span style={{ fontSize: '16px', opacity: 0.2 }}>📦</span>
                                    )}
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <p style={{ fontSize: '13px', fontWeight: 500, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {item.name}
                                    </p>
                                    <p style={{ fontSize: '12px', color: '#999', margin: '2px 0 0' }}>
                                        {t.storefront.cart.qty} {item.quantity}
                                    </p>
                                </div>
                                <span style={{ fontSize: '14px', fontWeight: 600, flexShrink: 0 }}>
                                    {formatPrice(item.price * item.quantity, item.currency)}
                                </span>
                            </div>
                        ))}
                    </div>

                    <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: '16px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', marginBottom: '8px' }}>
                            <span style={{ color: '#666' }}>{ck.subtotal}</span>
                            <span>{formatPrice(sub, currency)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', marginBottom: '8px' }}>
                            <span style={{ color: '#666' }}>{ck.shipping}</span>
                            <span>{shippingFee > 0 ? formatPrice(shippingFee, currency) : ck.free}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', marginBottom: '8px' }}>
                            <span style={{ color: '#666' }}>{ck.sst}</span>
                            <span>{formatPrice(tax, currency)}</span>
                        </div>
                        <div style={{
                            display: 'flex', justifyContent: 'space-between',
                            fontSize: '18px', fontWeight: 700, paddingTop: '12px', borderTop: '1px solid #f0f0f0',
                        }}>
                            <span>{ck.total}</span>
                            <span>{formatPrice(total, currency)}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* ─── Responsive CSS ──────────────────────────────── */}
            <style>{`
                .checkout-layout {
                    grid-template-columns: 1fr 380px;
                }
                @media (max-width: 768px) {
                    .checkout-layout {
                        grid-template-columns: 1fr !important;
                    }
                    .checkout-summary {
                        position: static !important;
                        order: -1;
                    }
                    .checkout-grid-2col {
                        grid-template-columns: 1fr !important;
                    }
                }
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    )
}
