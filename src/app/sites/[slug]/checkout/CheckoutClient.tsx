'use client'

import { useState, useEffect, useRef } from 'react'
import { toast, Toaster } from 'sonner'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCartStore } from '@/store/cartStore'
import { trackEvent } from '@/lib/analytics/track-event'
import {
    ArrowLeft, Loader2, ShoppingBag, X, AlertCircle,
    ShieldCheck, ChevronRight, Rocket, MapPin, Truck,
    QrCode, UploadCloud, FileImage, /* Tag, */ Info, Lock,
    Landmark, Check,
} from 'lucide-react'
import { useI18n } from '@/i18n'
import { resolveTheme, generateThemeCSS } from '@/lib/theme/resolve'
import { GoogleFontsLoader } from '@/components/site-renderer/GoogleFontsLoader'
import { type CheckoutForm, validateEmail, validatePhone, validatePaymentProof, PROOF_ACCEPTED_TYPES, PROOF_MAX_SIZE_BYTES } from '@/lib/storefront'

type GeoState = { id: number; name: string; state_code: string; zone: string }
type GeoDistrict = { id: number; name: string }

type ShippingConfig = {
    westRate: number | null
    eastRate: number | null
    freeAbove: number | null
}

type InitialSiteData = {
    siteId: string
    tenantId: string
    enableCod: boolean
    enableQrBanking: boolean
    shippingConfig: ShippingConfig | null
    stripeEnabled: boolean
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

const ACCEPTED_IMAGE_TYPES = PROOF_ACCEPTED_TYPES
const MAX_FILE_SIZE = PROOF_MAX_SIZE_BYTES

export function CheckoutClient({ slug, initialThemeCSS, initialFontHeading, initialFontBody, initialSiteData }: CheckoutClientProps) {
    const { t } = useI18n()
    const ck = t.storefront.checkout
    const [siteId, setSiteId] = useState(initialSiteData?.siteId ?? '')
    const [isOwner, setIsOwner] = useState(false)
    const { items, subtotal, clearCart } = useCartStore()

    const [enableCod, setEnableCod] = useState(initialSiteData?.enableCod ?? true)
    const [enableQrBanking, setEnableQrBanking] = useState(initialSiteData?.enableQrBanking ?? true)
    // Shipping rates in RM (shippingConfig stores sen; divide by 100)
    const sc = initialSiteData?.shippingConfig
    const [shippingWestRM, setShippingWestRM] = useState((sc?.westRate ?? 800) / 100)
    const [shippingEastRM, setShippingEastRM] = useState((sc?.eastRate ?? 1500) / 100)
    const [freeAboveRM, setFreeAboveRM] = useState<number | null>(
        sc?.freeAbove != null ? sc.freeAbove / 100 : null
    )
    const [showStripe, setShowStripe] = useState(initialSiteData?.stripeEnabled ?? false)

    const [form, setForm] = useState<CheckoutForm>(initialForm)
    const [states, setStates] = useState<GeoState[]>([])
    const [statesLoading, setStatesLoading] = useState(true)
    const [selectedStateId, setSelectedStateId] = useState('')
    const [districts, setDistricts] = useState<GeoDistrict[]>([])
    const [districtsLoading, setDistrictsLoading] = useState(false)
    const [selectedDistrictId, setSelectedDistrictId] = useState('')
    const [postcodeOpts, setPostcodeOpts] = useState<string[]>([])
    const [postcodesLoading, setPostcodesLoading] = useState(false)
    const [paymentMethod, setPaymentMethod] = useState<'cod' | 'bank_transfer' | 'stripe'>('cod')
    const [proofFile, setProofFile] = useState<File | null>(null)
    const [proofPreview, setProofPreview] = useState<string | null>(null)
    const [proofError, setProofError] = useState<string | null>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)

    const router = useRouter()
    const [mounted, setMounted] = useState(false)
    const [isPlacing, setIsPlacing] = useState(false)
    const [showOverlay, setShowOverlay] = useState(false)
    const [overlayTakingLong, setOverlayTakingLong] = useState(false)
    const overlayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const longTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [fieldErrors, setFieldErrors] = useState<{ email?: string; phone?: string }>({})
    const [themeCSS, setThemeCSS] = useState(initialThemeCSS)
    const [fontHeading, setFontHeading] = useState(initialFontHeading)
    const [fontBody, setFontBody] = useState(initialFontBody)

    useEffect(() => { setMounted(true) }, [])

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
                if (data.enableCod === false) { setEnableCod(false); setPaymentMethod('bank_transfer') }
                if (data.enableQrBanking === false) setEnableQrBanking(false)
                if (data.shippingConfig) {
                    const s = data.shippingConfig
                    if (s.westRate != null) setShippingWestRM(s.westRate / 100)
                    if (s.eastRate != null) setShippingEastRM(s.eastRate / 100)
                    setFreeAboveRM(s.freeAbove != null ? s.freeAbove / 100 : null)
                }
                if (data.stripeEnabled === true) setShowStripe(true)
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
    const baseShipping = sub > 0 ? (selectedState?.zone === 'east' ? shippingEastRM : shippingWestRM) : 0
    const shippingFee = freeAboveRM !== null && sub >= freeAboveRM ? 0 : baseShipping
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
        const proofErr = validatePaymentProof(file)
        if (proofErr === 'INVALID_TYPE') {
            setProofError(ck.invalidImage); setProofFile(null); setProofPreview(null); return
        }
        if (proofErr === 'FILE_TOO_LARGE') {
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

    const contactVerified = form.name.trim().length > 0 && form.email.trim().length > 0 && !fieldErrors.email && !fieldErrors.phone

    const canPlaceOrder = Boolean(
        siteId && form.name.trim() && form.email.trim() &&
        form.city && form.postcode && items.length > 0 &&
        (paymentMethod === 'cod' || paymentMethod === 'bank_transfer' || paymentMethod === 'stripe')
    )

    const dismissOverlay = () => {
        if (overlayTimerRef.current) clearTimeout(overlayTimerRef.current)
        if (longTimerRef.current) clearTimeout(longTimerRef.current)
        setShowOverlay(false)
        setOverlayTakingLong(false)
    }

    const handlePlaceOrder = async () => {
        if (!canPlaceOrder) return
        setIsPlacing(true)
        let navigatedToConfirm = false
        // Show overlay after 300ms if API still running (avoids flash on fast responses)
        overlayTimerRef.current = setTimeout(() => {
            setShowOverlay(true)
            // Escape hatch after 10s
            longTimerRef.current = setTimeout(() => setOverlayTakingLong(true), 10000)
        }, 300)
        try {
            if (paymentMethod === 'stripe') {
                const stripePayload = {
                    siteId,
                    items: items.map(i => ({ productId: i.productId, quantity: i.quantity })),
                    customer: {
                        name: form.name, email: form.email, phone: form.phone,
                        address: { line1: form.line1, line2: form.line2, city: form.city, state: form.state, postcode: form.postcode, country: 'Malaysia' },
                    },
                }
                const res = await fetch('/api/orders/stripe-checkout', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(stripePayload),
                })
                const data = await res.json()
                dismissOverlay()
                if (res.ok && data.success && data.data.sessionUrl) {
                    clearCart()
                    navigatedToConfirm = true
                    window.location.href = data.data.sessionUrl
                } else {
                    toast.error(data.error?.message || 'Failed to initialize payment')
                }
                return
            }

            // bank_transfer / COD: no pre-checkout upload — proof submitted post-order via magic link
            const checkoutPayload: Record<string, unknown> = {
                siteId,
                items: items.map(i => ({ productId: i.productId, quantity: i.quantity })),
                customer: {
                    name: form.name, email: form.email, phone: form.phone,
                    address: { line1: form.line1, line2: form.line2, city: form.city, state: form.state, postcode: form.postcode, country: 'Malaysia' },
                },
                paymentMethod,
            }

            const res = await fetch('/api/orders/checkout', {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(checkoutPayload),
            })
            const data = await res.json()

            if (res.ok && data.success) {
                if (siteId) {
                    trackEvent({ siteId, event: 'purchase', isOwner, metadata: {
                        orderNumber: data.data.orderNumber, total: data.data.total,
                        currency: data.data.currency, itemCount: items.length,
                    }})
                }
                const confirmUrl = `/sites/${slug}/order/${data.data.orderId}/confirm`
                dismissOverlay()
                // Keep isPlacing=true via flag so empty-cart check doesn't trigger before unmount
                navigatedToConfirm = true
                clearCart()
                if ('startViewTransition' in document) {
                    document.startViewTransition(() => { router.push(confirmUrl) })
                } else {
                    router.push(confirmUrl)
                }
            } else {
                dismissOverlay()
                toast.error(data.error?.message || 'Failed to place order')
            }
        } catch (err: unknown) {
            dismissOverlay()
            toast.error(err instanceof Error ? err.message : ck.networkError)
        } finally {
            if (!navigatedToConfirm) setIsPlacing(false)
        }
    }

    if (mounted && items.length === 0 && !isPlacing) {
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
            <Toaster position="bottom-center" richColors />
            <GoogleFontsLoader fontHeading={fontHeading} fontBody={fontBody} />
            {themeCSS && <style dangerouslySetInnerHTML={{ __html: themeCSS }} />}

            {/* ── Placing Order Overlay ── */}
            {showOverlay && (
                <div className="po-overlay" role="status" aria-live="polite">
                    <div className="po-overlay-card">
                        <div className="po-overlay-spinner">
                            <Loader2 size={32} className="spin" />
                        </div>
                        <p className="po-overlay-title">Placing your order…</p>
                        <p className="po-overlay-sub">Please don&apos;t close this page</p>
                        {overlayTakingLong && (
                            <div className="po-overlay-long">
                                <p>Taking longer than expected.</p>
                                <button className="po-overlay-cancel" onClick={() => { dismissOverlay(); setIsPlacing(false) }}>
                                    Cancel
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}

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
                        <span className="ck-ssl" style={{ marginLeft: 16 }}><ShieldCheck size={11} /> SSL Secure</span>
                    </div>
                    <span className="ck-ssl ck-ssl-sm" style={{ marginLeft: 'auto' }}><Lock size={11} /> Secure</span>
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
                                {contactVerified && <span className="ck-aux ck-verified"><Check size={11} /> Verified</span>}
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
                                    {(fieldErrors.email || fieldErrors.phone) && <p className="ck-ferr">{fieldErrors.email}</p>}
                                </div>
                                <div className="ck-f">
                                    <label className="ck-lb">{ck.phone} (+60)</label>
                                    <div className={`ck-iw${fieldErrors.phone ? ' err' : ''}`}>
                                        <input type="tel" value={form.phone} onChange={e => updateField('phone', e.target.value)} onBlur={handlePhoneBlur} placeholder="+60 12 345 6789" />
                                    </div>
                                    {(fieldErrors.email || fieldErrors.phone) && <p className="ck-ferr">{fieldErrors.phone}</p>}
                                </div>
                            </div>
                        </div>

                        {/* 02 Shipping */}
                        <div className="ck-card">
                            <div className="ck-ch">
                                <span className="ck-num">02</span>
                                <h2 className="ck-ct">{ck.shippingAddress}</h2>
                                <span className="ck-aux">
                                    <Truck size={12} />
                                    {selectedState?.zone === 'east' ? 'East Malaysia' : 'West Malaysia'}
                                    {' · '}{shippingFee === 0 ? 'Free' : formatPrice(shippingFee, currency)}
                                </span>
                            </div>
                            <div className="ck-f">
                                <label className="ck-lb">{ck.addressLine1}</label>
                                <div className="ck-iw"><input value={form.line1} onChange={e => updateField('line1', e.target.value)} placeholder="No. 17, Jalan Kenari 22..." /></div>
                            </div>
                            <div className="ck-f">
                                <label className="ck-lb">{ck.addressLine2}</label>
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
                                <span className="ck-aux"><Lock size={12} /> Encrypted</span>
                            </div>
                            <div className="pm-list">
                                {showStripe && (
                                    <div className={`pm${paymentMethod === 'stripe' ? ' active' : ''}`} onClick={() => setPaymentMethod('stripe')}>
                                        <div className="pm-row">
                                            <div className={`pm-rad${paymentMethod === 'stripe' ? ' on' : ''}`} />
                                            <div className="pm-body">
                                                <h3 className="pm-title">Pay with Card / FPX</h3>
                                                <p className="pm-desc">Card · FPX Online Banking · Secure hosted checkout</p>
                                                <div className="pm-brands">
                                                    <span className="pm-brand visa">VISA</span>
                                                    <span className="pm-brand mc"><span className="mc-c"><span /><span /></span></span>
                                                    <span className="pm-brand amex">AMEX</span>
                                                    <span className="pm-brand fpx">FPX</span>
                                                </div>
                                                <div className="pm-pills">
                                                    <span className="pm-pill teal"><ShieldCheck size={11} /> Secure</span>
                                                    <span className="pm-pill"><Lock size={11} /> Powered by Stripe</span>
                                                </div>
                                            </div>
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
                                    <div className={`pm${paymentMethod === 'bank_transfer' ? ' active' : ''}`} onClick={() => setPaymentMethod('bank_transfer')}>
                                        <div className="pm-row">
                                            <div className={`pm-rad${paymentMethod === 'bank_transfer' ? ' on' : ''}`} />
                                            <div className="pm-body">
                                                <h3 className="pm-title">Bank Transfer / DuitNow QR</h3>
                                                <p className="pm-desc">Transfer to seller&apos;s bank or scan a DuitNow QR. Receipt verified manually.</p>
                                                <div className="pm-mini-marks">
                                                    <span className="pm-mini-mark mark-qr"><QrCode size={12} /></span>
                                                    <span className="pm-mini-mark mark-bnk"><Landmark size={12} /></span>
                                                </div>
                                                <div className="pm-pills">
                                                    <span className="pm-pill teal"><ShieldCheck size={11} /> Seller-verified</span>
                                                    <span className="pm-pill">No extra fee</span>
                                                </div>
                                            </div>
                                        </div>

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

                            {/* TODO: Promo/gift card — re-enable when promotion system is defined
                            <div className="sum-promo">
                                <Tag size={13} />
                                <input placeholder="Promo or gift card code" />
                                <button className="sp-ap" disabled>Apply</button>
                            </div>
                            */}
                            <div className="sum-row"><span className="sr-l">{ck.subtotal} ({items.length})</span><span className="sr-v">{formatPrice(sub, currency)}</span></div>
                            <div className="sum-row"><span className="sr-l">{ck.sst}</span><span className="sr-v">{formatPrice(tax, currency)}</span></div>
                            <div className="sum-row">
                                <span className="sr-l">{ck.shipping} ({selectedState?.zone === 'east' ? 'East MY' : 'West MY'})</span>
                                <span className={`sr-v${shippingFee === 0 ? ' free' : ''}`}>{shippingFee > 0 ? formatPrice(shippingFee, currency) : ck.free}</span>
                            </div>
                            {sub > 0 && freeAboveRM !== null && (
                                <>
                                    <div className="sum-nudge">
                                        <Truck size={12} />
                                        {sub < freeAboveRM
                                            ? <span>Add <strong>{formatPrice(freeAboveRM - sub, currency)}</strong> more for <strong>FREE shipping</strong></span>
                                            : <span><strong>FREE shipping</strong> unlocked!</span>}
                                    </div>
                                    <div className="sn-bar">
                                        <div className="sn-fill" style={{ width: `${Math.min((sub / freeAboveRM) * 100, 100)}%` }} />
                                    </div>
                                </>
                            )}

                            <div className="sum-total">
                                <span className="st-l">{ck.total}</span>
                                <span className="st-v"><span className="st-ccy">RM</span>{total.toFixed(2)}</span>
                            </div>

                            {PlaceOrderBtn}

                            <div className={`sum-trust${paymentMethod === 'bank_transfer' ? ' note' : ''}`}>
                                {paymentMethod === 'bank_transfer'
                                    ? <><Info size={13} style={{ flexShrink: 0, marginTop: 2 }} /> {"You'll upload your payment proof in the next step after your order is created."}</>
                                    : paymentMethod === 'stripe'
                                        ? <><Lock size={11} /> {"You'll be redirected to Stripe's secure checkout page."}</>
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
.ck-crumbs > svg{color:var(--f4);}
.ck-ssl{display:inline-flex;align-items:center;gap:6px;padding:6px 12px;font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--tl);background:var(--tl5);border:1px solid var(--tl2);border-radius:999px;}
.ck-ssl-sm{display:none;}
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
.ck-verified{color:var(--tl);}
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
.ck-row.c2>*,.ck-row.c3>*{display:flex;flex-direction:column;margin-top:0;}
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
.pm-body{flex:1;min-width:0;position:relative;}
.pm-title{font-size:14.5px;font-weight:700;color:var(--f1);margin:0;letter-spacing:-.005em;}
.pm-desc{font-size:12.5px;color:var(--f3);margin:2px 0 0;line-height:1.5;}
.pm-pills{display:flex;align-items:center;gap:8px;margin-top:8px;flex-wrap:wrap;}
.pm-pill{display:inline-flex;align-items:center;gap:5px;font-size:11px;font-weight:600;color:var(--f3);padding:4px 10px;border-radius:999px;background:var(--inp);border:1px solid var(--bd);white-space:nowrap;}
.pm-pill.teal{background:var(--tl5);border-color:var(--tl2);color:var(--tl7);}
/* QR expand panel */
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
.sum-nudge{display:flex;align-items:flex-start;gap:8px;padding:7px 10px;background:var(--tl5);border:1px solid var(--tl2);border-radius:8px;font-size:12px;color:var(--f2);margin:6px 0;}
.sum-nudge svg{margin-top:2px;}
.sum-nudge svg{color:var(--tl);flex-shrink:0;}
.sum-nudge strong{color:var(--tl7);}
.sum-row{display:flex;align-items:baseline;justify-content:space-between;gap:12px;font-size:13px;padding:4px 0;}
.sr-l{color:var(--f3);}
/* TODO: Promo input CSS — re-enable with .sum-promo JSX above
.sum-promo{display:flex;align-items:center;gap:8px;padding:8px 12px;background:var(--inp);border:1.5px dashed var(--bd);border-radius:10px;margin-bottom:10px;}
.sum-promo svg{color:var(--f4);flex-shrink:0;}
.sum-promo input{flex:1;border:none;background:transparent;outline:none;font-size:13px;color:var(--f1);font-family:inherit;min-width:0;}
.sum-promo input::placeholder{color:var(--f4);}
.sp-ap{flex-shrink:0;font-size:12px;font-weight:700;color:var(--tl);background:transparent;border:none;padding:0;opacity:.4;cursor:not-allowed;}
*/
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
.sum-trust.note{font-size:11.5px;font-weight:500;text-transform:none;letter-spacing:0;color:var(--f3);text-align:left;align-items:flex-start;line-height:1.5;padding:0 4px;white-space:normal;}
.sum-trust.note svg{color:#8a5c0a;}
@keyframes spin{to{transform:rotate(360deg);}}.spin{animation:spin .7s linear infinite;}
/* Placing order overlay */
.po-overlay{position:fixed;inset:0;z-index:999;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.45);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);animation:po-fade-in .2s ease;}
@keyframes po-fade-in{from{opacity:0}to{opacity:1}}
.po-overlay-card{background:#fff;border-radius:16px;padding:36px 40px;display:flex;flex-direction:column;align-items:center;gap:12px;box-shadow:0 24px 60px -12px rgba(0,0,0,.35);min-width:260px;text-align:center;}
.po-overlay-spinner{width:64px;height:64px;border-radius:999px;background:var(--tl5,#e6f7f1);display:grid;place-items:center;color:var(--tl,#0e7556);}
.po-overlay-title{font-family:var(--hf,inherit);font-size:16px;font-weight:700;color:#111;margin:0;}
.po-overlay-sub{font-size:13px;color:#6b7280;margin:0;}
.po-overlay-long{display:flex;flex-direction:column;align-items:center;gap:8px;margin-top:4px;border-top:1px solid #f0f0f0;padding-top:14px;width:100%;}
.po-overlay-long p{font-size:12px;color:#9ca3af;margin:0;}
.po-overlay-cancel{font-size:12px;font-weight:600;color:#dc2626;background:none;border:1px solid #fca5a5;border-radius:6px;padding:5px 14px;cursor:pointer;}
.po-overlay-cancel:hover{background:#fef2f2;}
/* View Transition fade */
@keyframes vt-fade-out{from{opacity:1}to{opacity:0}}
@keyframes vt-fade-in{from{opacity:0}to{opacity:1}}
::view-transition-old(root){animation:180ms ease vt-fade-out;}
::view-transition-new(root){animation:220ms ease vt-fade-in;}
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
  .ck-ssl-sm{display:inline-flex;}
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
.pm.locked{border-style:dashed;background:color-mix(in srgb,var(--card) 92%,var(--f1) 8%);opacity:1;cursor:default;}
.pm-rad.locked-rad{border-style:dashed;background:transparent;}
.pm-lock-glyph{display:inline-flex;align-items:center;gap:4px;font-size:10.5px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:#92400e;background:#fff4dc;border:1px solid #f1d693;padding:2px 8px;border-radius:999px;opacity:1!important;filter:none!important;}
.pm-tooltip{position:absolute;z-index:10;width:268px;background:var(--card);border:1px solid var(--bd);border-radius:12px;padding:12px 14px;box-shadow:0 8px 30px rgba(15,23,42,.15);font-size:12px;line-height:1.5;color:var(--f2);opacity:0;pointer-events:none;transition:opacity .15s;}
.pm.locked:hover .pm-tooltip{opacity:1;}
.pm-tooltip::before{content:"";position:absolute;width:12px;height:12px;background:var(--card);border-top:1px solid var(--bd);border-left:1px solid var(--bd);transform:rotate(45deg);}
.tip-right{top:12px;left:calc(100% + 14px);}
.tip-right::before{top:14px;left:-7px;}
.pt-head{display:flex;align-items:center;gap:6px;font-weight:700;font-size:12.5px;margin-bottom:4px;color:var(--f1);}
.pt-cta{display:inline-flex;align-items:center;gap:4px;margin-top:8px;font-size:11.5px;font-weight:600;color:var(--tl);}
.pm-pill.amber{background:#fff4dc;border-color:#f1d693;color:#92400e;}
/* QR / Bank mini marks (#4) */
.pm{container-type:inline-size;}
.pm-mini-marks{display:inline-flex;align-items:center;gap:5px;flex-shrink:0;margin-top:8px;}
.pm-mini-mark{height:22px;min-width:26px;padding:0 6px;border-radius:5px;border:1px solid;display:inline-grid;place-items:center;overflow:hidden;}
.mark-qr{background:var(--tl5);border-color:var(--tl2);color:var(--tl);}
.mark-bnk{background:#f3eafd;border-color:#e1ccf7;color:#6b3dbf;}
@container(min-width:460px){
  .pm .pm-body{position:relative;padding-right:90px;}
  .pm .pm-mini-marks{position:absolute;top:0;right:0;margin-top:0;}
}
/* Free shipping progress bar (#3) */
.sn-bar{height:4px;border-radius:999px;background:rgba(var(--accent-rgb,14,117,86),.15);overflow:hidden;display:block;margin:2px 0 6px;}
.sn-fill{display:block;height:4px;background:var(--tl);border-radius:999px;transition:width .4s ease;}
/* Bank detail rows (#2) */
`
