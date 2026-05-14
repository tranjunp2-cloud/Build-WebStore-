'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCartStore } from '@/store/cartStore'
import { trackEvent } from '@/lib/analytics/track-event'
import {
    ArrowLeft, Loader2, ShoppingBag, X, AlertCircle,
    ShieldCheck, ChevronRight, Rocket, MapPin, Truck,
    QrCode, UploadCloud, FileImage,
} from 'lucide-react'
import { useI18n } from '@/i18n'
import { resolveTheme, generateThemeCSS } from '@/lib/theme/resolve'

function formatPrice(price: number, currency: string) {
    if (currency === 'MYR') return `RM ${price.toFixed(2)}`
    if (currency === 'SGD') return `S$${price.toFixed(2)}`
    return `$${price.toFixed(2)}`
}

type CheckoutForm = {
    name: string; email: string; phone: string
    line1: string; line2: string; city: string; state: string; postcode: string
}

const initialForm: CheckoutForm = {
    name: '', email: '', phone: '', line1: '', line2: '', city: '', state: '', postcode: '',
}

const MY_STATES = [
    'Johor', 'Kedah', 'Kelantan', 'Kuala Lumpur', 'Labuan', 'Melaka',
    'Negeri Sembilan', 'Pahang', 'Penang', 'Perak', 'Perlis',
    'Putrajaya', 'Sabah', 'Sarawak', 'Selangor', 'Terengganu',
]

const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/jpg']
const MAX_FILE_SIZE = 2 * 1024 * 1024

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
    const [themeCSS, setThemeCSS] = useState('')

    useEffect(() => { params.then(p => setSlug(p.slug)) }, [params])

    useEffect(() => {
        if (!slug) return
        async function fetchSite() {
            try {
                const res = await fetch(`/api/storefront/site-by-slug?slug=${encodeURIComponent(slug)}`)
                if (!res.ok) { setError('Unable to load store. Please refresh.'); return }
                const data = await res.json()
                if (data.siteId) setSiteId(String(data.siteId))
                if (data.merchantQrCodeUrl) setMerchantQrUrl(data.merchantQrCodeUrl)
                if (data.enableCod === false) { setEnableCod(false); setPaymentMethod('qr_banking') }
                if (data.enableQrBanking === false) setEnableQrBanking(false)
                if (data.theme) {
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
                try {
                    const meRes = await fetch('/api/users/me')
                    if (meRes.ok) {
                        const meData = await meRes.json()
                        const tenantIds = (meData.user?.tenants ?? []).map(
                            (tnt: { tenant: string | { id: string } }) =>
                                typeof tnt.tenant === 'object' ? String(tnt.tenant.id) : String(tnt.tenant)
                        )
                        setIsOwner(tenantIds.includes(String(data.tenantId)))
                    }
                } catch { }
            } catch { }
        }
        fetchSite()
    }, [slug])

    const currency = items[0]?.currency || 'MYR'
    const sub = subtotal()
    const shippingFee = sub > 0 ? 10 : 0
    const tax = Math.round(sub * 0.06 * 100) / 100
    const total = sub + shippingFee + tax

    const updateField = (field: keyof CheckoutForm, value: string) =>
        setForm(prev => ({ ...prev, [field]: value }))

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
        items.length > 0 &&
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
                  .ck-empty{font-family:'Inter',sans-serif;min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;text-align:center;padding:24px;background:#eff1f3;}
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
                : <><Rocket size={16} /> {ck.placeOrder} — {formatPrice(total, currency)}</>}
        </button>
    )

    return (
        <>
            {/* eslint-disable-next-line @next/next/no-page-custom-font */}
            <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Outfit:wght@500;600;700;800&display=swap" />
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
                                    <div className="ck-iw"><input type="email" value={form.email} onChange={e => updateField('email', e.target.value)} placeholder="ahmad@email.com" /></div>
                                </div>
                                <div className="ck-f">
                                    <label className="ck-lb">{ck.phone} (+60)</label>
                                    <div className="ck-iw"><input type="tel" value={form.phone} onChange={e => updateField('phone', e.target.value)} placeholder="+60 12 345 6789" /></div>
                                </div>
                            </div>
                        </div>

                        {/* 02 Shipping */}
                        <div className="ck-card">
                            <div className="ck-ch">
                                <span className="ck-num">02</span>
                                <h2 className="ck-ct">{ck.shippingAddress}</h2>
                                <span className="ck-aux"><Truck size={12} /> West Malaysia</span>
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
                                    <label className="ck-lb">{ck.city}</label>
                                    <div className="ck-iw"><input value={form.city} onChange={e => updateField('city', e.target.value)} /></div>
                                </div>
                                <div className="ck-f">
                                    <label className="ck-lb">{ck.postcode}</label>
                                    <div className="ck-iw"><input value={form.postcode} onChange={e => updateField('postcode', e.target.value)} maxLength={5} /></div>
                                </div>
                                <div className="ck-f">
                                    <label className="ck-lb">{ck.state}</label>
                                    <div className="ck-iw ck-sel">
                                        <select value={form.state} onChange={e => updateField('state', e.target.value)}>
                                            <option value="">— Select —</option>
                                            {MY_STATES.map(s => <option key={s} value={s}>{s}</option>)}
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
                                        <div className="s-info">
                                            <p className="s-nm">{item.name}</p>
                                            <p className="s-mt"><span className="s-qty">×{item.quantity}</span> {formatPrice(item.price, item.currency)}</p>
                                        </div>
                                        <span className="s-pr">{formatPrice(item.price * item.quantity, item.currency)}</span>
                                    </li>
                                ))}
                            </ul>

                            <div className="sum-row"><span className="sr-l">{ck.subtotal} ({items.length})</span><span className="sr-v">{formatPrice(sub, currency)}</span></div>
                            <div className="sum-row"><span className="sr-l">{ck.sst} (6%)</span><span className="sr-v">{formatPrice(tax, currency)}</span></div>
                            <div className="sum-row">
                                <span className="sr-l">{ck.shipping}</span>
                                <span className={`sr-v${shippingFee === 0 ? ' free' : ''}`}>{shippingFee > 0 ? formatPrice(shippingFee, currency) : ck.free}</span>
                            </div>

                            <div className="sum-total">
                                <span className="st-l">{ck.total}</span>
                                <span className="st-v"><span className="st-ccy">RM</span>{total.toFixed(2)}</span>
                            </div>

                            {PlaceOrderBtn}

                            <div className={`sum-trust${paymentMethod === 'qr_banking' ? ' note' : ''}`}>
                                {paymentMethod === 'qr_banking'
                                    ? 'Upload your payment receipt in the section above before placing your order.'
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
  --f1:#0c1014;--f2:#2a3138;--f3:#7b8390;--f4:#a8b0b9;
  --bd:#e6e9ed;--bd2:#eef0f2;--card:#fff;--inp:#eff1f3;
  --sh:0 1px 2px rgba(15,23,42,.04),0 4px 14px -8px rgba(15,23,42,.10);
  font-family:'Inter',system-ui,sans-serif;color:var(--f1);background:#eff1f3;min-height:100vh;display:flex;flex-direction:column;
}
/* Header */
.ck-hd{position:sticky;top:0;z-index:4;background:#fff;border-bottom:1px solid var(--bd);padding:18px 28px;display:flex;align-items:center;gap:14px;}
.ck-back{width:36px;height:36px;border-radius:10px;background:var(--inp);border:1px solid var(--bd);display:grid;place-items:center;color:var(--f2);text-decoration:none;flex-shrink:0;transition:background .15s;}
.ck-back:hover{background:#e3e7ec;}
.ck-h1{font-family:'Outfit',sans-serif;font-size:18px;font-weight:800;letter-spacing:-.005em;margin:0;color:var(--f1);}
.ck-crumbs{font-size:12px;color:var(--f3);margin-left:auto;display:flex;align-items:center;gap:8px;}
.ck-crumbs strong{color:var(--tl);font-weight:700;}
.ck-ssl{display:inline-flex;align-items:center;gap:6px;padding:5px 12px;font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--tl);background:var(--tl5);border:1px solid var(--tl2);border-radius:999px;margin-left:8px;}
/* Shell */
.ck-shell{flex:1;display:grid;grid-template-columns:minmax(0,1fr) 360px;gap:28px;padding:28px;align-items:start;}
.ck-form{display:flex;flex-direction:column;gap:22px;min-width:0;}
.ck-sum{position:sticky;top:90px;align-self:start;}
/* Section card */
.ck-card{background:#fff;border-radius:16px;box-shadow:var(--sh);padding:28px;}
.ck-ch{display:flex;align-items:baseline;gap:14px;margin-bottom:18px;}
.ck-num{font-family:'Outfit',sans-serif;font-weight:800;font-size:22px;letter-spacing:-.01em;color:var(--tl);flex-shrink:0;width:28px;}
.ck-ct{font-family:'Outfit',sans-serif;font-weight:800;font-size:17px;letter-spacing:.04em;text-transform:uppercase;color:var(--f1);margin:0;flex:1;}
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
.ck-iw:focus-within{background:#fff;border-color:var(--tlb);box-shadow:0 0 0 3px rgba(var(--accent-rgb,14,117,86),.10);}
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
/* Payment methods */
.pm-list{display:flex;flex-direction:column;gap:12px;}
.pm{background:#fff;border:1px solid var(--bd);border-radius:12px;padding:16px 18px;cursor:pointer;transition:all .18s cubic-bezier(.22,1,.36,1);}
.pm:hover:not(.active){border-color:#d8dde2;background:#fafbfc;}
.pm.active{border:1.5px solid var(--tl);background:var(--tl5);padding:15.5px 17.5px;box-shadow:0 0 0 4px var(--tlt);}
.pm-row{display:flex;align-items:flex-start;gap:16px;}
.pm-rad{width:20px;height:20px;border-radius:999px;border:1.5px solid #c5cbd2;background:#fff;display:grid;place-items:center;transition:all .15s;flex-shrink:0;margin-top:1px;}
.pm-rad.on{border-color:var(--tl);background:var(--tl);box-shadow:0 0 0 4px rgba(var(--accent-rgb,14,117,86),.12);}
.pm-rad.on::after{content:"";width:7px;height:7px;border-radius:999px;background:#fff;}
.pm-body{flex:1;min-width:0;}
.pm-title{font-size:14.5px;font-weight:700;color:var(--f1);margin:0;letter-spacing:-.005em;}
.pm-desc{font-size:12.5px;color:var(--f3);margin:2px 0 0;line-height:1.5;}
.pm-pills{display:flex;align-items:center;gap:8px;margin-top:8px;flex-wrap:wrap;}
.pm-pill{display:inline-flex;align-items:center;gap:5px;font-size:11px;font-weight:600;color:var(--f3);padding:4px 10px;border-radius:999px;background:#f1f3f5;border:1px solid var(--bd);white-space:nowrap;}
.pm-pill.teal{background:var(--tl5);border-color:var(--tl2);color:var(--tl7);}
/* QR expand panel */
.qr-panel{margin-top:14px;padding-top:14px;border-top:1px dashed #d8dde2;display:flex;flex-direction:column;gap:14px;}
.qr-row{display:flex;align-items:center;gap:16px;padding:16px;background:#fff;border:1px solid var(--bd);border-radius:12px;}
.qr-img{width:120px;height:120px;object-fit:contain;border-radius:8px;border:1px solid var(--bd);flex-shrink:0;}
.qr-ph{width:120px;height:120px;flex-shrink:0;border:2px dashed var(--tlb);border-radius:8px;background:var(--tlt);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;color:var(--tl);}
.qr-ph span{font-size:11px;font-weight:600;}
.qr-meta{flex:1;min-width:0;}
.qr-meta h4{font-family:'Outfit',sans-serif;font-size:14px;font-weight:700;margin:0 0 4px;color:var(--f1);}
.qr-meta p{font-size:12.5px;color:var(--f3);margin:0;line-height:1.5;}
.qr-meta strong{color:var(--tl7);font-weight:800;}
.qr-apps{display:block;font-size:11px;color:var(--tl);font-weight:600;margin-top:6px;}
/* Receipt upload */
.ru{display:flex;flex-direction:column;gap:8px;}
.ru-hd{display:flex;align-items:center;justify-content:space-between;font-size:11px;font-weight:700;letter-spacing:.10em;text-transform:uppercase;color:var(--f2);}
.ru-req{font-size:10px;font-weight:700;color:#8a5c0a;background:#fff4dc;border:1px solid #f1d693;border-radius:999px;padding:2px 8px;letter-spacing:.06em;}
.ru-drop{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;padding:28px 16px;text-align:center;border:1.5px dashed var(--tlb);border-radius:12px;background:var(--tlt);cursor:pointer;transition:all .15s;}
.ru-drop:hover{background:var(--tl5);border-color:var(--tl);}
.ru-icon{width:44px;height:44px;border-radius:999px;background:#fff;border:1px solid var(--tl2);display:grid;place-items:center;color:var(--tl);}
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
.sum-card{background:#fff;border-radius:16px;box-shadow:var(--sh);padding:22px;display:flex;flex-direction:column;}
.sum-hd{font-family:'Outfit',sans-serif;font-size:14px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--f1);margin:0 0 14px;}
.sum-items{list-style:none;margin:0 0 14px;padding:0 0 12px;border-bottom:1px solid var(--bd);display:flex;flex-direction:column;gap:10px;}
.sum-item{display:grid;grid-template-columns:44px 1fr auto;gap:12px;align-items:center;}
.s-th{width:44px;height:44px;border-radius:8px;background:linear-gradient(135deg,var(--tl5),var(--tl2));border:1px solid var(--bd);display:grid;place-items:center;color:var(--tl);overflow:hidden;flex-shrink:0;}
.s-th img{width:100%;height:100%;object-fit:cover;}
.s-nm{font-size:13px;font-weight:600;color:var(--f1);margin:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.s-mt{font-size:11px;color:var(--f3);margin:2px 0 0;}
.s-qty{display:inline-block;padding:1px 6px;background:var(--inp);border-radius:999px;font-size:10px;color:var(--f2);margin-right:4px;font-family:monospace;}
.s-pr{font-size:12.5px;font-weight:500;color:var(--f2);white-space:nowrap;font-family:monospace;}
.sum-row{display:flex;align-items:baseline;justify-content:space-between;gap:12px;font-size:13px;padding:4px 0;}
.sr-l{color:var(--f3);}
.sr-v{font-family:monospace;font-weight:500;color:var(--f2);white-space:nowrap;flex-shrink:0;}
.sr-v.free{color:var(--tl);font-weight:700;font-family:inherit;}
.sum-total{display:flex;align-items:baseline;justify-content:space-between;gap:10px;margin:14px 0;padding-top:16px;border-top:1px solid var(--bd);}
.st-l{font-family:'Outfit',sans-serif;font-size:14px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--f1);}
.st-v{font-family:'Outfit',sans-serif;font-size:28px;font-weight:800;letter-spacing:-.01em;color:var(--tl);white-space:nowrap;flex-shrink:0;}
.st-ccy{font-size:13px;font-family:monospace;font-weight:500;color:var(--tl);margin-right:4px;}
/* Place Order button */
.po-btn{display:flex;align-items:center;justify-content:center;gap:10px;width:100%;height:54px;border-radius:10px;font-family:'Outfit',sans-serif;font-size:14px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;background:var(--tl);color:#fff;box-shadow:0 6px 16px -6px rgba(var(--accent-rgb,14,117,86),.55);border:none;cursor:pointer;transition:all .15s;white-space:nowrap;padding:0 14px;}
.po-btn:hover:not(.dis){background:var(--tl7);transform:translateY(-1px);}
.po-btn.dis{background:#d9dde2;color:#8a929b;box-shadow:none;cursor:not-allowed;}
.sum-trust{margin-top:12px;display:flex;align-items:center;justify-content:center;gap:6px;font-size:10.5px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--f3);}
.sum-trust.note{font-size:11.5px;font-weight:500;letter-spacing:0;text-transform:none;text-align:left;align-items:flex-start;line-height:1.5;}
/* Spinner */
.spin{animation:spin 1s linear infinite;}
@keyframes spin{to{transform:rotate(360deg);}}
/* Mobile */
@media(max-width:768px){
  .ck-hd{padding:14px 16px;}
  .ck-crumbs{display:none;}
  .ck-shell{grid-template-columns:1fr;padding:16px;gap:16px;}
  .ck-form{order:2;}
  .ck-sum{order:1;position:static;}
  .ck-card{padding:18px 16px;border-radius:14px;}
  .ck-num{font-size:18px;width:22px;}
  .ck-ct{font-size:14px;}
  .ck-row.c2{grid-template-columns:1fr;}
  .ck-row.c3{grid-template-columns:1fr 1fr;}
  .ck-row.c3>:last-child{grid-column:1/-1;}
  .qr-row{flex-direction:column;align-items:flex-start;}
  .sum-card{padding:18px 16px;border-radius:14px;}
  .st-v{font-size:22px;}
}
`
