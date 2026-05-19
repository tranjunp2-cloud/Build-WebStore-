import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getPayload } from 'payload'
import config from '@payload-config'
import { resolveTheme, generateThemeCSS } from '@/lib/theme/resolve'
import {
    ArrowLeft, Check, ChevronRight, ShieldCheck,
    Banknote, Clock, Mail, Calendar, ShoppingBag,
    Truck, MapPin, Hash, CreditCard, Info,
} from 'lucide-react'

function formatPrice(price: number, currency: string) {
    if (currency === 'MYR') return `RM ${price.toFixed(2)}`
    if (currency === 'SGD') return `S$${price.toFixed(2)}`
    return `$${price.toFixed(2)}`
}

function maskEmail(email: string) {
    const [user, domain] = email.split('@')
    return `${user.slice(0, 2)}**@${domain}`
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
    stripePaymentIntentId?: string
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

    const siteResult = await payload.find({
        collection: 'sites',
        where: { slug: { equals: slug } },
        limit: 1,
        overrideAccess: true,
        depth: 1,
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

    const pc = (site as any).paymentConfig ?? {}
    const bankName: string = pc.bankName ?? ''
    const bankAccountNo: string = pc.bankAccountNo ?? ''
    const bankAccountHolder: string = pc.bankAccountHolder ?? ''
    const _qr = pc.merchantQrCode
    const merchantQrUrl: string = (_qr && typeof _qr === 'object') ? (_qr.url ?? '') : ''

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
    const isBT = order.paymentMethod === 'bank_transfer'
    const isCod = order.paymentMethod === 'cod'
    const isStripe = !isBT && !isCod

    const addr = order.shippingAddress
    const addrLine = [addr?.city, addr?.state, addr?.postcode].filter(Boolean).join(', ')
    const placed = new Date().toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' })
    const maskedEmail = maskEmail(order.customerEmail)

    const heroTone = isBT ? 'warning' : isCod ? 'blue' : ''
    const heroTitle = isBT ? 'Order placed — Awaiting payment' : 'Order Successfully Placed!'
    const heroSub = isBT
        ? 'Please complete your bank transfer and upload the receipt via the link we sent to your email to avoid order cancellation.'
        : isCod
            ? 'Your order is reserved. Our team will verify your address by phone, then dispatch it for cash-on-delivery.'
            : 'Your payment was processed successfully. Sit tight — we are getting your order ready for shipment.'

    const badgeLabel = isBT ? 'Awaiting Payment' : isCod ? 'Cash on Delivery' : 'Paid'
    const badgeTone = isBT ? 'amber' : isCod ? 'blue' : 'teal'

    const sumStatus = isBT
        ? { tone: 'amber', s1: 'Action Required — Upload Receipt', s2: "We can't ship until your transfer is verified." }
        : isCod
            ? { tone: 'blue', s1: 'Pending phone verification', s2: "We'll call to confirm your address." }
            : { tone: 'teal', s1: 'Payment received · Processing', s2: 'Warehouse is preparing your parcel.' }

    const shipsText = isCod ? 'After phone verification' : isBT ? 'Within 24 h after verification' : 'Within 24 h'

    return (
        <>
            <link rel="preconnect" href="https://fonts.googleapis.com" />
            <link crossOrigin="anonymous" href="https://fonts.gstatic.com" rel="preconnect" />
            {/* eslint-disable-next-line @next/next/no-page-custom-font */}
            <link rel="stylesheet" href={googleFontsHref} />
            {themeCSS && <style dangerouslySetInnerHTML={{ __html: themeCSS }} />}

            <div className="ty-page">

                {/* ── Header ── */}
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
                    <div className="ty-left">

                        {/* ── Hero ── */}
                        <div className={`ty-hero${isBT ? ' pending' : ''}`}>
                            <div className="ty-check-wrap">
                                <span className="ty-ring r1" aria-hidden="true" />
                                <span className="ty-ring r2" aria-hidden="true" />
                                <div className={`ty-check${heroTone ? ` ${heroTone}` : ''}`}>
                                    {isBT ? <Clock size={36} strokeWidth={2.5} /> : isCod ? <Banknote size={36} strokeWidth={2} /> : <Check size={36} strokeWidth={3} />}
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
                                    {isBT && <Clock size={11} />}
                                    {isCod && <Banknote size={11} />}
                                    {isStripe && <Check size={11} />}
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
                                        <span className="ccy">{currency === 'MYR' ? 'RM' : currency === 'SGD' ? 'S$' : '$'}</span>
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
                                                <span className="ty-bk-lbl">Reference</span>
                                                <span className="ty-bk-val mono accent">{order.orderNumber}</span>
                                                <button className="ty-copy-btn-row" data-copy={order.orderNumber} aria-label="Copy order reference">
                                                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2" /><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" /></svg>
                                                    Copy
                                                </button>
                                            </li>
                                        </ul>
                                        <div className="ty-memo-note">
                                            <Info size={13} />
                                            <span>Please paste this <strong>Reference / Order ID</strong> into your bank transfer&apos;s <strong>description</strong> field — it&apos;s how we match your payment to this order.</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* ── Bank Transfer: Upload Receipt (email link) ── */}
                        {isBT && (
                            <div className="ty-block ty-block-compact">
                                <div className="ty-block-hd ty-block-hd-compact">
                                    <span className="ty-block-num">02</span>
                                    <div className="ty-block-titles"><h3>Upload Payment Receipt</h3></div>
                                    <span className="ty-step-pill pending">
                                        <Clock size={11} /> Action required
                                    </span>
                                </div>
                                <div className="ty-email-sent">
                                    <div className="ty-es-icon"><Mail size={22} /></div>
                                    <div className="ty-es-body">
                                        <p className="ty-es-title">Receipt upload link sent to <strong>{maskedEmail}</strong></p>
                                        <p className="ty-es-sub">Open the email and tap the upload link to submit your payment receipt. The link expires in 24 hours — please upload promptly to avoid order cancellation.</p>
                                    </div>
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
                                    <span className="ty-step-pill done">
                                        <Check size={11} /> Confirmed
                                    </span>
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

                    {/* ── Summary ── */}
                    <div className="ty-right">
                        <div className="sum-card">
                            <h3 className="sum-hd">Order Summary</h3>
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
                                <span className="st-v"><span className="st-ccy">{currency === 'MYR' ? 'RM' : currency === 'SGD' ? 'S$' : '$'}</span>{order.total.toFixed(2)}</span>
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
                            </div>
                            <div className="sum-trust"><ShieldCheck size={11} /> Encrypted Checkout · Order Locked</div>
                        </div>
                    </div>
                </div>

                <style>{TY_CSS}</style>
            </div>

            <script dangerouslySetInnerHTML={{ __html: COPY_SCRIPT }} />
        </>
    )
}

const COPY_SCRIPT = `
(function(){
  var ICON_COPY='<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>';
  var ICON_OK='<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
  document.querySelectorAll('[data-copy]').forEach(function(btn){
    btn.addEventListener('click',function(){
      var txt=this.dataset.copy;
      if(!txt)return;
      var el=this;
      var orig=el.innerHTML;
      navigator.clipboard.writeText(txt).then(function(){
        el.innerHTML=ICON_OK+' Copied!';
        el.classList.add('copied');
        setTimeout(function(){el.innerHTML=orig;el.classList.remove('copied');},1500);
      });
    });
  });
})();
`

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
.ty-hd{position:sticky;top:0;z-index:4;background:#fff;border-bottom:1px solid var(--bd);padding:18px 28px;display:flex;align-items:center;gap:14px;}
.ty-back{width:36px;height:36px;border-radius:10px;background:var(--inp);border:1px solid var(--bd);display:grid;place-items:center;color:var(--f2);text-decoration:none;flex-shrink:0;transition:background .15s;}
.ty-back:hover{background:#e3e7ec;}
.ty-h1{font-family:var(--hf);font-size:18px;font-weight:800;letter-spacing:-.005em;margin:0;color:var(--f1);}
.ty-crumbs{font-size:12px;color:var(--f3);margin-left:auto;display:flex;align-items:center;gap:8px;}
.ty-crumbs strong{color:var(--tl);font-weight:700;}
.ty-ssl{display:inline-flex;align-items:center;gap:6px;padding:5px 12px;font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--tl);background:var(--tl5);border:1px solid var(--tl2);border-radius:999px;margin-left:8px;}
.ty-shell{flex:1;display:grid;grid-template-columns:minmax(0,1fr) 360px;gap:28px;padding:28px;align-items:start;}
.ty-left{display:flex;flex-direction:column;gap:18px;}
.ty-right{position:sticky;top:90px;align-self:start;}
/* Hero */
.ty-hero{background:#fff;border-radius:16px;box-shadow:var(--sh);padding:36px 28px 28px;text-align:center;position:relative;overflow:hidden;}
.ty-hero::before{content:"";position:absolute;inset:-40% 30% auto 30%;height:180px;background:radial-gradient(ellipse at center,var(--tl5) 0%,transparent 70%);pointer-events:none;}
.ty-hero.pending::before{background:radial-gradient(ellipse at center,#fff4dc 0%,transparent 70%);}
.ty-check-wrap{position:relative;width:84px;height:84px;margin:0 auto 18px;}
.ty-check{position:absolute;inset:0;border-radius:999px;background:linear-gradient(135deg,var(--tl) 0%,var(--tl7) 100%);display:grid;place-items:center;color:#fff;box-shadow:0 0 0 6px #fff,0 0 0 7px var(--tl2),0 16px 30px -10px rgba(var(--accent-rgb,14,117,86),.40);animation:tyCheckPop 520ms cubic-bezier(.22,1,.36,1);}
.ty-check.warning{background:linear-gradient(135deg,#f59e0b 0%,#d97706 100%);box-shadow:0 0 0 6px #fff,0 0 0 7px #fde0a8,0 16px 30px -10px rgba(217,119,6,.40);animation:tyCheckPop 520ms cubic-bezier(.22,1,.36,1),tyWarnPulse 2.4s ease-in-out 520ms infinite;}
.ty-check.blue{background:linear-gradient(135deg,#3b82f6 0%,#2563eb 100%);box-shadow:0 0 0 6px #fff,0 0 0 7px #c4daff,0 16px 30px -10px rgba(37,99,235,.42);}
@keyframes tyCheckPop{0%{transform:scale(.6);opacity:0;}60%{transform:scale(1.08);opacity:1;}100%{transform:scale(1);}}
@keyframes tyWarnPulse{0%,100%{box-shadow:0 0 0 6px #fff,0 0 0 7px #fde0a8,0 16px 30px -10px rgba(217,119,6,.40),0 0 0 0 rgba(245,158,11,.40);}50%{box-shadow:0 0 0 6px #fff,0 0 0 7px #fde0a8,0 16px 30px -10px rgba(217,119,6,.40),0 0 0 10px rgba(245,158,11,0);}}
.ty-ring{position:absolute;inset:0;border-radius:999px;border:2px solid rgba(var(--accent-rgb,14,117,86),.55);opacity:0;pointer-events:none;animation:tyRing 2.4s ease-out infinite;}
.ty-ring.r2{animation-delay:1.2s;}
@keyframes tyRing{0%{transform:scale(.95);opacity:.55;}100%{transform:scale(1.7);opacity:0;}}
.ty-hero-title{font-family:var(--hf);font-size:26px;font-weight:800;letter-spacing:-.01em;color:var(--f1);margin:0 0 12px;position:relative;}
.ty-hero-order{display:inline-flex;align-items:center;gap:8px;padding:7px 10px 7px 14px;background:var(--inp);border:1px solid var(--bd);border-radius:999px;font-size:12px;font-weight:600;color:var(--f3);margin:0 0 14px;position:relative;letter-spacing:.02em;}
.ty-order-id{font-family:monospace;color:var(--f1);font-weight:700;font-size:13px;letter-spacing:0;}
.ty-hero-badge{display:inline-flex;align-items:center;gap:5px;margin-left:6px;padding:4px 9px;border-radius:999px;font-size:11px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;white-space:nowrap;border:1px solid;}
.ty-hero-badge.tone-amber{background:#fff4dc;border-color:#f1d693;color:#8a5c0a;}
.ty-hero-badge.tone-teal{background:var(--tl5);border-color:var(--tl2);color:var(--tl7);}
.ty-hero-badge.tone-blue{background:#e6f0ff;border-color:#c4daff;color:#1e40af;}
.ty-copy-btn{width:24px;height:24px;border-radius:999px;background:#fff;border:1px solid var(--bd);color:var(--f2);display:grid;place-items:center;transition:all .14s;cursor:pointer;}
.ty-copy-btn:hover,.ty-copy-btn.copied{background:var(--tl5);color:var(--tl);border-color:var(--tl2);}
.ty-hero-sub{font-size:14px;line-height:1.6;color:var(--f3);max-width:520px;margin:0 auto;position:relative;}
/* Block card */
.ty-block{background:#fff;border-radius:16px;box-shadow:var(--sh);padding:24px 26px;}
.ty-block-compact{padding:18px 22px;}
.ty-block-hd{display:flex;align-items:flex-start;gap:16px;margin-bottom:18px;}
.ty-block-hd-compact{align-items:center;margin-bottom:14px;gap:12px;}
.ty-block-num{font-family:var(--hf);font-size:22px;font-weight:800;color:var(--tl);letter-spacing:-.01em;flex-shrink:0;line-height:1;padding-top:2px;width:30px;}
.ty-block-hd-compact .ty-block-num{font-size:18px;padding-top:0;width:24px;}
.ty-block-titles{flex:1;min-width:0;}
.ty-block-titles h3{font-family:var(--hf);font-size:17px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:var(--f1);margin:0 0 4px;}
.ty-block-hd-compact .ty-block-titles h3{font-size:15px;letter-spacing:.06em;}
.ty-block-titles p{font-size:12.5px;color:var(--f3);margin:0;line-height:1.5;}
/* Amount chip */
.ty-amount-chip{display:inline-flex;align-items:baseline;gap:4px;padding:7px 13px;background:var(--tl5);border:1px solid var(--tl2);border-radius:999px;font-family:var(--hf);font-size:16px;font-weight:800;color:var(--tl7);flex-shrink:0;white-space:nowrap;}
.ty-amount-chip .ccy{font-size:11px;font-weight:700;opacity:.7;}
/* Step pills */
.ty-step-pill{display:inline-flex;align-items:center;gap:5px;padding:5px 10px;border-radius:999px;font-size:11px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;white-space:nowrap;flex-shrink:0;}
.ty-step-pill.pending{background:#fff4dc;border:1px solid #f1d693;color:#8a5c0a;}
.ty-step-pill.done{background:var(--tl5);border:1px solid var(--tl2);color:var(--tl7);}
.ty-step-pill.blue{background:#e6f0ff;border:1px solid #c4daff;color:#1e40af;}
/* Bank Transfer layout */
.ty-bank-top{display:grid;grid-template-columns:minmax(180px,220px) minmax(0,1fr);gap:12px;align-items:stretch;margin-top:4px;}
.ty-qr-side{display:flex;flex-direction:column;align-items:center;gap:8px;padding:14px;background:var(--inp);border:1px solid var(--bd);border-radius:12px;}
.ty-qr-img{width:128px;height:128px;border-radius:6px;object-fit:contain;}
.ty-qr-ph{width:128px;height:128px;display:grid;place-items:center;background:#fff;border:2px dashed var(--tlb);border-radius:8px;color:var(--tl);}
.ty-qr-hint{font-size:10.5px;color:var(--f3);text-align:center;line-height:1.4;}
.ty-bank-side{display:flex;flex-direction:column;gap:0;}
.ty-bank-rows{list-style:none;margin:0;padding:0;background:#fff;border:1px solid var(--bd);border-radius:12px;overflow:hidden;}
.ty-bank-row{display:grid;grid-template-columns:110px 1fr auto;gap:10px;align-items:center;padding:9px 14px;min-height:38px;}
.ty-bank-row+.ty-bank-row{border-top:1px solid var(--bd2);}
.ty-bk-lbl{font-size:10.5px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:var(--f3);}
.ty-bk-val{font-size:12.5px;font-weight:600;color:var(--f1);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.ty-bk-val.mono{font-family:monospace;letter-spacing:.02em;}
.ty-bk-val.accent{color:var(--tl7);font-weight:700;}
.ty-copy-btn-row{display:inline-flex;align-items:center;gap:5px;padding:4px 9px;font-size:11px;font-weight:700;color:var(--f2);background:#fff;border:1px solid var(--bd);border-radius:7px;transition:all .14s;cursor:pointer;white-space:nowrap;flex-shrink:0;}
.ty-copy-btn-row:hover,.ty-copy-btn-row.copied{background:var(--tl5);color:var(--tl);border-color:var(--tl2);}
.ty-memo-note{display:flex;align-items:flex-start;gap:8px;margin-top:10px;padding:9px 12px;background:color-mix(in srgb,var(--tl) 7%,var(--inp));border:1px solid color-mix(in srgb,var(--tl) 28%,var(--bd2));border-radius:10px;font-size:11.5px;line-height:1.5;color:var(--f3);}
.ty-memo-note svg{color:var(--tl);flex-shrink:0;margin-top:2px;}
.ty-memo-note strong{color:var(--f1);font-weight:700;}
/* BT email-sent card */
.ty-email-sent{display:flex;align-items:flex-start;gap:14px;padding:16px 18px;background:var(--tl5);border:1px solid var(--tl2);border-radius:14px;}
.ty-es-icon{width:44px;height:44px;border-radius:999px;background:var(--tl);color:#fff;display:grid;place-items:center;flex-shrink:0;box-shadow:0 4px 12px -4px rgba(var(--accent-rgb,14,117,86),.40);}
.ty-es-title{font-size:13.5px;font-weight:800;color:var(--tl7);margin:0 0 4px;line-height:1.4;}
.ty-es-title strong{color:var(--f1);}
.ty-es-sub{font-size:12.5px;color:var(--f3);margin:0;line-height:1.5;}
/* Stripe paid card */
.ty-paid-card{display:flex;align-items:center;gap:14px;padding:16px 18px;background:var(--tl5);border:1px solid var(--tl2);border-radius:14px;}
.ty-paid-icon{width:44px;height:44px;border-radius:999px;background:var(--tl);color:#fff;display:grid;place-items:center;flex-shrink:0;box-shadow:0 4px 12px -4px rgba(var(--accent-rgb,14,117,86),.40);}
.ty-paid-body{flex:1;min-width:0;}
.ty-paid-title{font-size:14px;font-weight:600;color:var(--f1);line-height:1.5;margin:0 0 3px;}
.ty-paid-title strong{color:var(--tl7);font-weight:800;}
.ty-paid-sub{font-size:12px;color:var(--f3);margin:0;}
.ty-paid-brands{display:flex;align-items:center;gap:5px;flex-shrink:0;}
.ty-brand{display:inline-flex;align-items:center;justify-content:center;height:22px;border-radius:4px;font-size:9px;font-weight:900;letter-spacing:.04em;border:1px solid;}
.ty-brand.visa{width:36px;background:#1a1f71;color:#fff;border-color:#1a1f71;}
.ty-brand.mc{width:30px;background:transparent;border-color:var(--bd);gap:0;padding:0 4px;}
.ty-brand.mc .mc-c{width:14px;height:14px;border-radius:999px;}
.ty-brand.mc .mc-c:first-child{background:#eb001b;margin-right:-6px;}
.ty-brand.mc .mc-c:last-child{background:#f79e1b;}
.ty-brand.amex{width:36px;background:#016fcf;color:#fff;border-color:#016fcf;}
.ty-brand.fpx{width:32px;background:#f60;color:#fff;border-color:#f60;}
.ty-paid-meta{list-style:none;margin:12px 0 0;padding:0;background:#fff;border:1px solid var(--bd);border-radius:12px;overflow:hidden;}
.ty-paid-meta li{display:grid;grid-template-columns:140px 1fr auto;gap:10px;align-items:center;padding:10px 14px;min-height:40px;}
.ty-pm-lbl{display:inline-flex;align-items:center;gap:6px;font-size:11px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:var(--f3);}
.ty-pm-val{font-size:12.5px;color:var(--f1);font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.ty-pm-val.mono{font-family:monospace;letter-spacing:.01em;}
/* COD card */
.ty-cod-card{display:flex;align-items:center;gap:16px;padding:20px;background:#f5f8ff;border:1px solid #d6e2fb;border-radius:14px;}
.ty-cod-icon{width:52px;height:52px;border-radius:14px;background:linear-gradient(135deg,#3b82f6,#2563eb);color:#fff;display:grid;place-items:center;flex-shrink:0;box-shadow:0 6px 18px -6px rgba(37,99,235,.45);}
.ty-cod-body{flex:1;min-width:0;}
.ty-cod-title{font-size:15px;font-weight:700;color:var(--f1);line-height:1.45;margin:0 0 4px;}
.ty-cod-title strong{font-weight:800;color:#1e3a8a;background:rgba(59,130,246,.10);padding:1px 7px;border-radius:6px;font-family:monospace;}
.ty-cod-sub{font-size:12.5px;color:var(--f3);margin:0;line-height:1.55;}
.ty-cod-tips{list-style:none;margin:14px 0 0;padding:0;display:flex;flex-direction:column;gap:8px;}
.ty-cod-tips li{display:flex;align-items:flex-start;gap:10px;padding:10px 14px;background:var(--inp);border:1px solid var(--bd2);border-radius:10px;font-size:12.5px;color:var(--f2);line-height:1.5;}
.ty-cod-tips svg{color:var(--tl);margin-top:2px;flex-shrink:0;}
/* Email note */
.ty-email-note{display:flex;align-items:flex-start;gap:9px;padding:12px 14px;margin-top:14px;background:var(--inp);border:1px solid var(--bd2);border-radius:10px;font-size:12.5px;color:var(--f3);line-height:1.55;}
.ty-email-note svg{color:var(--tl);flex-shrink:0;margin-top:2px;}
.ty-email-note strong{color:var(--f2);font-weight:700;}
/* Items */
.ty-items{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:12px;}
.ty-item{display:grid;grid-template-columns:44px 1fr;gap:12px;align-items:start;}
.ty-item-th{width:44px;height:44px;border-radius:8px;background:linear-gradient(135deg,var(--tl5),var(--tl2));border:1px solid var(--bd);display:grid;place-items:center;color:var(--tl);}
.ty-item-info{min-width:0;}
.ty-item-top{display:flex;align-items:baseline;gap:8px;min-width:0;position:relative;}
.ty-item-top[data-tooltip]:hover::after{content:attr(data-tooltip);position:absolute;bottom:calc(100% + 7px);left:0;background:#1e293b;color:#f1f5f9;font-size:12px;font-weight:500;padding:6px 10px;border-radius:7px;white-space:nowrap;max-width:260px;overflow:hidden;text-overflow:ellipsis;z-index:20;pointer-events:none;box-shadow:0 4px 16px rgba(0,0,0,.22);}
.ty-item-nm{flex:1;min-width:0;font-size:13px;font-weight:600;color:var(--f1);margin:0 0 2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.ty-item-var{font-size:11px;color:var(--f4);margin:0 0 2px;}
.ty-item-qty{font-size:11px;color:var(--f3);margin:0;}
.ty-item-pr{font-size:13px;font-weight:600;color:var(--f2);white-space:nowrap;font-family:monospace;flex-shrink:0;}
/* Summary */
.sum-card{background:#fff;border-radius:16px;box-shadow:var(--sh);padding:22px;display:flex;flex-direction:column;}
.sum-hd{font-family:var(--hf);font-size:14px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--f1);margin:0 0 14px;}
.sum-items{list-style:none;margin:0 0 14px;padding:0 0 12px;border-bottom:1px solid var(--bd);display:flex;flex-direction:column;gap:10px;}
.sum-item{display:grid;grid-template-columns:44px 1fr;gap:12px;align-items:start;}
.s-th{width:44px;height:44px;border-radius:8px;background:linear-gradient(135deg,var(--tl5),var(--tl2));border:1px solid var(--bd);display:grid;place-items:center;color:var(--tl);overflow:hidden;flex-shrink:0;}
.s-info{min-width:0;}
.s-top{display:flex;align-items:baseline;gap:8px;min-width:0;position:relative;}
.s-top[data-tooltip]:hover::after{content:attr(data-tooltip);position:absolute;bottom:calc(100% + 7px);left:0;background:#1e293b;color:#f1f5f9;font-size:12px;padding:6px 10px;border-radius:7px;white-space:nowrap;max-width:260px;overflow:hidden;text-overflow:ellipsis;z-index:20;pointer-events:none;}
@keyframes tipIn{from{opacity:0;transform:translateY(4px);}to{opacity:1;transform:translateY(0);}}
.s-nm{flex:1;min-width:0;font-size:13px;font-weight:600;color:var(--f1);margin:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.s-mt{font-size:11px;color:var(--f3);margin:3px 0 0;}
.s-qty{display:inline-block;padding:1px 6px;background:var(--inp);border-radius:999px;font-size:10px;color:var(--f2);margin-right:4px;font-family:monospace;}
.s-pr{font-size:12.5px;font-weight:600;color:var(--f2);white-space:nowrap;font-family:monospace;flex-shrink:0;}
.sum-row{display:flex;align-items:baseline;justify-content:space-between;gap:12px;font-size:13px;padding:4px 0;}
.sr-l{color:var(--f3);}
.sr-v{font-family:monospace;font-weight:500;color:var(--f2);white-space:nowrap;}
.sum-total{display:flex;align-items:baseline;justify-content:space-between;gap:10px;margin:14px 0 0;padding-top:16px;border-top:1px solid var(--bd);}
.st-l{font-family:var(--hf);font-size:14px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--f1);}
.st-v{font-family:var(--hf);font-size:28px;font-weight:800;letter-spacing:-.01em;color:var(--tl);white-space:nowrap;}
.st-ccy{font-size:13px;font-family:monospace;font-weight:500;color:var(--tl);margin-right:4px;}
/* Summary status */
.ty-sum-status{display:flex;align-items:center;gap:10px;margin-top:14px;padding:12px 14px;border-radius:10px;}
.ty-sum-status.tone-amber{background:#fff4dc;border:1px solid #f1d693;}
.ty-sum-status.tone-amber .ty-dot{background:#8a5c0a;animation-name:pulseAmber;}
.ty-sum-status.tone-amber .ty-s1{color:#8a5c0a;}
.ty-sum-status.tone-amber .ty-s2{color:#6a4807;}
.ty-sum-status.tone-teal{background:var(--tl5);border:1px solid var(--tl2);}
.ty-sum-status.tone-teal .ty-dot{background:var(--tl);animation-name:pulseTeal;}
.ty-sum-status.tone-teal .ty-s1{color:var(--tl7);}
.ty-sum-status.tone-teal .ty-s2{color:#0a5a40;}
.ty-sum-status.tone-blue{background:#e6f0ff;border:1px solid #c4daff;}
.ty-sum-status.tone-blue .ty-dot{background:#2563eb;animation-name:pulseBlue;}
.ty-sum-status.tone-blue .ty-s1{color:#1e40af;}
.ty-sum-status.tone-blue .ty-s2{color:#1d4ed8;}
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
  .ty-block-compact{padding:16px 14px;}
  .ty-hero-order{flex-wrap:wrap;justify-content:center;}
  .ty-hero-badge{margin-left:0;}
  .ty-bank-top{grid-template-columns:1fr;gap:12px;}
  .ty-cod-card{flex-wrap:wrap;padding:16px;gap:12px;}
  .ty-paid-card{flex-wrap:wrap;padding:14px;gap:10px;}
  .ty-paid-brands{width:100%;justify-content:flex-start;}
  .ty-paid-meta li{grid-template-columns:1fr;gap:4px;padding:10px 14px;}
  .sum-card{padding:18px 16px;border-radius:14px;}
  .st-v{font-size:22px;}
}
`
