'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useCartStore } from '@/store/cartStore'
import { ArrowLeft, CheckCircle, Loader2, ShoppingBag } from 'lucide-react'

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

export default function CheckoutPage({ params }: { params: Promise<{ slug: string }> }) {
    const [slug, setSlug] = useState('')
    const [siteId, setSiteId] = useState('')
    const { items, subtotal, clearCart } = useCartStore()
    const router = useRouter()

    const [form, setForm] = useState<CheckoutForm>(initialForm)
    const [isPlacing, setIsPlacing] = useState(false)
    const [orderResult, setOrderResult] = useState<any>(null)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        params.then(p => setSlug(p.slug))
    }, [params])

    // Get siteId from slug
    useEffect(() => {
        if (!slug) return
        async function fetchSite() {
            try {
                const res = await fetch(`/api/sites?where[tenant.slug][equals]=${slug}&limit=1`)
                if (res.ok) {
                    const data = await res.json()
                    if (data.docs?.[0]) setSiteId(String(data.docs[0].id))
                }
            } catch { }
        }
        fetchSite()
    }, [slug])

    const currency = items[0]?.currency || 'MYR'
    const sub = subtotal()
    const tax = Math.round(sub * 0.06 * 100) / 100
    const total = sub + tax

    const updateField = (field: keyof CheckoutForm, value: string) => {
        setForm(prev => ({ ...prev, [field]: value }))
    }

    const handlePlaceOrder = async () => {
        if (!form.name || !form.email) {
            setError('Name and email are required')
            return
        }
        if (items.length === 0) {
            setError('Cart is empty')
            return
        }

        setIsPlacing(true)
        setError(null)

        try {
            const res = await fetch('/api/orders/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
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
                }),
            })

            if (res.ok) {
                const data = await res.json()
                if (data.success) {
                    setOrderResult(data.data)
                    clearCart()
                }
            } else {
                const data = await res.json()
                setError(data.error?.message || 'Failed to place order')
            }
        } catch (err: any) {
            setError(err.message || 'Network error')
        } finally {
            setIsPlacing(false)
        }
    }

    // Order Success
    if (orderResult) {
        return (
            <div style={{
                fontFamily: 'Inter, sans-serif', minHeight: '100vh',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: '#fafafa',
            }}>
                <div style={{
                    textAlign: 'center', maxWidth: '480px', padding: '48px',
                    background: 'white', borderRadius: '24px', boxShadow: '0 4px 24px rgba(0,0,0,0.05)',
                }}>
                    <div style={{
                        width: '64px', height: '64px', borderRadius: '50%', background: '#dcfce7',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px',
                    }}>
                        <CheckCircle size={32} color="#22c55e" />
                    </div>
                    <h1 style={{ fontSize: '24px', fontWeight: 700, margin: '0 0 8px' }}>Order Confirmed!</h1>
                    <p style={{ fontSize: '14px', color: '#666', margin: '0 0 24px' }}>
                        Thank you for your purchase
                    </p>
                    <div style={{
                        background: '#f8fafc', borderRadius: '12px', padding: '20px', marginBottom: '24px',
                    }}>
                        <p style={{ fontSize: '13px', color: '#999', margin: '0 0 4px' }}>Order Number</p>
                        <p style={{ fontSize: '20px', fontWeight: 700, margin: '0 0 12px', letterSpacing: '1px' }}>
                            {orderResult.orderNumber}
                        </p>
                        <p style={{ fontSize: '13px', color: '#999', margin: '0 0 4px' }}>Total Paid</p>
                        <p style={{ fontSize: '24px', fontWeight: 700, margin: 0 }}>
                            {formatPrice(orderResult.total, orderResult.currency)}
                        </p>
                    </div>
                    <p style={{ fontSize: '13px', color: '#999' }}>
                        A confirmation email will be sent to your inbox
                    </p>
                    <Link href={`/sites/${slug}/products`}
                        style={{
                            display: 'inline-block', marginTop: '24px', padding: '12px 32px',
                            background: '#111', color: 'white', borderRadius: '12px',
                            textDecoration: 'none', fontSize: '14px', fontWeight: 600,
                        }}>
                        Continue Shopping
                    </Link>
                </div>
            </div>
        )
    }

    // Empty cart
    if (items.length === 0 && !isPlacing) {
        return (
            <div style={{
                fontFamily: 'Inter, sans-serif', minHeight: '100vh',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
                <div style={{ textAlign: 'center' }}>
                    <ShoppingBag size={48} style={{ opacity: 0.2, margin: '0 auto 16px' }} />
                    <h2 style={{ fontSize: '20px', fontWeight: 600 }}>Your cart is empty</h2>
                    <Link href={`/sites/${slug}/products`}
                        style={{ color: '#0ea5e9', fontSize: '14px', marginTop: '8px', display: 'inline-block' }}>
                        ← Browse Products
                    </Link>
                </div>
            </div>
        )
    }

    const inputStyle = {
        width: '100%', padding: '12px 16px', borderRadius: '10px',
        border: '1px solid #e5e7eb', fontSize: '14px', outline: 'none',
        boxSizing: 'border-box' as const,
    }

    return (
        <div style={{ fontFamily: 'Inter, sans-serif', minHeight: '100vh', background: '#fafafa' }}>
            {/* Nav */}
            <nav style={{ padding: '16px 32px', borderBottom: '1px solid #eee', background: 'white' }}>
                <Link href={`/sites/${slug}/products`} style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    color: '#666', textDecoration: 'none', fontSize: '14px',
                }}>
                    <ArrowLeft size={16} /> Back to Products
                </Link>
            </nav>

            <div style={{
                display: 'grid', gridTemplateColumns: '1fr 400px',
                gap: '48px', maxWidth: '1100px', margin: '0 auto',
                padding: '40px 32px',
            }}>
                {/* Form */}
                <div>
                    <h1 style={{ fontSize: '24px', fontWeight: 700, margin: '0 0 32px' }}>Checkout</h1>

                    {error && (
                        <div style={{
                            background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px',
                            padding: '12px 16px', fontSize: '13px', color: '#dc2626', marginBottom: '24px',
                        }}>
                            {error}
                        </div>
                    )}

                    {/* Contact */}
                    <div style={{ marginBottom: '32px' }}>
                        <h2 style={{ fontSize: '16px', fontWeight: 600, margin: '0 0 16px' }}>Contact Information</h2>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <input placeholder="Full Name *" value={form.name}
                                onChange={e => updateField('name', e.target.value)} style={inputStyle} />
                            <input type="email" placeholder="Email Address *" value={form.email}
                                onChange={e => updateField('email', e.target.value)} style={inputStyle} />
                            <input placeholder="Phone (e.g. +60 12-345 6789)" value={form.phone}
                                onChange={e => updateField('phone', e.target.value)} style={inputStyle} />
                        </div>
                    </div>

                    {/* Shipping */}
                    <div style={{ marginBottom: '32px' }}>
                        <h2 style={{ fontSize: '16px', fontWeight: 600, margin: '0 0 16px' }}>Shipping Address</h2>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <input placeholder="Address Line 1" value={form.line1}
                                onChange={e => updateField('line1', e.target.value)} style={inputStyle} />
                            <input placeholder="Address Line 2 (optional)" value={form.line2}
                                onChange={e => updateField('line2', e.target.value)} style={inputStyle} />
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                <input placeholder="City" value={form.city}
                                    onChange={e => updateField('city', e.target.value)} style={inputStyle} />
                                <select value={form.state}
                                    onChange={e => updateField('state', e.target.value)}
                                    style={{ ...inputStyle, color: form.state ? '#111' : '#9ca3af' }}>
                                    <option value="">State</option>
                                    {MY_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>
                            <input placeholder="Postcode" value={form.postcode}
                                onChange={e => updateField('postcode', e.target.value)}
                                style={{ ...inputStyle, maxWidth: '200px' }} />
                        </div>
                    </div>

                    {/* Place Order */}
                    <button onClick={handlePlaceOrder} disabled={isPlacing}
                        style={{
                            width: '100%', padding: '16px', background: '#111', color: 'white',
                            borderRadius: '12px', border: 'none', fontSize: '16px', fontWeight: 600,
                            cursor: isPlacing ? 'wait' : 'pointer', opacity: isPlacing ? 0.7 : 1,
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                        }}>
                        {isPlacing ? (
                            <><Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> Placing Order...</>
                        ) : (
                            <>Place Order — {formatPrice(total, currency)}</>
                        )}
                    </button>
                </div>

                {/* Order Summary Sidebar */}
                <div style={{
                    background: 'white', borderRadius: '16px', padding: '24px',
                    border: '1px solid #eee', height: 'fit-content', position: 'sticky', top: '24px',
                }}>
                    <h2 style={{ fontSize: '16px', fontWeight: 600, margin: '0 0 20px' }}>Order Summary</h2>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
                        {items.map(item => (
                            <div key={item.productId} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                                <div>
                                    <span>{item.name}</span>
                                    <span style={{ color: '#999' }}> × {item.quantity}</span>
                                </div>
                                <span style={{ fontWeight: 600 }}>{formatPrice(item.price * item.quantity, item.currency)}</span>
                            </div>
                        ))}
                    </div>

                    <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: '16px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', marginBottom: '8px' }}>
                            <span style={{ color: '#666' }}>Subtotal</span>
                            <span>{formatPrice(sub, currency)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', marginBottom: '8px' }}>
                            <span style={{ color: '#666' }}>SST (6%)</span>
                            <span>{formatPrice(tax, currency)}</span>
                        </div>
                        <div style={{
                            display: 'flex', justifyContent: 'space-between',
                            fontSize: '18px', fontWeight: 700, paddingTop: '12px', borderTop: '1px solid #f0f0f0',
                        }}>
                            <span>Total</span>
                            <span>{formatPrice(total, currency)}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
