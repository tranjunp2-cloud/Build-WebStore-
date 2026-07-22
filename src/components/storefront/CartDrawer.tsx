'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useCartStore } from '@/store/cartStore'
import { X, Minus, Plus, Trash2, ShoppingCart, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { trackEvent } from '@/lib/analytics/track-event'
import { useIsOwner } from '@/components/site-renderer/OwnerContext'
import { useI18n } from '@/i18n'
import { CSS_VARS } from '@/lib/theme/resolve'

function formatPrice(price: number, currency: string) {
    if (currency === 'MYR') return `RM ${price.toFixed(2)}`
    if (currency === 'SGD') return `S$${price.toFixed(2)}`
    return `$${price.toFixed(2)}`
}

export function CartDrawer({ siteSlug, siteId }: { siteSlug: string; siteId?: string }) {
    const { items, isOpen, closeCart, removeItem, updateQuantity, subtotal, itemCount, siteId: activeSiteId, siteSlug: activeSiteSlug, refreshStatus, refreshCart, changes } = useCartStore()
    const isOwner = useIsOwner()
    const { t } = useI18n()
    const prefersReducedMotion = useReducedMotion()
    const pathname = usePathname()
    const shopBase = pathname.startsWith('/sites/') ? `/sites/${siteSlug}` : ''
    const hasCheckoutRoute = Boolean(siteSlug)
    const checkoutBlocked = refreshStatus !== 'idle' || items.some(item => item.unavailable)

    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden'
        }
        return () => { document.body.style.overflow = '' }
    }, [isOpen])

    useEffect(() => {
        if (isOpen && activeSiteId && activeSiteSlug) void refreshCart()
    }, [activeSiteId, activeSiteSlug, isOpen, refreshCart])

    const currency = items[0]?.currency || 'MYR'
    const ctaBtnStyle: React.CSSProperties = {
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        width: '100%', height: '54px', border: 'none', cursor: 'pointer',
        borderRadius: '10px', fontFamily: CSS_VARS.fontHeading,
        fontSize: '14px', fontWeight: 800, letterSpacing: '.04em', textTransform: 'uppercase',
        background: CSS_VARS.accent, color: '#fff',
        boxShadow: `0 6px 16px -6px rgba(${CSS_VARS.accentRgb}, 0.55)`,
        transition: 'all .15s', textDecoration: 'none', whiteSpace: 'nowrap',
    }

    return (
        <AnimatePresence>
            {isOpen ? (
                <>
                    <motion.div
                        data-testid="cart-drawer-backdrop"
                        initial={prefersReducedMotion ? false : { opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: prefersReducedMotion ? 0 : 0.18, ease: 'easeOut' }}
                        onClick={closeCart}
                        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 998 }}
                    />

                    <motion.aside
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="cart-drawer-title"
                        initial={prefersReducedMotion ? false : { x: '100%' }}
                        animate={{ x: 0 }}
                        exit={prefersReducedMotion ? { x: 0 } : { x: '100%' }}
                        transition={{ duration: prefersReducedMotion ? 0 : 0.24, ease: [0.22, 1, 0.36, 1] }}
                        style={{
                            position: 'fixed', top: 0, right: 0, bottom: 0, width: '410px', maxWidth: '100vw',
                            background: '#ffffff', zIndex: 999, display: 'flex', flexDirection: 'column',
                            padding: '32px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
                            fontFamily: CSS_VARS.fontBody, color: '#191c1d',
                        }}
                    >
                {/* Header */}
                <div style={{ paddingBottom: '40px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <ShoppingCart size={20} style={{ color: CSS_VARS.primary, flexShrink: 0 }} />
                        <div>
                            <h2 id="cart-drawer-title" style={{ fontSize: '20px', fontWeight: 700, margin: 0, color: CSS_VARS.primary, letterSpacing: '-0.5px', lineHeight: '28px', fontFamily: CSS_VARS.fontHeading }}>
                                {t.storefront.cart.drawerTitle} ({itemCount()})
                            </h2>
                            <p style={{ margin: 0, fontSize: '12px', color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.3px', lineHeight: '16px' }}>
                                {t.storefront.cart.subtitle}
                            </p>
                        </div>
                    </div>
                    <button onClick={closeCart} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '8px', borderRadius: '12px' }}>
                        <X size={14} color={'#71717a'} />
                    </button>
                </div>

                <div aria-live="polite" style={{ minHeight: refreshStatus === 'idle' && changes.length === 0 ? 0 : '28px', marginBottom: '12px' }}>
                    {refreshStatus === 'refreshing' && <p role="status" style={{ margin: 0, fontSize: '13px', color: '#71717a', display: 'flex', gap: '6px', alignItems: 'center' }}><Loader2 size={14} className="spin" />{t.storefront.cart.updating}</p>}
                    {refreshStatus === 'error' && <div role="alert" style={{ fontSize: '13px', color: '#b42318' }}>{t.storefront.cart.refreshFailed} <button type="button" onClick={() => void refreshCart()} style={{ border: 0, background: 'none', color: CSS_VARS.primary, fontWeight: 700, cursor: 'pointer' }}>{t.storefront.cart.retry}</button></div>}
                    {refreshStatus === 'idle' && changes.length > 0 && <div role="status" style={{ fontSize: '13px', color: '#166534' }}><p style={{ margin: 0 }}>{t.storefront.cart.changesUpdated}</p>{changes.map(change => change.fields.includes('price') && change.previous && change.current ? <p key={`${change.productId}:${change.variantName ?? ''}:price`} style={{ margin: '4px 0 0' }}>{t.storefront.cart.priceChanged.replace('{from}', formatPrice(change.previous.price, currency)).replace('{to}', formatPrice(change.current.price, currency))}</p> : change.fields.includes('quantity') ? <p key={`${change.productId}:${change.variantName ?? ''}:quantity`} style={{ margin: '4px 0 0' }}>{t.storefront.cart.quantityAdjusted}</p> : null)}</div>}
                </div>

                {/* Items */}
                <div style={{ flex: 1, overflowY: 'auto', paddingRight: '8px' }}>
                    {items.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '48px 0', color: '#71717a' }}>
                            <ShoppingCart size={48} style={{ opacity: 0.3, margin: '0 auto 16px', display: 'block' }} />
                            <p style={{ margin: 0 }}>{t.storefront.cart.empty}</p>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                            {items.map(item => (
                                <div key={`${item.productId}:${item.variantName ?? ''}`} style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                                    {/* Product image */}
                                    <div style={{
                                        width: '96px', height: '128px', flexShrink: 0,
                                        borderRadius: '4px', background: CSS_VARS.surface, overflow: 'hidden',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    }}>
                                        {item.imageUrl
                                            ? <img src={item.imageUrl} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                            : <span style={{ fontSize: '32px', opacity: 0.2 }}>📦</span>}
                                    </div>

                                    {/* Product info */}
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
                                            <div>
                                                <p style={{ fontSize: '16px', fontWeight: 700, color: '#191c1d', margin: 0, lineHeight: '24px', fontFamily: CSS_VARS.fontHeading }}>
                                                    {item.name}
                                                </p>
                                                {item.variantName && (
                                                    <p style={{ fontSize: '12px', color: '#71717a', margin: '2px 0 0' }}>{item.variantName}</p>
                                                )}
                                                {item.unavailable && <p role="alert" style={{ fontSize: '12px', color: '#b42318', margin: '4px 0 0' }}>{t.storefront.cart.itemUnavailable}</p>}
                                            </div>
                                            <button onClick={() => removeItem(item.productId, item.variantName)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', flexShrink: 0, marginLeft: '8px' }}>
                                                <Trash2 size={11} color={'#71717a'} />
                                            </button>
                                        </div>

                                        {/* Qty stepper + price */}
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '12px' }}>
                                            <div style={{
                                                display: 'flex', alignItems: 'center', overflow: 'hidden',
                                                border: `1px solid rgba(var(--brand-primary-rgb, 192,200,199), 0.2)`,
                                                borderRadius: '4px',
                                            }}>
                                                <button
                                                    onClick={() => updateQuantity(item.productId, item.quantity - 1, item.variantName)}
                                                    disabled={item.unavailable}
                                                    style={{ background: 'none', border: 'none', cursor: item.unavailable ? 'not-allowed' : 'pointer', padding: '4px 8px', display: 'flex', alignItems: 'center', color: '#191c1d', opacity: item.unavailable ? 0.3 : 1 }}>
                                                    <Minus size={7} />
                                                </button>
                                                <span style={{ fontSize: '14px', fontWeight: 600, color: '#191c1d', padding: '4px 12px', lineHeight: '20px' }}>
                                                    {item.quantity}
                                                </span>
                                                <button
                                                    onClick={() => updateQuantity(item.productId, item.quantity + 1, item.variantName)}
                                                    disabled={item.unavailable || (item.inventory !== undefined && item.quantity >= item.inventory)}
                                                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px', display: 'flex', alignItems: 'center', color: '#191c1d', opacity: (item.inventory !== undefined && item.quantity >= item.inventory) ? 0.3 : 1 }}>
                                                    <Plus size={7} />
                                                </button>
                                            </div>
                                            <span style={{ fontSize: '16px', fontWeight: 700, color: CSS_VARS.primary, lineHeight: '24px', fontFamily: CSS_VARS.fontHeading }}>
                                                {formatPrice(item.price, item.currency)}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer — always visible so empty-cart state shows disabled checkout */}
                <div style={{ paddingTop: '32px' }}>
                    <div style={{ borderTop: `1px solid ${CSS_VARS.surface}`, paddingTop: '33px' }}>
                        {items.length > 0 && (
                            <>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                    <span style={{ fontSize: '16px', color: '#71717a' }}>{t.storefront.cart.subtotal}</span>
                                    <span style={{ fontSize: '24px', fontWeight: 800, color: '#191c1d', fontFamily: CSS_VARS.fontHeading }}>{formatPrice(subtotal(), currency)}</span>
                                </div>
                                <p style={{ fontSize: '11px', color: '#71717a', margin: '0 0 25px', lineHeight: '1.6' }}>
                                    {t.storefront.cart.shippingNote}
                                </p>
                            </>
                        )}
                        {hasCheckoutRoute && items.length > 0 && !checkoutBlocked ? (
                            <a href={`${shopBase}/checkout`}
                                onClick={() => {
                                    if (siteId) trackEvent({ siteId, event: 'checkout', metadata: { itemCount: items.length, subtotal: subtotal() }, isOwner })
                                }}
                                style={ctaBtnStyle}>
                                {t.storefront.cart.proceedToCheckout.toUpperCase()}
                            </a>
                        ) : (
                            <button
                                type="button"
                                disabled={items.length === 0 || checkoutBlocked}
                                onClick={items.length > 0 && !checkoutBlocked ? () => toast.info(t.storefront.cart.checkoutUnavailable) : undefined}
                                style={{ ...ctaBtnStyle, background: items.length === 0 || checkoutBlocked ? '#d1d5db' : CSS_VARS.accent, color: items.length === 0 || checkoutBlocked ? '#9ca3af' : '#fff', cursor: items.length === 0 || checkoutBlocked ? 'not-allowed' : 'pointer', boxShadow: 'none' }}
                            >
                                {t.storefront.cart.proceedToCheckout.toUpperCase()}
                            </button>
                        )}
                    </div>
                </div>
                    </motion.aside>
                </>
            ) : null}
        </AnimatePresence>
    )
}
