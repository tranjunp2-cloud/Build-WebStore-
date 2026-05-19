import { getPayload } from 'payload'
import config from '@payload-config'
import Link from 'next/link'
import { CheckCircle, XCircle, Clock } from 'lucide-react'

function formatPrice(price: number, currency: string) {
    if (currency === 'MYR') return `RM ${price.toFixed(2)}`
    if (currency === 'SGD') return `S$${price.toFixed(2)}`
    return `$${price.toFixed(2)}`
}

export default async function ConfirmPage({
    params,
}: {
    params: Promise<{ slug: string; orderId: string }>
}) {
    const { slug, orderId } = await params
    const payload = await getPayload({ config })

    let order: any = null
    try {
        order = await payload.findByID({
            collection: 'orders',
            id: orderId,
            depth: 0,
            overrideAccess: true,
        })
    } catch { }

    const paymentLabel =
        order?.paymentMethod === 'fpx' ? 'FPX (Online Banking)' :
            order?.paymentMethod === 'card' ? 'Credit / Debit Card' : 'Online Payment'

    // Determine UI state based on order status
    const status = order?.status
    const isFailed = status === 'payment_failed'
    const isPending = !status || status === 'pending'
    const isSuccess = status === 'paid' || status === 'confirmed'

    const containerStyle = {
        fontFamily: 'Inter, sans-serif', minHeight: '100vh',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#fafafa', padding: '24px',
    }

    const cardStyle = {
        textAlign: 'center' as const, maxWidth: '480px', width: '100%', padding: '48px 32px',
        background: 'white', borderRadius: '24px', boxShadow: '0 4px 24px rgba(0,0,0,0.05)',
    }

    // Payment failed state
    if (isFailed) {
        return (
            <div style={containerStyle}>
                <div style={cardStyle}>
                    <div style={{
                        width: '64px', height: '64px', borderRadius: '50%', background: '#fee2e2',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px',
                    }}>
                        <XCircle size={32} color="#ef4444" />
                    </div>

                    <h1 style={{ fontSize: '24px', fontWeight: 700, margin: '0 0 8px' }}>
                        Pembayaran Gagal
                    </h1>
                    <p style={{ fontSize: '14px', color: '#666', margin: '0 0 24px' }}>
                        Pembayaran gagal. Sila cuba lagi.
                    </p>

                    {order?.orderNumber && (
                        <div style={{
                            background: '#fef2f2', borderRadius: '12px', padding: '16px', marginBottom: '24px',
                        }}>
                            <p style={{ fontSize: '13px', color: '#999', margin: '0 0 4px' }}>Order Reference</p>
                            <p style={{ fontSize: '16px', fontWeight: 700, margin: 0 }}>{order.orderNumber}</p>
                        </div>
                    )}

                    <Link
                        href={`/sites/${slug}/checkout`}
                        style={{
                            display: 'inline-block', padding: '12px 32px',
                            background: '#111', color: 'white', borderRadius: '12px',
                            textDecoration: 'none', fontSize: '14px', fontWeight: 600,
                        }}
                    >
                        Cuba Lagi
                    </Link>
                </div>
            </div>
        )
    }

    // Payment pending — webhook may be delayed
    if (isPending) {
        return (
            <div style={containerStyle}>
                <div style={cardStyle}>
                    <div style={{
                        width: '64px', height: '64px', borderRadius: '50%', background: '#fef9c3',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px',
                    }}>
                        <Clock size={32} color="#eab308" />
                    </div>

                    <h1 style={{ fontSize: '24px', fontWeight: 700, margin: '0 0 8px' }}>
                        Processing Payment
                    </h1>
                    <p style={{ fontSize: '14px', color: '#666', margin: '0 0 24px' }}>
                        Your payment is being processed. Please wait a moment — you will receive a confirmation email shortly.
                    </p>

                    {order?.orderNumber && (
                        <div style={{
                            background: '#f8fafc', borderRadius: '12px', padding: '16px', marginBottom: '24px',
                        }}>
                            <p style={{ fontSize: '13px', color: '#999', margin: '0 0 4px' }}>Order Reference</p>
                            <p style={{ fontSize: '16px', fontWeight: 700, margin: 0 }}>{order.orderNumber}</p>
                        </div>
                    )}

                    <Link
                        href={`/sites/${slug}/products`}
                        style={{
                            display: 'inline-block', padding: '12px 32px',
                            background: '#111', color: 'white', borderRadius: '12px',
                            textDecoration: 'none', fontSize: '14px', fontWeight: 600,
                        }}
                    >
                        Continue Shopping
                    </Link>
                </div>
            </div>
        )
    }

    // Success state
    return (
        <div style={containerStyle}>
            <div style={cardStyle}>
                <div style={{
                    width: '64px', height: '64px', borderRadius: '50%', background: '#dcfce7',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px',
                }}>
                    <CheckCircle size={32} color="#22c55e" />
                </div>

                <h1 style={{ fontSize: '24px', fontWeight: 700, margin: '0 0 8px' }}>
                    Payment Successful!
                </h1>
                <p style={{ fontSize: '14px', color: '#666', margin: '0 0 24px' }}>
                    Thank you for your purchase. Your order is being processed.
                </p>

                {order && (
                    <div style={{
                        background: '#f8fafc', borderRadius: '12px', padding: '20px', marginBottom: '24px',
                    }}>
                        <p style={{ fontSize: '13px', color: '#999', margin: '0 0 4px' }}>Order Number</p>
                        <p style={{ fontSize: '20px', fontWeight: 700, margin: '0 0 12px', letterSpacing: '1px' }}>
                            {order.orderNumber}
                        </p>
                        {order.total != null && (
                            <>
                                <p style={{ fontSize: '13px', color: '#999', margin: '0 0 4px' }}>Total</p>
                                <p style={{ fontSize: '24px', fontWeight: 700, margin: '0 0 12px' }}>
                                    {formatPrice(order.total, order.currency || 'MYR')}
                                </p>
                            </>
                        )}
                        <p style={{ fontSize: '13px', color: '#999', margin: 0 }}>
                            Payment via {paymentLabel}
                        </p>
                    </div>
                )}

                <p style={{ fontSize: '13px', color: '#999' }}>
                    A confirmation email will be sent to your inbox shortly.
                </p>

                <Link
                    href={`/sites/${slug}/products`}
                    style={{
                        display: 'inline-block', marginTop: '24px', padding: '12px 32px',
                        background: '#111', color: 'white', borderRadius: '12px',
                        textDecoration: 'none', fontSize: '14px', fontWeight: 600,
                    }}
                >
                    Continue Shopping
                </Link>
            </div>
        </div>
    )
}
