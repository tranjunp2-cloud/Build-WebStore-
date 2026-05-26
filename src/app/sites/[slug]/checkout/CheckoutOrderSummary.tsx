'use client'

import { ShoppingBag, Truck, Info, Lock, ShieldCheck, Loader2, Rocket } from 'lucide-react'
import { useI18n } from '@/i18n'

type CartItem = {
    productId: string
    name: string
    price: number
    currency: string
    quantity: number
    imageUrl?: string
}

type Props = {
    items: CartItem[]
    sub: number
    tax: number
    total: number
    shippingFee: number
    freeAboveRM: number | null
    currency: string
    selectedStateZone: string | undefined
    paymentMethod: 'cod' | 'bank_transfer' | 'stripe'
    canPlaceOrder: boolean
    isPlacing: boolean
    formatPrice: (price: number, currency: string) => string
    onPlaceOrder: () => void
}

export function CheckoutOrderSummary({
    items, sub, tax, total, shippingFee, freeAboveRM,
    currency, selectedStateZone, paymentMethod,
    canPlaceOrder, isPlacing, formatPrice, onPlaceOrder,
}: Props) {
    const { t } = useI18n()
    const ck = t.storefront.checkout

    return (
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

            {/* TODO: Promo/gift card — re-enable when promotion system is defined */}
            <div className="sum-row"><span className="sr-l">{ck.subtotal} ({items.length})</span><span className="sr-v">{formatPrice(sub, currency)}</span></div>
            <div className="sum-row"><span className="sr-l">{ck.sst}</span><span className="sr-v">{formatPrice(tax, currency)}</span></div>
            <div className="sum-row">
                <span className="sr-l">{ck.shipping} ({selectedStateZone === 'east' ? 'East MY' : 'West MY'})</span>
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

            <button
                className={`po-btn${!canPlaceOrder ? ' dis' : ''}`}
                onClick={onPlaceOrder}
                disabled={isPlacing || !canPlaceOrder}
            >
                {isPlacing
                    ? <><Loader2 size={16} className="spin" /> {ck.placingOrder}</>
                    : <><Rocket size={16} /> {ck.placeOrder}</>}
            </button>

            <div className={`sum-trust${paymentMethod === 'bank_transfer' ? ' note' : ''}`}>
                {paymentMethod === 'bank_transfer'
                    ? <><Info size={13} style={{ flexShrink: 0, marginTop: 2 }} /> {"You'll upload your payment proof in the next step after your order is created."}</>
                    : paymentMethod === 'stripe'
                        ? <><Lock size={11} /> {"You'll be redirected to Stripe's secure checkout page."}</>
                        : <><ShieldCheck size={11} /> Encrypted Checkout</>}
            </div>
        </div>
    )
}
