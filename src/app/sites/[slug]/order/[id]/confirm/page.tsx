import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getPayload } from 'payload'
import config from '@payload-config'
import { resolveTheme, generateThemeCSS } from '@/lib/theme/resolve'
import {
    ArrowLeft, Check, ChevronRight, ShieldCheck,
    CreditCard, Banknote, Clock, CheckCircle2,
    Truck, MapPin, Calendar, ShoppingBag, Package,
    PhoneCall,
} from 'lucide-react'

function formatPrice(price: number, currency: string) {
    if (currency === 'MYR') return `RM ${price.toFixed(2)}`
    if (currency === 'SGD') return `S$${price.toFixed(2)}`
    return `$${price.toFixed(2)}`
}

type OrderItem = { productName: string; quantity: number; unitPrice: number; variant?: string }
type ShippingAddress = { line1?: string; line2?: string; city?: string; state?: string; postcode?: string; country?: string }
type Order = {
    id: number | string
    orderNumber: string
    items: OrderItem[]
    subtotal: number
    shippingFee?: number
    tax: number
    total: number
    currency: string
    paymentMethod?: string
    customerName: string
    customerEmail: string
    shippingAddress?: ShippingAddress
}

export default async function OrderConfirmPage({
    params,
}: {
    params: Promise<{ slug: string; id: string }>
}) {
    const { slug, id } = await params
    const payload = await getPayload({ config })
    const orderId = isNaN(Number(id)) ? id : Number(id)

    // Resolve slug → site to scope the order lookup (prevents cross-tenant IDOR)
    const siteResult = await payload.find({
        collection: 'sites',
        where: { slug: { equals: slug } },
        limit: 1,
        overrideAccess: true,
        depth: 0,
    })
    const site = siteResult.docs[0]
    if (!site) notFound()

    const siteTheme = (site as any).theme ?? null
    const themeCSS = siteTheme
        ? generateThemeCSS(resolveTheme({
            primaryColor: siteTheme.primaryColor,
            secondaryColor: siteTheme.secondaryColor,
            accentColor: siteTheme.accentColor,
            surfaceColor: siteTheme.surfaceColor,
            textColor: siteTheme.textColor,
            mutedColor: siteTheme.mutedColor,
            fontPairingId: siteTheme.fontPairingId,
            fontHeading: siteTheme.fontHeading,
            fontBody: siteTheme.fontBody,
            colorMode: siteTheme.colorMode,
            backgroundColor: siteTheme.backgroundColor,
        }))
        : ''

    const thFontHeading = siteTheme?.fontHeading || 'Outfit'
    const thFontBody = siteTheme?.fontBody || 'Inter'
    const sanitizeFont = (f: string) => f.replace(/[^a-zA-Z0-9 -]/g, '')
    const fonts = [thFontHeading, thFontBody].filter((v, i, a) => a.indexOf(v) === i).map(sanitizeFont)
    const googleFontsHref = `https://fonts.googleapis.com/css2?${fonts.map(f => `family=${encodeURIComponent(f).replace(/%20/g, '+')}:wght@300;400;500;600;700;800;900`).join('&')}&subset=latin,vietnamese&display=swap`

    let order: Order | null = null
    try {
        const result = await payload.find({
            collection: 'orders',
            where: { id: { equals: orderId }, site: { equals: site.id } },
            limit: 1,
            overrideAccess: true,
            depth: 1,
        })
        order = result.docs[0] as unknown as Order
    } catch { }

    if (!order) notFound()

    const currency = order.currency || 'MYR'
    const shippingFee = order.shippingFee ?? 10
    const isCod = order.paymentMethod === 'cod'
    const isQr = order.paymentMethod === 'qr_banking'

    const addr = order.shippingAddress
    const addrLine = [addr?.city, addr?.state, addr?.postcode].filter(Boolean).join(', ')

    /* ─── Badge + status per payment method ─── */
    const badge = isCod
        ? { label: 'Cash on Delivery', tone: 'blue', Icon: Banknote }
        : isQr
            ? { label: 'Awaiting Verification', tone: 'amber', Icon: Clock }
            : { label: 'Paid', tone: 'teal', Icon: CheckCircle2 }

    const statusLine1 = isCod
        ? 'Pending phone verification'
        : isQr
            ? 'Awaiting payment proof review'
            : 'Payment received · Processing'

    const statusLine2 = isCod
        ? "We'll call to confirm your address before dispatch."
        : isQr
            ? "We'll verify your receipt within 1–2 business hours."
            : 'Warehouse is preparing your parcel.'

    const shipsText = isCod
        ? 'After phone verification'
        : isQr
            ? 'Within 24 h after proof is verified'
            : 'Within 24 h'

    return (
        <>
            <link rel="preconnect" href="https://fonts.googleapis.com" />
            <link crossOrigin="anonymous" href="https://fonts.gstatic.com" rel="preconnect" />
            {/* eslint-disable-next-line @next/next/no-page-custom-font */}
            <link rel="stylesheet" href={googleFontsHref} />
            {themeCSS && <style dangerouslySetInnerHTML={{ __html: themeCSS }} />}
            <div className="ty-page">

                {/* ── Header ─────────────────────────────── */}
                <header className="ty-hd">
                    <Link href={`/sites/${slug}/products`} className="ty-back">
                        <ArrowLeft size={16} />
                    </Link>
                    <h1 className="ty-h1">Order Confirmation</h1>
                    <div className="ty-crumbs">
                        <span>Cart</span><ChevronRight size={12} />
                        <span>Checkout</span><ChevronRight size={12} />
                        <strong>Confirmation</strong>
                        <span className="ty-ssl"><ShieldCheck size={11} /> SSL Secure</span>
                    </div>
                </header>

                <div className="ty-shell">

                    {/* ── Left column ──────────────────────── */}
                    <div className="ty-left">

                        {/* Success hero */}
                        <div className="ty-hero">
                            <div className="ty-check-wrap">
                                <span className="ty-ring r1" aria-hidden="true" />
                                <span className="ty-ring r2" aria-hidden="true" />
                                <div className="ty-check">
                                    <Check size={36} strokeWidth={3} />
                                </div>
                            </div>
                            <h2 className="ty-hero-title">Order Successfully Placed!</h2>
                            <div className="ty-order-row">
                                <span className="ty-order-label">Order ID</span>
                                <span className="ty-order-id">#{order.orderNumber}</span>
                                <span className={`ty-badge tone-${badge.tone}`}>
                                    <badge.Icon size={11} /> {badge.label}
                                </span>
                            </div>
                            <p className="ty-hero-sub">
                                {isCod
                                    ? 'Your order is reserved. Our team will verify your address by phone, then dispatch for cash-on-delivery.'
                                    : isQr
                                        ? 'Please allow 1–2 business hours for our team to verify your payment receipt.'
                                        : 'Your payment was processed. Sit tight — we are getting your order ready.'}
                            </p>
                        </div>

                        {/* COD card */}
                        {isCod && (
                            <div className="ty-block">
                                <div className="ty-block-hd">
                                    <div className="ty-block-titles">
                                        <h3>Pay on Delivery</h3>
                                        <p>Cash hand-off when the courier arrives — no app required.</p>
                                    </div>
                                    <span className="ty-pill pending">
                                        <PhoneCall size={11} /> Pending verification
                                    </span>
                                </div>
                                <div className="ty-cod-card">
                                    <div className="ty-cod-icon">
                                        <Banknote size={26} />
                                    </div>
                                    <div className="ty-cod-body">
                                        <p className="ty-cod-title">
                                            Please prepare <strong>{formatPrice(order.total, currency)}</strong> in cash.
                                        </p>
                                        <p className="ty-cod-sub">
                                            You&apos;ll pay the courier rider when you receive your package. They cannot provide change for amounts above RM 200.
                                        </p>
                                    </div>
                                </div>
                                <ul className="ty-tips">
                                    <li><Banknote size={14} /> Small notes preferred — couriers don&apos;t carry change.</li>
                                    <li><Package size={14} /> Two failed delivery attempts will auto-cancel the order.</li>
                                </ul>
                                <div className="ty-email-note">
                                    <CreditCard size={14} />
                                    <span>A full order summary has been sent to <strong>{order.customerEmail}</strong> for your records.</span>
                                </div>
                            </div>
                        )}

                        {/* QR Banking card */}
                        {isQr && (
                            <div className="ty-block">
                                <div className="ty-block-hd">
                                    <div className="ty-block-titles">
                                        <h3>Payment &amp; Order Status</h3>
                                        <p>Your receipt has been submitted. We will verify and confirm your order shortly.</p>
                                    </div>
                                    <span className="ty-pill pending">
                                        <Clock size={11} /> Under review
                                    </span>
                                </div>
                                <div className="ty-qr-confirm">
                                    <div className="ty-qr-icon"><CheckCircle2 size={22} /></div>
                                    <div className="ty-qr-body">
                                        <p className="ty-qr-title">Receipt submitted successfully</p>
                                        <p className="ty-qr-sub">Our team will verify within 1–2 business hours and email you once confirmed.</p>
                                    </div>
                                </div>
                                <div className="ty-email-note">
                                    <CreditCard size={14} />
                                    <span>A re-upload link and order summary were sent to <strong>{order.customerEmail}</strong>.</span>
                                </div>
                            </div>
                        )}

                        {/* Items */}
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
                                        <div className="ty-item-th"><ShoppingBag size={18} /></div>
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

                    {/* ── Right: Summary ───────────────────── */}
                    <div className="ty-right">
                        <div className="sum-card">
                            <h3 className="sum-hd">Order Summary</h3>

                            {/* Items preview */}
                            <ul className="sum-items">
                                {order.items.map((item, idx) => (
                                    <li key={idx} className="sum-item">
                                        <div className="s-th"><ShoppingBag size={18} /></div>
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
                                <span className="st-v"><span className="st-ccy">RM</span>{order.total.toFixed(2)}</span>
                            </div>

                            {/* Status badge */}
                            <div className={`ty-status tone-${badge.tone}`}>
                                <span className="ty-dot" aria-hidden="true" />
                                <div>
                                    <p className="ty-s1">{statusLine1}</p>
                                    <p className="ty-s2">{statusLine2}</p>
                                </div>
                            </div>

                            {/* Meta */}
                            <div className="ty-meta">
                                <div className="ty-mr"><Calendar size={13} /><span><strong>Placed</strong> · {new Date().toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' })}</span></div>
                                <div className="ty-mr"><Truck size={13} /><span><strong>Ships</strong> · {shipsText}</span></div>
                                {addrLine && <div className="ty-mr"><MapPin size={13} /><span><strong>To</strong> · {order.customerName}, {addrLine}</span></div>}
                            </div>

                            {/* CTAs */}
                            <div className="ty-ctas">
                                <Link href={`/sites/${slug}/products`} className="ty-cta primary">
                                    <ShoppingBag size={15} /> Continue Shopping
                                </Link>
                            </div>

                            <div className="sum-trust"><ShieldCheck size={11} /> Encrypted Checkout · Order Locked</div>
                        </div>
                    </div>
                </div>

                <style>{TY_CSS}</style>
            </div>
        </>
    )
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Order Confirmation design system CSS                                       */
/* ─────────────────────────────────────────────────────────────────────────── */
const TY_CSS = `
*{box-sizing:border-box;}
.ty-page{
  --tl:var(--accent,#0e7556);--tl7:var(--accent-hover,#095e44);--tl2:rgba(var(--accent-rgb,14,117,86),.22);--tl5:rgba(var(--accent-rgb,14,117,86),.07);--tlb:rgba(var(--accent-rgb,14,117,86),.30);
  --f1:#0c1014;--f2:#2a3138;--f3:#7b8390;--f4:#a8b0b9;
  --bd:#e6e9ed;--bd2:#eef0f2;--card:#fff;--inp:#eff1f3;
  --sh:0 1px 2px rgba(15,23,42,.04),0 4px 14px -8px rgba(15,23,42,.10);
  --hf:var(--font-heading,'Outfit',sans-serif);--bf:var(--font-body,'Inter',system-ui,sans-serif);
  font-family:var(--bf);color:var(--f1);background:#eff1f3;min-height:100vh;display:flex;flex-direction:column;
}
/* Header */
.ty-hd{position:sticky;top:0;z-index:4;background:#fff;border-bottom:1px solid var(--bd);padding:18px 28px;display:flex;align-items:center;gap:14px;}
.ty-back{width:36px;height:36px;border-radius:10px;background:var(--inp);border:1px solid var(--bd);display:grid;place-items:center;color:var(--f2);text-decoration:none;flex-shrink:0;transition:background .15s;}
.ty-back:hover{background:#e3e7ec;}
.ty-h1{font-family:var(--hf);font-size:18px;font-weight:800;letter-spacing:-.005em;margin:0;color:var(--f1);}
.ty-crumbs{font-size:12px;color:var(--f3);margin-left:auto;display:flex;align-items:center;gap:8px;}
.ty-crumbs strong{color:var(--tl);font-weight:700;}
.ty-ssl{display:inline-flex;align-items:center;gap:6px;padding:5px 12px;font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--tl);background:var(--tl5);border:1px solid var(--tl2);border-radius:999px;margin-left:8px;}
/* Shell */
.ty-shell{flex:1;display:grid;grid-template-columns:minmax(0,1fr) 360px;gap:28px;padding:28px;align-items:start;}
.ty-left{display:flex;flex-direction:column;gap:18px;}
.ty-right{position:sticky;top:90px;align-self:start;}
/* Hero */
.ty-hero{background:#fff;border-radius:16px;box-shadow:var(--sh);padding:36px 28px 28px;text-align:center;position:relative;overflow:hidden;}
.ty-hero::before{content:"";position:absolute;inset:-40% 30% auto 30%;height:180px;background:radial-gradient(ellipse at center,var(--tl5) 0%,transparent 70%);pointer-events:none;}
.ty-check-wrap{position:relative;width:84px;height:84px;margin:0 auto 18px;}
.ty-check{position:absolute;inset:0;border-radius:999px;background:linear-gradient(135deg,var(--tl) 0%,var(--tl7) 100%);display:grid;place-items:center;color:#fff;box-shadow:0 0 0 6px #fff,0 0 0 7px var(--tl2),0 16px 30px -10px rgba(var(--accent-rgb,14,117,86),.40);animation:checkPop 520ms cubic-bezier(.22,1,.36,1);}
@keyframes checkPop{0%{transform:scale(.6);opacity:0;}60%{transform:scale(1.08);opacity:1;}100%{transform:scale(1);}}
.ty-ring{position:absolute;inset:0;border-radius:999px;border:2px solid rgba(var(--accent-rgb,14,117,86),.55);opacity:0;pointer-events:none;animation:ring 2.4s ease-out infinite;}
.ty-ring.r2{animation-delay:1.2s;}
@keyframes ring{0%{transform:scale(.95);opacity:.55;}100%{transform:scale(1.7);opacity:0;}}
.ty-hero-title{font-family:var(--hf);font-size:26px;font-weight:800;letter-spacing:-.01em;color:var(--f1);margin:0 0 12px;position:relative;}
.ty-order-row{display:inline-flex;align-items:center;gap:8px;padding:7px 10px 7px 14px;background:var(--inp);border:1px solid var(--bd);border-radius:999px;font-size:12px;font-weight:600;color:var(--f3);margin:0 0 14px;position:relative;letter-spacing:.02em;}
.ty-order-label{white-space:nowrap;}
.ty-order-id{font-family:monospace;color:var(--f1);font-weight:700;font-size:13px;letter-spacing:0;}
.ty-badge{display:inline-flex;align-items:center;gap:5px;margin-left:4px;padding:4px 9px;border-radius:999px;font-size:11px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;white-space:nowrap;border:1px solid;}
.ty-badge.tone-amber{background:#fff4dc;border-color:#f1d693;color:#8a5c0a;}
.ty-badge.tone-teal{background:var(--tl5);border-color:var(--tl2);color:var(--tl7);}
.ty-badge.tone-blue{background:#e6f0ff;border-color:#c4daff;color:#1e40af;}
.ty-hero-sub{font-size:14px;line-height:1.6;color:var(--f3);max-width:480px;margin:0 auto;position:relative;}
/* Block card */
.ty-block{background:#fff;border-radius:16px;box-shadow:var(--sh);padding:24px 26px;}
.ty-block-hd{display:flex;align-items:flex-start;gap:16px;margin-bottom:18px;}
.ty-block-titles{flex:1;min-width:0;}
.ty-block-titles h3{font-family:var(--hf);font-size:17px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:var(--f1);margin:0 0 4px;}
.ty-block-titles p{font-size:12.5px;color:var(--f3);margin:0;line-height:1.5;}
.ty-pill{display:inline-flex;align-items:center;gap:5px;padding:5px 10px;border-radius:999px;font-size:11px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;white-space:nowrap;flex-shrink:0;}
.ty-pill.pending{background:#fff4dc;border:1px solid #f1d693;color:#8a5c0a;}
.ty-pill.done{background:var(--tl5);border:1px solid var(--tl2);color:var(--tl7);}
/* COD card */
.ty-cod-card{display:flex;align-items:center;gap:16px;padding:20px;background:#f5f8ff;border:1px solid #d6e2fb;border-radius:14px;}
.ty-cod-icon{width:52px;height:52px;border-radius:14px;background:linear-gradient(135deg,#3b82f6,#2563eb);color:#fff;display:grid;place-items:center;flex-shrink:0;box-shadow:0 6px 18px -6px rgba(37,99,235,.45);}
.ty-cod-body{flex:1;min-width:0;}
.ty-cod-title{font-size:15px;font-weight:700;color:var(--f1);line-height:1.45;margin:0 0 4px;}
.ty-cod-title strong{font-weight:800;color:#1e3a8a;background:rgba(59,130,246,.10);padding:1px 7px;border-radius:6px;font-family:monospace;}
.ty-cod-sub{font-size:12.5px;color:var(--f3);margin:0;line-height:1.55;}
.ty-tips{list-style:none;margin:14px 0 0;padding:0;display:flex;flex-direction:column;gap:8px;}
.ty-tips li{display:flex;align-items:flex-start;gap:10px;padding:10px 14px;background:var(--inp);border:1px solid var(--bd2);border-radius:10px;font-size:12.5px;color:var(--f2);line-height:1.5;}
.ty-tips svg{color:var(--tl);margin-top:2px;flex-shrink:0;}
/* QR confirm */
.ty-qr-confirm{display:flex;align-items:center;gap:14px;padding:16px 18px;background:var(--tl5);border:1px solid var(--tl2);border-radius:14px;}
.ty-qr-icon{width:44px;height:44px;border-radius:999px;background:var(--tl);color:#fff;display:grid;place-items:center;flex-shrink:0;box-shadow:0 4px 12px -4px rgba(var(--accent-rgb,14,117,86),.40);}
.ty-qr-body{flex:1;min-width:0;}
.ty-qr-title{font-size:14px;font-weight:800;color:var(--tl7);margin:0 0 2px;}
.ty-qr-sub{font-size:12.5px;color:var(--f3);margin:0;line-height:1.45;}
/* Email note */
.ty-email-note{display:flex;align-items:flex-start;gap:9px;padding:12px 14px;margin-top:14px;background:var(--inp);border:1px solid var(--bd2);border-radius:10px;font-size:12.5px;color:var(--f3);line-height:1.55;}
.ty-email-note svg{color:var(--tl);flex-shrink:0;margin-top:2px;}
.ty-email-note strong{color:var(--f2);font-weight:700;}
/* Items list */
.ty-items{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:12px;}
.ty-item{display:grid;grid-template-columns:44px 1fr;gap:12px;align-items:start;}
.ty-item-th{width:44px;height:44px;border-radius:8px;background:linear-gradient(135deg,var(--tl5),var(--tl2));border:1px solid var(--bd);display:grid;place-items:center;color:var(--tl);}
.ty-item-info{min-width:0;}
.ty-item-top{display:flex;align-items:baseline;gap:8px;min-width:0;position:relative;}
.ty-item-top[data-tooltip]:hover::after{content:attr(data-tooltip);position:absolute;bottom:calc(100% + 7px);left:0;background:#1e293b;color:#f1f5f9;font-size:12px;font-weight:500;letter-spacing:0;padding:6px 10px;border-radius:7px;white-space:nowrap;max-width:260px;overflow:hidden;text-overflow:ellipsis;z-index:20;pointer-events:none;box-shadow:0 4px 16px rgba(0,0,0,.22);animation:tipIn .15s ease;}
.ty-item-nm{flex:1;min-width:0;font-size:13px;font-weight:600;color:var(--f1);margin:0 0 2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.ty-item-var{font-size:11px;color:var(--f4);margin:0 0 2px;}
.ty-item-qty{font-size:11px;color:var(--f3);margin:0;}
.ty-item-pr{font-size:13px;font-weight:600;color:var(--f2);white-space:nowrap;font-family:monospace;flex-shrink:0;}
/* Summary card (shared with checkout) */
.sum-card{background:#fff;border-radius:16px;box-shadow:var(--sh);padding:22px;display:flex;flex-direction:column;}
.sum-hd{font-family:var(--hf);font-size:14px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--f1);margin:0 0 14px;}
.sum-items{list-style:none;margin:0 0 14px;padding:0 0 12px;border-bottom:1px solid var(--bd);display:flex;flex-direction:column;gap:10px;}
.sum-item{display:grid;grid-template-columns:44px 1fr;gap:12px;align-items:start;}
.s-th{width:44px;height:44px;border-radius:8px;background:linear-gradient(135deg,var(--tl5),var(--tl2));border:1px solid var(--bd);display:grid;place-items:center;color:var(--tl);overflow:hidden;flex-shrink:0;}
.s-th img{width:100%;height:100%;object-fit:cover;}
.s-info{min-width:0;}
.s-top{display:flex;align-items:baseline;gap:8px;min-width:0;position:relative;}
.s-top[data-tooltip]:hover::after{content:attr(data-tooltip);position:absolute;bottom:calc(100% + 7px);left:0;background:#1e293b;color:#f1f5f9;font-size:12px;font-weight:500;letter-spacing:0;padding:6px 10px;border-radius:7px;white-space:nowrap;max-width:260px;overflow:hidden;text-overflow:ellipsis;z-index:20;pointer-events:none;box-shadow:0 4px 16px rgba(0,0,0,.22);animation:tipIn .15s ease;}
@keyframes tipIn{from{opacity:0;transform:translateY(4px);}to{opacity:1;transform:translateY(0);}}
.s-nm{flex:1;min-width:0;font-size:13px;font-weight:600;color:var(--f1);margin:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.s-mt{font-size:11px;color:var(--f3);margin:3px 0 0;}
.s-qty{display:inline-block;padding:1px 6px;background:var(--inp);border-radius:999px;font-size:10px;color:var(--f2);margin-right:4px;font-family:monospace;}
.s-pr{font-size:12.5px;font-weight:600;color:var(--f2);white-space:nowrap;font-family:monospace;flex-shrink:0;}
.sum-row{display:flex;align-items:baseline;justify-content:space-between;gap:12px;font-size:13px;padding:4px 0;}
.sr-l{color:var(--f3);}
.sr-v{font-family:monospace;font-weight:500;color:var(--f2);white-space:nowrap;flex-shrink:0;}
.sum-total{display:flex;align-items:baseline;justify-content:space-between;gap:10px;margin:14px 0 0;padding-top:16px;border-top:1px solid var(--bd);}
.st-l{font-family:var(--hf);font-size:14px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--f1);}
.st-v{font-family:var(--hf);font-size:28px;font-weight:800;letter-spacing:-.01em;color:var(--tl);white-space:nowrap;flex-shrink:0;}
.st-ccy{font-size:13px;font-family:monospace;font-weight:500;color:var(--tl);margin-right:4px;}
/* Status banner */
.ty-status{display:flex;align-items:center;gap:10px;margin-top:14px;padding:12px 14px;border-radius:10px;}
.ty-status.tone-amber{background:#fff4dc;border:1px solid #f1d693;}
.ty-status.tone-amber .ty-dot{background:#8a5c0a;}
.ty-status.tone-amber .ty-s1{color:#8a5c0a;}
.ty-status.tone-amber .ty-s2{color:#6a4807;}
.ty-status.tone-teal{background:var(--tl5);border:1px solid var(--tl2);}
.ty-status.tone-teal .ty-dot{background:var(--tl);animation-name:pulseTeal;}
.ty-status.tone-teal .ty-s1{color:var(--tl7);}
.ty-status.tone-teal .ty-s2{color:#0a5a40;}
.ty-status.tone-blue{background:#e6f0ff;border:1px solid #c4daff;}
.ty-status.tone-blue .ty-dot{background:#2563eb;animation-name:pulseBlue;}
.ty-status.tone-blue .ty-s1{color:#1e40af;}
.ty-status.tone-blue .ty-s2{color:#1d4ed8;}
.ty-dot{width:8px;height:8px;border-radius:999px;flex-shrink:0;animation:pulseAmber 2s ease-in-out infinite;}
@keyframes pulseAmber{0%,100%{box-shadow:0 0 0 0 rgba(138,92,10,.5);}50%{box-shadow:0 0 0 6px rgba(138,92,10,0);}}
@keyframes pulseTeal{0%,100%{box-shadow:0 0 0 0 rgba(var(--accent-rgb,14,117,86),.45);}50%{box-shadow:0 0 0 6px rgba(var(--accent-rgb,14,117,86),0);}}
@keyframes pulseBlue{0%,100%{box-shadow:0 0 0 0 rgba(37,99,235,.45);}50%{box-shadow:0 0 0 6px rgba(37,99,235,0);}}
.ty-s1{font-size:12.5px;font-weight:800;letter-spacing:.01em;margin:0;}
.ty-s2{font-size:11.5px;margin:2px 0 0;}
/* Meta */
.ty-meta{display:flex;flex-direction:column;gap:8px;margin:14px 0 18px;padding:14px 4px 0;border-top:1px solid var(--bd);}
.ty-mr{display:flex;align-items:flex-start;gap:8px;font-size:12px;color:var(--f3);line-height:1.45;}
.ty-mr svg{color:var(--tl);margin-top:2px;flex-shrink:0;}
.ty-mr strong{color:var(--f2);font-weight:700;}
/* CTAs */
.ty-ctas{display:flex;flex-direction:column;gap:8px;margin-bottom:12px;}
.ty-cta{display:flex;align-items:center;justify-content:center;gap:8px;height:44px;border-radius:10px;font-size:13.5px;font-weight:700;text-decoration:none;transition:all .15s;}
.ty-cta.primary{background:var(--tl);color:#fff;box-shadow:0 4px 12px -4px rgba(var(--accent-rgb,14,117,86),.40);}
.ty-cta.primary:hover{background:var(--tl7);}
.sum-trust{display:flex;align-items:center;justify-content:center;gap:6px;font-size:10.5px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--f3);}
/* Mobile */
@media(max-width:768px){
  .ty-hd{padding:14px 16px;}
  .ty-crumbs{display:none;}
  .ty-shell{grid-template-columns:1fr;padding:16px;gap:16px;}
  .ty-left{order:1;}
  .ty-right{order:2;position:static;}
  .ty-hero{padding:28px 18px 22px;}
  .ty-check-wrap{width:68px;height:68px;margin-bottom:14px;}
  .ty-hero-title{font-size:22px;}
  .ty-hero-sub{font-size:13px;}
  .ty-block{padding:18px 16px;}
  .ty-order-row{flex-wrap:wrap;justify-content:center;}
  .ty-badge{margin-left:0;}
  .ty-cod-card{flex-wrap:wrap;padding:16px;gap:12px;}
  .sum-card{padding:18px 16px;border-radius:14px;}
  .st-v{font-size:22px;}
}
`
