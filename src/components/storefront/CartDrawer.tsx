'use client'

import { useCartStore, type CartItem } from '@/store/cartStore'
import { X, Minus, Plus, Trash2, ShoppingBag } from 'lucide-react'
import { toast } from 'sonner'
import { trackEvent } from '@/lib/analytics/track-event'
import { useIsOwner } from '@/components/site-renderer/OwnerContext'
import { useI18n } from '@/i18n'

function formatPrice(price: number, currency: string) {
    if (currency === 'MYR') return `RM ${price.toFixed(2)}`
    if (currency === 'SGD') return `S$${price.toFixed(2)}`
    return `$${price.toFixed(2)}`
}

export function CartDrawer({ siteSlug, siteId }: { siteSlug: string; siteId?: string }) {
    const { items, isOpen, closeCart, removeItem, updateQuantity, subtotal, itemCount } = useCartStore()
    const isOwner = useIsOwner()
    const { t } = useI18n()
    const hasCheckoutRoute = Boolean(siteSlug)

    if (!isOpen) return null

    const currency = items[0]?.currency || 'MYR'

    return (
        <>
            {/* Backdrop */}
            <div onClick={closeCart}
                style={{
                    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
                    zIndex: 998, transition: 'opacity 0.2s',
                }} />

            {/* Drawer */}
            <div style={{
                position: 'fixed', top: 0, right: 0, bottom: 0, width: '400px', maxWidth: '100vw',
                background: 'white', zIndex: 999, display: 'flex', flexDirection: 'column',
                boxShadow: '-4px 0 24px rgba(0,0,0,0.1)',
            }}>
                {/* Header */}
                <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '20px 24px', borderBottom: '1px solid #eee',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <ShoppingBag size={20} />
                        <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0 }}>
                            {t.storefront.cart.title} ({itemCount()})
                        </h2>
                    </div>
                    <button onClick={closeCart} style={{
                        background: 'none', border: 'none', cursor: 'pointer', padding: '4px',
                    }}>
                        <X size={20} color="#999" />
                    </button>
                </div>

                {/* Items */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
                    {items.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '48px 0', color: '#999' }}>
                            <ShoppingBag size={48} style={{ opacity: 0.3, margin: '0 auto 16px' }} />
                            <p>{t.storefront.cart.empty}</p>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            {items.map(item => (
                                <div key={item.productId} style={{
                                    display: 'flex', gap: '12px', padding: '12px',
                                    borderRadius: '12px', border: '1px solid #f0f0f0',
                                }}>
                                    {/* Image */}
                                    <div style={{
                                        width: '64px', height: '64px', borderRadius: '8px',
                                        background: '#f8f8f8', flexShrink: 0, overflow: 'hidden',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    }}>
                                        {item.imageUrl ? (
                                            <img src={item.imageUrl} alt={item.name}
                                                style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                        ) : (
                                            <span style={{ fontSize: '24px', opacity: 0.2 }}>📦</span>
                                        )}
                                    </div>

                                    {/* Details */}
                                    <div style={{ flex: 1 }}>
                                        <p style={{ fontSize: '14px', fontWeight: 600, margin: '0 0 4px' }}>{item.name}</p>
                                        <p style={{ fontSize: '14px', fontWeight: 700, color: '#111', margin: '0 0 8px' }}>
                                            {formatPrice(item.price, item.currency)}
                                        </p>

                                        {/* Quantity */}
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <button onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                                                style={{
                                                    width: '28px', height: '28px', borderRadius: '6px',
                                                    border: '1px solid #eee', background: 'white',
                                                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                }}>
                                                <Minus size={12} />
                                            </button>
                                            <span style={{ fontSize: '14px', fontWeight: 600, minWidth: '20px', textAlign: 'center' }}>
                                                {item.quantity}
                                            </span>
                                            {(() => {
                                                const atMax = item.inventory != null && item.quantity >= item.inventory
                                                return atMax ? (
                                                    <span style={{
                                                        fontSize: '10px', fontWeight: 700, color: '#f59e0b',
                                                        background: '#fef3c7', borderRadius: '4px',
                                                        padding: '2px 5px', whiteSpace: 'nowrap',
                                                    }}>MAX</span>
                                                ) : (
                                                    <button onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                                                        style={{
                                                            width: '28px', height: '28px', borderRadius: '6px',
                                                            border: '1px solid #eee', background: 'white',
                                                            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                        }}>
                                                        <Plus size={12} />
                                                    </button>
                                                )
                                            })()}
                                            <button onClick={() => removeItem(item.productId)}
                                                style={{
                                                    marginLeft: 'auto', background: 'none', border: 'none',
                                                    cursor: 'pointer', padding: '4px',
                                                }}>
                                                <Trash2 size={14} color="#ef4444" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                {items.length > 0 && (
                    <div style={{ padding: '20px 24px', borderTop: '1px solid #eee' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                            <span style={{ fontSize: '16px', fontWeight: 600 }}>{t.storefront.cart.subtotal}</span>
                            <span style={{ fontSize: '20px', fontWeight: 700 }}>{formatPrice(subtotal(), currency)}</span>
                        </div>
                        {hasCheckoutRoute ? (
                            <a href={`/sites/${siteSlug}/checkout`}
                                onClick={() => {
                                    if (siteId) trackEvent({
                                        siteId,
                                        event: 'checkout',
                                        metadata: { itemCount: items.length, subtotal: subtotal() },
                                        isOwner,
                                    })
                                }}
                                style={{
                                    display: 'block', background: '#111', color: 'white', textAlign: 'center',
                                    padding: '14px', borderRadius: '12px', fontSize: '15px', fontWeight: 600,
                                    textDecoration: 'none',
                                }}>
                                {t.storefront.cart.proceedToCheckout}
                            </a>
                        ) : (
                            <button
                                type="button"
                                onClick={() => toast.info(t.storefront.cart.checkoutUnavailable)}
                                style={{
                                    display: 'block', width: '100%', background: '#111', color: 'white', textAlign: 'center',
                                    padding: '14px', borderRadius: '12px', fontSize: '15px', fontWeight: 600,
                                    border: 'none', cursor: 'pointer',
                                }}
                            >
                                {t.storefront.cart.proceedToCheckout}
                            </button>
                        )}
                    </div>
                )}
            </div>
        </>
    )
}
