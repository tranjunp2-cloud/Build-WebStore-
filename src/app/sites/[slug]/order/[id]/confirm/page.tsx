import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getPayload } from 'payload'
import config from '@payload-config'
import { CheckCircle, ArrowLeft, Package, MapPin, CreditCard } from 'lucide-react'

function formatPrice(price: number, currency: string) {
    if (currency === 'MYR') return `RM ${price.toFixed(2)}`
    if (currency === 'SGD') return `S$${price.toFixed(2)}`
    return `$${price.toFixed(2)}`
}

type OrderItem = {
    productName: string
    quantity: number
    unitPrice: number
    variant?: string
}

type ShippingAddress = {
    line1?: string
    line2?: string
    city?: string
    state?: string
    postcode?: string
    country?: string
}

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

    // Fetch order scoped to this site — prevents enumeration of other tenants' orders
    let order: Order | null = null
    try {
        const result = await payload.find({
            collection: 'orders',
            where: {
                id: { equals: orderId },
                site: { equals: site.id },
            },
            limit: 1,
            overrideAccess: true,
            depth: 1,
        })
        order = result.docs[0] as unknown as Order
    } catch {
        // query error — treat as not found
    }

    if (!order) {
        notFound()
    }

    const currency = order.currency || 'MYR'
    const shippingFee = order.shippingFee ?? 10
    const isCod = order.paymentMethod === 'cod'
    const isQrBanking = order.paymentMethod === 'qr_banking'

    const addr = order.shippingAddress
    const hasAddress = addr && (addr.line1 || addr.city)

    return (
        <div style={{
            fontFamily: 'Inter, sans-serif',
            minHeight: '100vh',
            background: '#fafafa',
        }}>
            {/* Nav */}
            <nav style={{
                padding: '16px 24px',
                borderBottom: '1px solid #eee',
                background: 'white',
            }}>
                <Link
                    href={`/sites/${slug}/products`}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        color: '#666',
                        textDecoration: 'none',
                        fontSize: '14px',
                    }}
                >
                    <ArrowLeft size={16} />
                    Back to Products
                </Link>
            </nav>

            <div style={{
                maxWidth: '600px',
                margin: '0 auto',
                padding: '32px 24px',
            }}>
                {/* Success Header */}
                <div style={{
                    textAlign: 'center',
                    marginBottom: '32px',
                }}>
                    <div style={{
                        width: '64px',
                        height: '64px',
                        borderRadius: '50%',
                        background: '#dcfce7',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 20px',
                    }}>
                        <CheckCircle size={32} color="#22c55e" />
                    </div>
                    <h1 style={{ fontSize: '24px', fontWeight: 700, margin: '0 0 8px', color: '#111' }}>
                        Order Confirmed!
                    </h1>
                    <p style={{ fontSize: '14px', color: '#666', margin: 0 }}>
                        Thank you for your purchase
                    </p>
                </div>

                {/* Order Number Card */}
                <div style={{
                    background: 'white',
                    borderRadius: '16px',
                    padding: '20px 24px',
                    marginBottom: '16px',
                    border: '1px solid #eee',
                    textAlign: 'center',
                }}>
                    <p style={{ fontSize: '12px', color: '#999', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        Order Number
                    </p>
                    <p style={{ fontSize: '22px', fontWeight: 700, margin: '0 0 8px', letterSpacing: '1px', color: '#111' }}>
                        {order.orderNumber}
                    </p>
                    <p style={{ fontSize: '13px', color: '#999', margin: 0 }}>
                        A confirmation has been sent to {order.customerEmail}
                    </p>
                </div>

                {/* Payment Method Context */}
                <div style={{
                    background: isCod ? '#fff7ed' : '#eff6ff',
                    border: `1px solid ${isCod ? '#fed7aa' : '#bfdbfe'}`,
                    borderRadius: '12px',
                    padding: '14px 18px',
                    marginBottom: '16px',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '12px',
                }}>
                    <CreditCard size={18} color={isCod ? '#ea580c' : '#2563eb'} style={{ flexShrink: 0, marginTop: '1px' }} />
                    <div>
                        <p style={{ fontSize: '13px', fontWeight: 600, margin: '0 0 2px', color: isCod ? '#c2410c' : '#1d4ed8' }}>
                            {isCod ? 'Cash on Delivery (COD)' : isQrBanking ? 'QR Banking / DuitNow' : order.paymentMethod}
                        </p>
                        <p style={{ fontSize: '13px', color: '#555', margin: 0 }}>
                            {isCod
                                ? 'Thanh toán khi nhận hàng — seller sẽ liên hệ xác nhận'
                                : isQrBanking
                                    ? 'Đã upload proof — chờ seller xác minh'
                                    : 'Seller will contact you to confirm payment'}
                        </p>
                    </div>
                </div>

                {/* Items List */}
                <div style={{
                    background: 'white',
                    borderRadius: '16px',
                    padding: '20px 24px',
                    marginBottom: '16px',
                    border: '1px solid #eee',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                        <Package size={16} color="#666" />
                        <h2 style={{ fontSize: '14px', fontWeight: 600, margin: 0, color: '#111' }}>
                            Order Items
                        </h2>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {order.items.map((item, idx) => (
                            <div key={idx} style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'flex-start',
                                gap: '12px',
                            }}>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <p style={{ fontSize: '14px', fontWeight: 500, margin: '0 0 2px', color: '#111' }}>
                                        {item.productName}
                                    </p>
                                    {item.variant && (
                                        <p style={{ fontSize: '12px', color: '#999', margin: '0 0 2px' }}>
                                            {item.variant}
                                        </p>
                                    )}
                                    <p style={{ fontSize: '12px', color: '#999', margin: 0 }}>
                                        Qty: {item.quantity} × {formatPrice(item.unitPrice, currency)}
                                    </p>
                                </div>
                                <span style={{ fontSize: '14px', fontWeight: 600, color: '#111', flexShrink: 0 }}>
                                    {formatPrice(item.unitPrice * item.quantity, currency)}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Shipping Address */}
                {hasAddress && (
                    <div style={{
                        background: 'white',
                        borderRadius: '16px',
                        padding: '20px 24px',
                        marginBottom: '16px',
                        border: '1px solid #eee',
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                            <MapPin size={16} color="#666" />
                            <h2 style={{ fontSize: '14px', fontWeight: 600, margin: 0, color: '#111' }}>
                                Shipping Address
                            </h2>
                        </div>
                        <div style={{ fontSize: '14px', color: '#555', lineHeight: '1.6' }}>
                            <p style={{ margin: 0 }}>{order.customerName}</p>
                            {addr?.line1 && <p style={{ margin: 0 }}>{addr.line1}</p>}
                            {addr?.line2 && <p style={{ margin: 0 }}>{addr.line2}</p>}
                            {(addr?.city || addr?.state || addr?.postcode) && (
                                <p style={{ margin: 0 }}>
                                    {[addr?.city, addr?.state, addr?.postcode].filter(Boolean).join(', ')}
                                </p>
                            )}
                            {addr?.country && <p style={{ margin: 0 }}>{addr.country}</p>}
                        </div>
                    </div>
                )}

                {/* Totals */}
                <div style={{
                    background: 'white',
                    borderRadius: '16px',
                    padding: '20px 24px',
                    marginBottom: '24px',
                    border: '1px solid #eee',
                }}>
                    <h2 style={{ fontSize: '14px', fontWeight: 600, margin: '0 0 16px', color: '#111' }}>
                        Order Summary
                    </h2>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                            <span style={{ color: '#666' }}>Subtotal</span>
                            <span>{formatPrice(order.subtotal, currency)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                            <span style={{ color: '#666' }}>Shipping</span>
                            <span>{shippingFee > 0 ? formatPrice(shippingFee, currency) : 'Free'}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                            <span style={{ color: '#666' }}>SST (6%)</span>
                            <span>{formatPrice(order.tax, currency)}</span>
                        </div>
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            fontSize: '18px',
                            fontWeight: 700,
                            paddingTop: '12px',
                            borderTop: '1px solid #f0f0f0',
                            color: '#111',
                        }}>
                            <span>Total</span>
                            <span>{formatPrice(order.total, currency)}</span>
                        </div>
                    </div>
                </div>

                {/* Continue Shopping CTA */}
                <div style={{ textAlign: 'center' }}>
                    <Link
                        href={`/sites/${slug}/products`}
                        style={{
                            display: 'inline-block',
                            padding: '14px 40px',
                            background: '#111',
                            color: 'white',
                            borderRadius: '12px',
                            textDecoration: 'none',
                            fontSize: '15px',
                            fontWeight: 600,
                        }}
                    >
                        Continue Shopping
                    </Link>
                </div>
            </div>
        </div>
    )
}
