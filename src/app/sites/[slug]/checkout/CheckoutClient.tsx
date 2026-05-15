'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCartStore } from '@/store/cartStore'
import { trackEvent } from '@/lib/analytics/track-event'
import {
    ArrowLeft, Loader2, ShoppingBag, X, AlertCircle,
    ShieldCheck, ChevronRight, Rocket, MapPin, Truck,
    QrCode, UploadCloud, FileImage, Tag, Info, Lock, AlertTriangle,
} from 'lucide-react'
import { useI18n } from '@/i18n'
import { resolveTheme, generateThemeCSS } from '@/lib/theme/resolve'
import { GoogleFontsLoader } from '@/components/site-renderer/GoogleFontsLoader'
import { type CheckoutForm, validateEmail, validatePhone } from '@/lib/storefront'

type GeoState = { id: number; name: string; state_code: string; zone: string }
type GeoDistrict = { id: number; name: string }

type InitialSiteData = {
    siteId: string
    tenantId: string
    merchantQrCodeUrl: string | null
    enableCod: boolean
    enableQrBanking: boolean
}

type CheckoutClientProps = {
    slug: string
    initialThemeCSS: string
    initialFontHeading: string
    initialFontBody: string
    initialSiteData: InitialSiteData | null
}

function formatPrice(price: number, currency: string) {
    if (currency === 'MYR') return `RM ${price.toFixed(2)}`
    if (currency === 'SGD') return `S$${price.toFixed(2)}`
    return `$${price.toFixed(2)}`
}

const initialForm: CheckoutForm = {
    name: '', email: '', phone: '', line1: '', line2: '', city: '', state: '', postcode: '',
}
const SHIPPING_EAST = 15
const SHIPPING_WEST = 8
const FREE_SHIPPING_THRESHOLD = 150

const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/jpg']
const MAX_FILE_SIZE = 2 * 1024 * 1024

export function CheckoutClient({ slug, initialThemeCSS, initialFontHeading, initialFontBody, initialSiteData }: CheckoutClientProps) {
    const { t } = useI18n()
    const ck = t.storefront.checkout
    const [siteId, setSiteId] = useState(initialSiteData?.siteId ?? '')
    const [isOwner, setIsOwner] = useState(false)
    const { items, subtotal, clearCart } = useCartStore()

    const [merchantQrUrl, setMerchantQrUrl] = useState<string | null>(initialSiteData?.merchantQrCodeUrl ?? null)
    const [enableCod, setEnableCod] = useState(initialSiteData?.enableCod ?? true)
    const [enableQrBanking, setEnableQrBanking] = useState(initialSiteData?.enableQrBanking ?? true)
    const [showStripe, setShowStripe] = useState(false)

    const [form, setForm] = useState<CheckoutForm>(initialForm)
    const [states, setStates] = useState<GeoState[]>([])
    const [statesLoading, setStatesLoading] = useState(true)
    const [selectedStateId, setSelectedStateId] = useState('')
    const [districts, setDistricts] = useState<GeoDistrict[]>([])
    const [districtsLoading, setDistrictsLoading] = useState(false)
    const [selectedDistrictId, setSelectedDistrictId] = useState('')
    const [postcodeOpts, setPostcodeOpts] = useState<string[]>([])
    const [postcodesLoading, setPostcodesLoading] = useState(false)
    const [paymentMethod, setPaymentMethod] = useState<'cod' | 'qr_banking'>('cod')
    const [proofFile, setProofFile] = useState<File | null>(null)
    const [proofPreview, setProofPreview] = useState<string | null>(null)
    const [proofError, setProofError] = useState<string | null>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)

    const router = useRouter()
    const [isPlacing, setIsPlacing] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [fieldErrors, setFieldErrors] = useState<{ email?: string; phone?: string }>({})
    const [themeCSS, setThemeCSS] = useState(initialThemeCSS)
    const [fontHeading, setFontHeading] = useState(initialFontHeading)
    const [fontBody, setFontBody] = useState(initialFontBody)

    useEffect(() => {
        fetch('/api/geo/states')
            .then(r => r.json())
            .then(data => setStates(Array.isArray(data) ? data : []))
            .catch(() => {})
            .finally(() => setStatesLoading(false))
    }, [])

    useEffect(() => {
        if (!slug) return

        const checkOwner = async (tenantId: string) => {
            try {
                const meRes = await fetch('/api/users/me')
                if (meRes.ok) {
                    const meData = await meRes.json()
                    const tenantIds = (meData.user?.tenants ?? []).map(
                        (tnt: { tenant: string | { id: string } }) =>
                            typeof tnt.tenant === 'object' ? String(tnt.tenant.id) : String(tnt.tenant)
                    )
                    setIsOwner(tenantIds.includes(tenantId))
                }
            } catch { }
        }

        if (initialSiteData) {
            // Theme + site data already resolved server-side — only check owner
            checkOwner(initialSiteData.tenantId)
            return
        }

        // Fallback: fetch site data client-side (e.g. no server data available)
        async function fetchSite() {
            try {
                const res = await fetch(`/api/storefront/site-by-slug?slug=${encodeURIComponent(slug)}`)
                if (!res.ok) { setError('Unable to load store. Please refresh.'); return }
                const data = await res.json()
                if (data.siteId) setSiteId(String(data.siteId))
                if (data.merchantQrCodeUrl) setMerchantQrUrl(data.merchantQrCodeUrl)
                if (data.enableCod === false) { setEnableCod(false); setPaymentMethod('qr_banking') }
                if (data.enableQrBanking === false) setEnableQrBanking(false)
                if (data.enableStripe === true) setShowStripe(true)
                if (data.theme) {
                    if (data.theme.fontHeading) setFontHeading(data.theme.fontHeading)
                    if (data.theme.fontBody) setFontBody(data.theme.fontBody)
                    const resolved = resolveTheme({
                        primaryColor: data.theme.primaryColor,
                        secondaryColor: data.theme.secondaryColor,
                        accentColor: data.theme.accentColor,
                        surfaceColor: data.theme.surfaceColor,
                        textColor: data.theme.textColor,
                        mutedColor: data.theme.mutedColor,
                        fontPairingId: data.theme.fontPairingId,
                        fontHeading: data.theme.fontHeading,
                        fontBody: data.theme.fontBody,
                        colorMode: data.theme.colorMode,
                        backgroundColor: data.theme.backgroundColor,
                    })
                    setThemeCSS(generateThemeCSS(resolved))
                }
                checkOwner(String(data.tenantId))
            } catch { }
        }
        fetchSite()
    }, [slug, initialSiteData])

    const currency = items[0]?.currency || 'MYR'
    const sub = subtotal()
    const selectedState = states.find(s => s.id === Number(selectedStateId))
    const shippingFee = sub > 0 ? (selectedState?.zone === 'east' ? SHIPPING_EAST : SHIPPING_WEST) : 0
    const tax = Math.round(sub * 0.06 * 100) / 100
    const total = sub + shippingFee + tax

    const updateField = (field: keyof CheckoutForm, value: string) => {
        setForm(prev => ({ ...prev, [field]: value }))
        if (field === 'email' || field === 'phone') {
            setFieldErrors(prev => ({ ...prev, [field]: undefined }))
        }
    }

    const handleEmailBlur = () => {
        const err = validateEmail(form.email)
        if (err) setFieldErrors(prev => ({ ...prev, email: err }))
    }

    const handlePhoneBlur = () => {
        const err = validatePhone(form.phone)
        if (err) setFieldErrors(prev => ({ ...prev, phone: err }))
    }

    const handleStateChange = (stateId: string) => {
        setSelectedStateId(stateId)
        const st = states.find(s => s.id === Number(stateId))
        updateField('state', st?.name || '')
        updateField('city', '')
        updateField('postcode', '')
        setSelectedDistrictId('')
        setDistricts([])
        setPostcodeOpts([])
        if (!stateId) return
        setDistrictsLoading(true)
        fetch(`/api/geo/districts?stateId=${stateId}`)
            .then(r => r.json())
            .then(data => setDistricts(Array.isArray(data) ? data : []))
            .catch(() => {})
            .finally(() => setDistrictsLoading(false))
    }

    const handleDistrictChange = (districtId: string) => {
        setSelectedDistrictId(districtId)
        const d = districts.find(dist => dist.id === Number(districtId))
        updateField('city', d?.name || '')
        updateField('postcode', '')
        setPostcodeOpts([])
        if (!districtId) return
        setPostcodesLoading(true)
        fetch(`/api/geo/postcodes?districtId=${districtId}`)
            .then(r => r.json())
            .then(data => setPostcodeOpts(Array.isArray(data) ? data : []))
            .catch(() => {})
            .finally(() => setPostcodesLoading(false))
    }

    const handleProofUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        setProofError(null)
        if (!file) return
        if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
            setProofError(ck.invalidImage); setProofFile(null); setProofPreview(null); return
        }
        if (file.size > MAX_FILE_SIZE) {
            setProofError(ck.fileTooLarge); setProofFile(null); setProofPreview(null); return
        }
        setProofFile(file)
        const reader = new FileReader()
        reader.onloadend = () => setProofPreview(reader.result as string)
        reader.readAsDataURL(file)
    }

    const removeProof = () => {
        setProofFile(null); setProofPreview(null); setProofError(null)
        if (fileInputRef.current) fileInputRef.current.value = ''
    }

    const canPlaceOrder = Boolean(
        siteId && form.name.trim() && form.email.trim() &&
        form.city && form.postcode && items.length > 0 &&
        (paymentMethod === 'cod' || (paymentMethod === 'qr_banking' && proofFile))
    )

    const handlePlaceOrder = async () => {
        if (!canPlaceOrder) return
        setIsPlacing(true); setError(null)
        try {
            let paymentProofImageId: string | undefined
            if (paymentMethod === 'qr_banking' && proofFile) {
                const fd = new FormData()
                fd.append('file', proofFile)
                fd.append('alt', `Payment proof - ${form.name}`)
                const uploadRes = await fetch('/api/media', { method: 'POST', body: fd })
                if (!uploadRes.ok) throw new Error(ck.uploadFailed)
                const uploadData = await uploadRes.json()
                paymentProofImageId = uploadData.doc?.id
            }
            const payload: Record<string, unknown> = {
                siteId,
                items: items.map(i => ({ productId: i.productId, quantity: i.quantity })),
                customer: {
                    name: form.name, email: form.email, phone: form.phone,
                    address: { line1: form.line1, line2: form.line2, city: form.city, state: form.state, postcode: form.postcode, country: 'Malaysia' },
                },
                paymentMethod,
            }
            if (paymentProofImageId) payload.paymentProofImage = paymentProofImageId

            const res = await fetch('/api/orders/checkout', {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
            })
            const data = await res.json()

            if (res.ok && data.success) {
                clearCart()
                if (siteId) {
                    trackEvent({ siteId, event: 'purchase', isOwner, metadata: {
                        orderNumber: data.data.orderNumber, total: data.data.total,
                        currency: data.data.currency, itemCount: items.length,
                    }})
                }
                router.push(`/sites/${slug}/order/${data.data.orderId}/confirm`)
            } else {
                setError(data.error?.message || 'Failed to place order')
            }
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : ck.networkError)
        } finally {
            setIsPlacing(false)
        }
    }

    if (items.length === 0 && !isPlacing) {
        return (
            <div className="ck-empty">
                <ShoppingBag size={48} />
                <h2>{ck.cartEmpty}</h2>
                <Link href={`/sites/${slug}/products`}>{ck.browseProducts}</Link>
                <style>{`
                  .ck-empty{font-family:var(--bf);min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;text-align:center;padding:24px;background:#eff1f3;}
                  .ck-empty svg{opacity:.2;}
                  .ck-empty h2{font-size:20px;font-weight:600;margin:0;color:#0c1014;}
                  .ck-empty a{color:var(--accent,#0e7556);font-size:14px;text-decoration:none;}
                `}</style>
            </div>
        )
    }

    const PlaceOrderBtn = (
        <button
            className={`po-btn${!canPlaceOrder ? ' dis' : ''}`}
            onClick={handlePlaceOrder}
            disabled={isPlacing || !canPlaceOrder}
        >
            {isPlacing
                ? <><Loader2 size={16} className="spin" /> {ck.placingOrder}</>
                : <><Rocket size={16} /> {ck.placeOrder}</>}
        </button>
    )

    return (
        <>
            <GoogleFontsLoader fontHeading={fontHeading} fontBody={fontBody} />
            {themeCSS && <style dangerouslySetInnerHTML={{ __html: themeCSS }} />}
            <div className="ck-page">

                {/* ── Header ───────────────────────────────── */}
                <header className="ck-hd">
                    <Link href={`/sites/${slug}/products`} className="ck-back">
                        <ArrowLeft size={16} />
                    </Link>
                    <h1 className="ck-h1">Checkout</h1>
                    <div className="ck-crumbs">
                        <span>Cart</span><ChevronRight size={12} />
                        <strong>Checkout</strong><ChevronRight size={12} />
                        <span>Confirmation</span>
                        <span className="ck-ssl"><ShieldCheck size={11} /> SSL Secure</span>
                    </div>
                </header>

                <div className="ck-shell">

                    {/* ── Form column ──────────────────────── */}
                    <div className="ck-form">
                        {error && (
                            <div className="ck-err">
                                <AlertCircle size={15} style={{ flexShrink: 0 }} /> <span>{error}</span>
                            </div>
                        )}

                        {/* 01 Contact */}
                        <div className="ck-card">
                            <div className="ck-ch">
                                <span className="ck-num">01</span>
                                <h2 className="ck-ct">{ck.contactInfo}</h2>
                            </div>
                            <div className="ck-f">
                                <label className="ck-lb">{ck.fullName}</label>
                                <div className="ck-iw"><input value={form.name} onChange={e => updateField('name', e.target.value)} placeholder="e.g. Ahmad bin Ibrahim" /></div>
                            </div>
                            <div className="ck-row c2">
                                <div className="ck-f">
                                    <label className="ck-lb">{ck.emailAddress}</label>
                                    <div className={`ck-iw${fieldErrors.email ? ' err' : ''}`}>
                                        <input type="email" value={form.email} onChange={e => updateField('email', e.target.value)} onBlur={handleEmailBlur} placeholder="ahmad@email.com" />
                                    </div>
                                    <p className="ck-ferr">{fieldErrors.email ?? ''}</p>
                                </div>
                                <div className="ck-f">
                                    <label className="ck-lb">{ck.phone} (+60)</label>
                                    <div className={`ck-iw${fieldErrors.phone ? ' err' : ''}`}>
                                        <input type="tel" value={form.phone} onChange={e => updateField('phone', e.target.value)} onBlur={handlePhoneBlur} placeholder="+60 12 345 6789" />
                                    </div>
                                    <p className="ck-ferr">{fieldErrors.phone ?? ''}</p>
                                </div>
                            </div>
                        </div>

                        {/* 02 Shipping */}
                        <div className="ck-card">
                            <div className="ck-ch">
                                <span className="ck-num">02</span>
                                <h2 className="ck-ct">{ck.shippingAddress}</h2>
                                <span className="ck-aux"><Truck size={12} /> {selectedState?.zone === 'east' ? 'East Malaysia' : 'West Malaysia'}</span>
                            </div>
                            <div className="ck-f">
                                <label className="ck-lb">{ck.addressLine1}</label>
                                <div className="ck-iw"><input value={form.line1} onChange={e => updateField('line1', e.target.value)} placeholder="No. 17, Jalan Kenari 22..." /></div>
                            </div>
                            <div className="ck-f">
                                <label className="ck-lb">{ck.addressLine2} <span className="ck-opt">(Optional)</span></label>
                                <div className="ck-iw"><input value={form.line2} onChange={e => updateField('line2', e.target.value)} placeholder="Apartment, suite, unit..." /></div>
                            </div>
                            <div className="ck-row c3">
                                <div className="ck-f">
                                    <label className="ck-lb">{ck.state}</label>
                                    <div className="ck-iw ck-sel">
                                        <select value={selectedStateId} onChange={e => handleStateChange(e.target.value)} disabled={statesLoading}>
                                            <option value="">{statesLoading ? 'Loading…' : '— Select State —'}</option>
                                            {states.map(s => <option key={s.id} value={String(s.id)}>{s.name}</option>)}
                                        </select>
                                    </div>
                                </div>
                                <div className="ck-f">
                                    <label className="ck-lb">{ck.city}</label>
                                    <div className="ck-iw ck-sel">
                                        <select value={selectedDistrictId} onChange={e => handleDistrictChange(e.target.value)} disabled={!selectedStateId || districtsLoading}>
                                            <option value="">{districtsLoading ? 'Loading…' : '— Select City —'}</option>
                                            {districts.map(d => <option key={d.id} value={String(d.id)}>{d.name}</option>)}
                                        </select>
                                    </div>
                                </div>
                                <div className="ck-f">
                                    <label className="ck-lb">{ck.postcode}</label>
                                    <div className="ck-iw ck-sel">
                                        <select value={form.postcode} onChange={e => updateField('postcode', e.target.value)} disabled={!selectedDistrictId || postcodesLoading}>
                                            <option value="">{postcodesLoading ? 'Loading…' : '— Select —'}</option>
                                            {postcodeOpts.map(p => <option key={p} value={p}>{p}</option>)}
                                        </select>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* 03 Payment */}
                        <div className="ck-card">
                            <div className="ck-ch">
                                <span className="ck-num">03</span>
                                <h2 className="ck-ct">{ck.paymentMethod}</h2>
                                <span className="ck-aux"><ShieldCheck size={12} /> Encrypted</span>
                            </div>
                            <div className="pm-list">
                                {showStripe && (
                                    <div className="pm pm-stripe locked">
                                        <div className="pm-row">
                                            <div className="pm-rad locked-rad" />
                                            <div className="pm-body">
                                                <h3 className="pm-title">
                                                    Pay with Stripe
                                                    <span className="pm-lock-glyph"><Lock size={10} /> Under maintenance</span>
                                                </h3>
                                                <p className="pm-desc">Card · FPX Online Banking · Secure hosted checkout</p>
                                                <div className="pm-brands">
                                                    <span className="pm-brand visa">VISA</span>
                                                    <span className="pm-brand mc"><span className="mc-c"><span /><span /></span></span>
                                                    <span className="pm-brand amex">AMEX</span>
                                                    <span className="pm-brand fpx">FPX</span>
                                                </div>
                                                <div className="pm-pills">
                                                    <span className="pm-pill amber"><AlertTriangle size={11} /> Temporarily unavailable</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="pm-tooltip tip-right">
                                            <div className="pt-head"><AlertTriangle size={12} /><span>Payment method unavailable</span></div>
                                            <p>Phương thức này chưa sẵn sàng. Vui lòng chọn phương thức khác.</p>
                                            <span className="pt-cta">Choose another method <ChevronRight size={11} /></span>
                                        </div>
                                    </div>
                                )}
                                {enableCod && (
                                    <div className={`pm${paymentMethod === 'cod' ? ' active' : ''}`} onClick={() => setPaymentMethod('cod')}>
                                        <div className="pm-row">
                                            <div className={`pm-rad${paymentMethod === 'cod' ? ' on' : ''}`} />
                                            <div className="pm-body">
                                                <h3 className="pm-title">Cash on Delivery (COD)</h3>
                                                <p className="pm-desc">Pay in cash when the courier delivers. Seller confirms receipt.</p>
                                                <div className="pm-pills">
                                                    <span className="pm-pill"><MapPin size={11} /> West Malaysia only</span>
                                                    <span className="pm-pill">No extra fee</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {enableQrBanking && (
                                    <div className={`pm${paymentMethod === 'qr_banking' ? ' active' : ''}`} onClick={() => setPaymentMethod('qr_banking')}>
                                        <div className="pm-row">
                                            <div className={`pm-rad${paymentMethod === 'qr_banking' ? ' on' : ''}`} />
                                            <div className="pm-body">
                                                <h3 className="pm-title">Bank Transfer / DuitNow QR</h3>
                                                <p className="pm-desc">Scan DuitNow QR or transfer to seller's bank. Upload receipt to confirm.</p>
                                                <div className="pm-pills">
                                                    <span className="pm-pill teal"><ShieldCheck size={11} /> Seller-verified</span>
                                                    <span className="pm-pill">No extra fee</span>
                                                </div>
                                            </div>
                                        </div>

                                        {paymentMethod === 'qr_banking' && (
                                            <div className="qr-panel" onClick={e => e.stopPropagation()}>
                                                {/* QR + meta */}
                                                <div className="qr-row">
                                                    {merchantQrUrl ? (
                                                        // eslint-disable-next-line @next/next/no-img-element
                                                        <img src={merchantQrUrl} alt="DuitNow QR" className="qr-img" />
                                                    ) : (
                                                        <div className="qr-ph">
                                                            <QrCode size={36} />
                                                            <span>Scan to pay</span>
                                                        </div>
                                                    )}
                                                    <div className="qr-meta">
                                                        <h4>Scan DuitNow QR</h4>
                                                        <p>Open any MY banking or e-wallet app and confirm <strong>{formatPrice(total, currency)}</strong>.</p>
                                                        <span className="qr-apps">Maybank2u · TNG · Boost · GrabPay</span>
                                                    </div>
                                                </div>

                                                {/* Upload */}
                                                <div className="ru">
                                                    <div className="ru-hd">
                                                        <span>Upload Payment Receipt</span>
                                                        <span className="ru-req">Required</span>
                                                    </div>
                                                    {proofPreview ? (
                                                        <div className="ru-file">
                                                            <div className="ru-thumb"><FileImage size={20} /></div>
                                                            <div className="ru-info">
                                                                <p className="ru-name">{proofFile?.name}</p>
                                                                <p className="ru-sz">{proofFile ? `${Math.round(proofFile.size / 1024)} KB` : ''} · ready to submit</p>
                                                            </div>
                                                            <button className="ru-x" onClick={removeProof}><X size={16} /></button>
                                                        </div>
                                                    ) : (
                                                        <div className="ru-drop" onClick={() => fileInputRef.current?.click()}>
                                                            <div className="ru-icon"><UploadCloud size={22} /></div>
                                                            <p className="ru-t">Click to upload a receipt image</p>
                                                            <p className="ru-s">JPG or PNG · Max 2 MB</p>
                                                        </div>
                                                    )}
                                                    <input ref={fileInputRef} type="file" accept="image/jpeg,image/png" onChange={handleProofUpload} style={{ display: 'none' }} />
                                                    {proofError && <p className="ru-err"><AlertCircle size={12} /> {proofError}</p>}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* ── Summary column ───────────────────── */}
                    <div className="ck-sum">
                        <div className="sum-card">
                            <h3 className="sum-hd">Order Summary</h3>

                            <ul className="sum-items">
                                {items.map(item => (
                                    <li key={item.productId} className="sum-item">
                                        <div className="s-th">
                                            {item.imageUrl
                                                // eslint-disable-next-line @next/next/no-img-element
                                                ? <img src={item.imageUrl} alt={item.name} />
                                                : <ShoppingBag size={18} />}
                                        </div>
                                        <div className="s-info" data-tooltip={item.name}>
                                            <p className="s-nm">{item.name}</p>
                                            <p className="s-mt"><span className="s-qty">×{item.quantity}</span> {formatPrice(item.price, item.currency)}</p>
                                        </div>
                                        <span className="s-pr">{formatPrice(item.price * item.quantity, item.currency)}</span>
                                    </li>
                                ))}
                            </ul>

                            <div className="sum-promo">
                                <Tag size={13} />
                                <input placeholder="Promo or gift card code" />
                                <button className="sp-ap" disabled>Apply</button>
                            </div>

                            <div className="sum-row"><span className="sr-l">{ck.subtotal} ({items.length})</span><span className="sr-v">{formatPrice(sub, currency)}</span></div>
                            <div className="sum-row"><span className="sr-l">{ck.sst}</span><span className="sr-v">{formatPrice(tax, currency)}</span></div>
                            <div className="sum-row">
                                <span className="sr-l">{ck.shipping} ({selectedState?.zone === 'east' ? 'East MY' : 'West MY'})</span>
                                <span className={`sr-v${shippingFee === 0 ? ' free' : ''}`}>{shippingFee > 0 ? formatPrice(shippingFee, currency) : ck.free}</span>
                            </div>
                            {sub > 0 && sub < FREE_SHIPPING_THRESHOLD && (
                                <div className="sum-nudge">
                                    <Truck size={12} />
                                    <span>Add <strong>{formatPrice(FREE_SHIPPING_THRESHOLD - sub, currency)}</strong> more for <strong>FREE shipping</strong></span>
                                </div>
                            )}

                            <div className="sum-total">
                                <span className="st-l">{ck.total}</span>
                                <span className="st-v"><span className="st-ccy">RM</span>{total.toFixed(2)}</span>
                            </div>

                            {PlaceOrderBtn}

                            <div className={`sum-trust${paymentMethod === 'qr_banking' ? ' note' : ''}`}>
                                {paymentMethod === 'qr_banking'
                                    ? <><Info size={11} style={{ flexShrink: 0 }} /> {"You'll upload your payment proof in the next step after your order is confirmed."}</>
                                    : <><ShieldCheck size={11} /> Encrypted Checkout</>}
                            </div>
                        </div>
                    </div>
                </div>

                <style>{CK_CSS}</style>
            </div>
        </>
    )
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Checkout design system CSS                                                 */
/* ─────────────────────────────────────────────────────────────────────────── */
const CK_CSS = `
*{box-sizing:border-box;}
.ck-page{
  --tl:var(--accent,#0e7556);--tl7:var(--accent-hover,#095e44);--tl2:rgba(var(--accent-rgb,14,117,86),.22);--tl5:rgba(var(--accent-rgb,14,117,86),.07);--tlt:rgba(var(--accent-rgb,14,117,86),.06);--tlb:rgba(var(--accent-rgb,14,117,86),.30);
  --f1:var(--text-primary,#0c1014);--f2:var(--text-secondary,#2a3138);--f3:var(--text-muted,#7b8390);--f4:var(--muted,#a8b0b9);
  --card:var(--surface-card,var(--surface,#fff));
  --inp:color-mix(in srgb,var(--card) 91%,var(--f1) 9%);
  --bd:color-mix(in srgb,var(--card) 80%,var(--f1) 20%);
  --bd2:color-mix(in srgb,var(--card) 90%,var(--f1) 10%);
  --sh:0 1px 2px rgba(15,23,42,.04),0 4px 14px -8px rgba(15,23,42,.10);
  --hf:var(--font-heading,'Outfit',sans-serif);--bf:var(--font-body,'Inter',system-ui,sans-serif);
  font-family:var(--bf);color:var(--f1);background:var(--background,#eff1f3);min-height:100vh;display:flex;flex-direction:column;
}
/* Header */
.ck-hd{position:sticky;top:0;z-index:4;background:var(--card);border-bottom:1px solid var(--bd);padding:18px 28px;display:flex;align-items:center;gap:14px;}
.ck-back{width:36px;height:36px;border-radius:10px;background:var(--inp);border:1px solid var(--bd);display:grid;place-items:center;color:var(--f2);text-decoration:none;flex-shrink:0;transition:background .15s;}
.ck-back:hover{background:color-mix(in srgb,var(--card) 82%,var(--f1) 18%);}
.ck-h1{font-family:var(--hf);font-size:18px;font-weight:800;letter-spacing:-.005em;margin:0;color:var(--f1);}
.ck-crumbs{font-size:12px;color:var(--f3);margin-left:auto;display:flex;align-items:center;gap:8px;}
.ck-crumbs strong{color:var(--tl);font-weight:700;}
.ck-ssl{display:inline-flex;align-items:center;gap:6px;padding:5px 12px;font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--tl);background:var(--tl5);border:1px solid var(--tl2);border-radius:999px;margin-left:8px;}
/* Shell */
.ck-shell{flex:1;display:grid;grid-template-columns:minmax(0,1fr) 360px;gap:28px;padding:28px;align-items:start;}
.ck-form{display:flex;flex-direction:column;gap:22px;min-width:0;}
.ck-sum{position:sticky;top:90px;align-self:start;}
/* Section card */
.ck-card{background:var(--card);border-radius:16px;box-shadow:var(--sh);padding:28px;}
.ck-ch{display:flex;align-items:baseline;gap:14px;margin-bottom:18px;}
.ck-num{font-family:var(--hf);font-weight:800;font-size:22px;letter-spacing:-.01em;color:var(--tl);flex-shrink:0;width:28px;}
.ck-ct{font-family:var(--hf);font-weight:800;font-size:17px;letter-spacing:.04em;text-transform:uppercase;color:var(--f1);margin:0;flex:1;}
.ck-aux{font-size:11px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--f3);display:inline-flex;align-items:center;gap:5px;white-space:nowrap;flex-shrink:0;}
/* Fields */
.ck-f{display:flex;flex-direction:column;gap:6px;min-width:0;}
.ck-f+.ck-f{margin-top:14px;}
.ck-row+.ck-f,.ck-f+.ck-row{margin-top:14px;}
.ck-lb{font-size:10.5px;font-weight:700;letter-spacing:.10em;text-transform:uppercase;color:var(--f3);}
.ck-opt{font-weight:500;color:var(--f4);letter-spacing:.06em;margin-left:4px;}
.ck-iw{background:var(--inp);border-radius:8px;border:1.5px solid transparent;transition:background .15s,border-color .15s,box-shadow .15s;}
.ck-iw input,.ck-iw select{display:block;width:100%;height:44px;background:transparent;border:none;outline:none;padding:0 14px;font-size:14px;color:var(--f1);font-weight:500;letter-spacing:-.005em;font-family:inherit;box-sizing:border-box;}
.ck-iw input::placeholder{color:var(--f4);font-weight:400;}
.ck-iw:focus-within{background:var(--card);border-color:var(--tlb);box-shadow:0 0 0 3px rgba(var(--accent-rgb,14,117,86),.10);}
.ck-iw.err{border-color:#fca5a5;background:var(--card);}
.ck-iw.err:focus-within{border-color:#ef4444;box-shadow:0 0 0 3px rgba(239,68,68,.12);}
.ck-sel{position:relative;}
.ck-sel select{appearance:none;padding-right:36px;cursor:pointer;}
.ck-sel::after{content:"";position:absolute;right:14px;top:50%;width:8px;height:8px;border-right:1.5px solid var(--f3);border-bottom:1.5px solid var(--f3);transform:translateY(-70%) rotate(45deg);pointer-events:none;}
.ck-row{display:grid;gap:14px;margin-top:14px;}
.ck-row.c2{grid-template-columns:1fr 1fr;}
.ck-row.c3{grid-template-columns:1fr 1fr 1fr;}
.ck-row.c2>*,.ck-row.c3>*{display:flex;flex-direction:column;}
.ck-row.c2>* .ck-iw,.ck-row.c3>* .ck-iw{margin-top:auto;}
/* Error */
.ck-err{background:#fef2f2;border:1px solid #fecaca;border-radius:12px;padding:12px 16px;font-size:13px;color:#dc2626;display:flex;align-items:center;gap:10px;}
.ck-ferr{font-size:11.5px;color:#dc2626;margin:3px 0 0;display:flex;align-items:center;gap:4px;font-weight:500;min-height:16px;}
/* Payment methods */
.pm-list{display:flex;flex-direction:column;gap:12px;}
.pm{background:var(--card);border:1px solid var(--bd);border-radius:12px;padding:16px 18px;cursor:pointer;transition:all .18s cubic-bezier(.22,1,.36,1);position:relative;}
.pm:hover:not(.active){border-color:var(--bd);background:color-mix(in srgb,var(--card) 95%,var(--f1) 5%);}
.pm.active{border:1.5px solid var(--tl);background:var(--tl5);padding:15.5px 17.5px;box-shadow:0 0 0 4px var(--tlt);}
.pm-row{display:flex;align-items:flex-start;gap:16px;}
.pm-rad{width:20px;height:20px;border-radius:999px;border:1.5px solid var(--bd);background:var(--inp);display:grid;place-items:center;transition:all .15s;flex-shrink:0;margin-top:1px;}
.pm-rad.on{border-color:var(--tl);background:var(--tl);box-shadow:0 0 0 4px rgba(var(--accent-rgb,14,117,86),.12);}
.pm-rad.on::after{content:"";width:7px;height:7px;border-radius:999px;background:#fff;}
.pm-body{flex:1;min-width:0;}
.pm-title{font-size:14.5px;font-weight:700;color:var(--f1);margin:0;letter-spacing:-.005em;}
.pm-desc{font-size:12.5px;color:var(--f3);margin:2px 0 0;line-height:1.5;}
.pm-pills{display:flex;align-items:center;gap:8px;margin-top:8px;flex-wrap:wrap;}
.pm-pill{display:inline-flex;align-items:center;gap:5px;font-size:11px;font-weight:600;color:var(--f3);padding:4px 10px;border-radius:999px;background:var(--inp);border:1px solid var(--bd);white-space:nowrap;}
.pm-pill.teal{background:var(--tl5);border-color:var(--tl2);color:var(--tl7);}
/* QR expand panel */
.qr-panel{margin-top:14px;padding-top:14px;border-top:1px dashed #d8dde2;display:flex;flex-direction:column;gap:14px;}
.qr-row{display:flex;align-items:center;gap:16px;padding:16px;background:var(--card);border:1px solid var(--bd);border-radius:12px;}
.qr-img{width:120px;height:120px;object-fit:contain;border-radius:8px;border:1px solid var(--bd);flex-shrink:0;}
.qr-ph{width:120px;height:120px;flex-shrink:0;border:2px dashed var(--tlb);border-radius:8px;background:var(--tlt);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;color:var(--tl);}
.qr-ph span{font-size:11px;font-weight:600;}
.qr-meta{flex:1;min-width:0;}
.qr-meta h4{font-family:var(--hf);font-size:14px;font-weight:700;margin:0 0 4px;color:var(--f1);}
.qr-meta p{font-size:12.5px;color:var(--f3);margin:0;line-height:1.5;}
.qr-meta strong{color:var(--tl7);font-weight:800;}
.qr-apps{display:block;font-size:11px;color:var(--tl);font-weight:600;margin-top:6px;}
/* Receipt upload */
.ru{display:flex;flex-direction:column;gap:8px;}
.ru-hd{display:flex;align-items:center;justify-content:space-between;font-size:11px;font-weight:700;letter-spacing:.10em;text-transform:uppercase;color:var(--f2);}
.ru-req{font-size:10px;font-weight:700;color:#8a5c0a;background:#fff4dc;border:1px solid #f1d693;border-radius:999px;padding:2px 8px;letter-spacing:.06em;}
.ru-drop{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;padding:28px 16px;text-align:center;border:1.5px dashed var(--tlb);border-radius:12px;background:var(--tlt);cursor:pointer;transition:all .15s;}
.ru-drop:hover{background:var(--tl5);border-color:var(--tl);}
.ru-icon{width:44px;height:44px;border-radius:999px;background:var(--card);border:1px solid var(--tl2);display:grid;place-items:center;color:var(--tl);}
.ru-t{font-size:13px;font-weight:700;color:var(--f1);margin:0;}
.ru-s{font-size:11.5px;color:var(--f3);margin:0;font-weight:500;}
.ru-file{display:flex;align-items:center;gap:14px;padding:14px 16px;background:var(--inp);border:1px solid var(--bd);border-radius:12px;}
.ru-thumb{width:44px;height:44px;border-radius:10px;background:var(--tl5);border:1px solid var(--tl2);color:var(--tl);display:grid;place-items:center;flex-shrink:0;}
.ru-info{flex:1;min-width:0;}
.ru-name{font-size:14px;font-weight:700;color:var(--f1);margin:0 0 2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.ru-sz{font-size:11.5px;color:var(--f3);margin:0;font-family:monospace;}
.ru-x{width:30px;height:30px;border-radius:8px;color:var(--f3);display:grid;place-items:center;cursor:pointer;transition:all .15s;background:transparent;border:none;flex-shrink:0;}
.ru-x:hover{background:rgba(239,68,68,.10);color:#b91c1c;}
.ru-err{display:flex;align-items:center;gap:6px;font-size:12px;color:#dc2626;margin:2px 0 0;}
/* Summary card */
.sum-card{background:var(--card);border-radius:16px;box-shadow:var(--sh);padding:22px;display:flex;flex-direction:column;}
.sum-hd{font-family:var(--hf);font-size:14px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--f1);margin:0 0 14px;}
.sum-items{list-style:none;margin:0 0 14px;padding:0 0 12px;border-bottom:1px solid var(--bd);display:flex;flex-direction:column;gap:10px;}
.sum-item{display:grid;grid-template-columns:44px 1fr auto;gap:6px 12px;align-items:start;}
.s-th{width:44px;height:44px;border-radius:8px;background:linear-gradient(135deg,var(--tl5),var(--tl2));border:1px solid var(--bd);display:grid;place-items:center;color:var(--tl);overflow:hidden;flex-shrink:0;}
.s-th img{width:100%;height:100%;object-fit:cover;}
.s-info{min-width:0;position:relative;}
.s-info[data-tooltip]:hover::after{content:attr(data-tooltip);position:absolute;bottom:calc(100% + 7px);left:0;background:#1e293b;color:#f1f5f9;font-size:12px;font-weight:500;letter-spacing:0;padding:6px 10px;border-radius:7px;white-space:nowrap;max-width:260px;overflow:hidden;text-overflow:ellipsis;z-index:20;pointer-events:none;box-shadow:0 4px 16px rgba(0,0,0,.22);animation:tipIn .15s ease;}
@keyframes tipIn{from{opacity:0;transform:translateY(4px);}to{opacity:1;transform:translateY(0);}}
.s-nm{min-width:0;font-size:13px;font-weight:600;color:var(--f1);margin:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.s-mt{font-size:11px;color:var(--f3);margin:3px 0 0;}
.s-qty{display:inline-block;padding:1px 6px;background:var(--inp);border-radius:999px;font-size:10px;color:var(--f2);margin-right:4px;font-family:monospace;}
.s-pr{font-size:13px;font-weight:700;color:var(--f2);white-space:nowrap;font-family:monospace;padding-top:1px;}
.sum-promo{display:flex;align-items:center;gap:8px;padding:8px 12px;background:var(--inp);border:1.5px dashed var(--bd);border-radius:10px;margin-bottom:10px;}
.sum-promo svg{color:var(--f4);flex-shrink:0;}
.sum-promo input{flex:1;border:none;background:transparent;outline:none;font-size:13px;color:var(--f1);font-family:inherit;min-width:0;}
.sum-promo input::placeholder{color:var(--f4);}
.sp-ap{flex-shrink:0;font-size:12px;font-weight:700;color:var(--tl);background:transparent;border:none;padding:0;opacity:.4;cursor:not-allowed;}
.sum-nudge{display:flex;align-items:center;gap:8px;padding:7px 10px;background:var(--tl5);border:1px solid var(--tl2);border-radius:8px;font-size:12px;color:var(--f3);margin:6px 0;}
.sum-nudge svg{color:var(--tl);flex-shrink:0;}
.sum-nudge strong{color:var(--tl7);}
.sum-row{display:flex;align-items:baseline;justify-content:space-between;gap:12px;font-size:13px;padding:4px 0;}
.sr-l{color:var(--f3);}
.sr-v{font-family:monospace;font-weight:500;color:var(--f2);white-space:nowrap;flex-shrink:0;}
.sr-v.free{color:var(--tl);font-weight:700;font-family:inherit;}
.sum-total{display:flex;align-items:baseline;justify-content:space-between;gap:10px;margin:14px 0;padding-top:16px;border-top:1px solid var(--bd);}
.st-l{font-family:var(--hf);font-size:14px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--f1);}
.st-v{font-family:var(--hf);font-size:28px;font-weight:800;letter-spacing:-.01em;color:var(--tl);white-space:nowrap;flex-shrink:0;}
.st-ccy{font-size:13px;font-family:monospace;font-weight:500;color:var(--tl);margin-right:4px;}
/* Place Order button */
.po-btn{display:flex;align-items:center;justify-content:center;gap:10px;width:100%;height:54px;border-radius:10px;font-family:var(--hf);font-size:14px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;background:var(--tl);color:#fff;box-shadow:0 6px 16px -6px rgba(var(--accent-rgb,14,117,86),.55);border:none;cursor:pointer;transition:all .15s;white-space:nowrap;padding:0 14px;}
.po-btn:hover:not(.dis){background:var(--tl7);transform:translateY(-1px);}
.po-btn.dis{background:#d9dde2;color:#8a929b;box-shadow:none;cursor:not-allowed;}
.sum-trust{margin-top:12px;display:flex;align-items:center;justify-content:center;gap:6px;font-size:10.5px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--f3);}
.sum-trust.note{font-size:11px;font-weight:500;text-transform:none;letter-spacing:0;color:var(--f3);text-align:center;line-height:1.5;}
@keyframes spin{to{transform:rotate(360deg);}}.spin{animation:spin .7s linear infinite;}
/* Responsive */
@media(max-width:768px){
  .ck-shell{grid-template-columns:1fr;padding:16px;}
  .ck-sum{position:static;}
  .ck-card{padding:20px;}
  .ck-row.c3{grid-template-columns:1fr 1fr;}
  .ck-row.c2{grid-template-columns:1fr;}
}
@media(max-width:480px){
  .ck-hd{padding:14px 16px;}
  .ck-crumbs{display:none;}
  .ck-row.c3{grid-template-columns:1fr;}
}
/* Payment brand badges */
.pm-brands{display:flex;align-items:center;gap:6px;margin-top:8px;flex-wrap:wrap;}
.pm-brand{height:22px;min-width:34px;padding:0 6px;border-radius:5px;display:inline-grid;place-items:center;font-family:var(--hf);font-size:9.5px;font-weight:800;letter-spacing:.06em;background:#fff;color:#0b1120;border:1px solid #d8dde2;box-shadow:0 1px 2px rgba(15,23,42,.08);}
.pm-brand.visa{color:#1a1f71;letter-spacing:.08em;}
.pm-brand.amex{background:#1d4cba;color:#fff;border-color:rgba(0,0,0,.06);}
.pm-brand.mc .mc-c{display:flex;}
.pm-brand.mc .mc-c span{width:16px;height:16px;border-radius:999px;}
.pm-brand.mc .mc-c span:first-child{background:#eb001b;}
.pm-brand.mc .mc-c span:last-child{background:#f79e1b;margin-left:-6px;mix-blend-mode:multiply;}
.pm-brand.fpx{background:linear-gradient(135deg,#0a8a3f,#0c6e34);color:#fff;border-color:rgba(0,0,0,.06);}
/* Locked / maintenance state */
.pm.locked{opacity:.7;cursor:default;}
.pm-rad.locked-rad{background:var(--inp);border-color:var(--bd);}
.pm-lock-glyph{display:inline-flex;align-items:center;gap:4px;font-size:10.5px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:#92400e;background:#fff4dc;border:1px solid #f1d693;padding:2px 8px;border-radius:999px;opacity:1!important;filter:none!important;}
.pm-tooltip{position:absolute;z-index:10;width:268px;background:var(--card);border:1px solid var(--bd);border-radius:12px;padding:12px 14px;box-shadow:0 8px 30px rgba(15,23,42,.15);font-size:12px;line-height:1.5;color:var(--f2);opacity:0;pointer-events:none;transition:opacity .15s;}
.pm.locked:hover .pm-tooltip{opacity:1;}
.pm-tooltip::before{content:"";position:absolute;width:12px;height:12px;background:var(--card);border-top:1px solid var(--bd);border-left:1px solid var(--bd);transform:rotate(45deg);}
.tip-right{top:12px;left:calc(100% + 14px);}
.tip-right::before{top:14px;left:-7px;}
.pt-head{display:flex;align-items:center;gap:6px;font-weight:700;font-size:12.5px;margin-bottom:4px;color:var(--f1);}
.pt-cta{display:inline-flex;align-items:center;gap:4px;margin-top:8px;font-size:11.5px;font-weight:600;color:var(--tl);}
.pm-pill.amber{background:#fff4dc;border-color:#f1d693;color:#92400e;}
`
