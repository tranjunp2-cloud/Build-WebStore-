'use client'

import { useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { Package, ArrowRight } from 'lucide-react'
import { useI18n } from '@/i18n'
import { normalizeOrderNumber } from '@/lib/orders/normalize-order-number'

interface Props {
    slug: string
    siteName: string
}

export default function OrderLookupClient({ slug, siteName }: Props) {
    const { t } = useI18n()
    const ol = t.storefront.orderLookup
    const router = useRouter()
    const pathname = usePathname()
    const shopBase = pathname.startsWith('/sites/') ? `/sites/${slug}` : ''
    const [orderNumber, setOrderNumber] = useState('')
    const [error, setError] = useState('')

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        const trimmed = normalizeOrderNumber(orderNumber)
        if (!trimmed) {
            setError(ol.required)
            return
        }
        setError('')
        router.push(`${shopBase}/orders/${encodeURIComponent(trimmed)}`)
    }

    return (
        <div className="ot-page" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
            <div style={{
                background: 'var(--card)',
                borderRadius: 'var(--rc)',
                boxShadow: 'var(--shp)',
                border: '1px solid var(--bd)',
                padding: '40px 36px',
                maxWidth: 440,
                width: '100%',
            }}>
                {/* Icon */}
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
                    <div style={{
                        width: 56,
                        height: 56,
                        borderRadius: 16,
                        background: 'var(--tl5)',
                        border: '1px solid var(--tl2)',
                        display: 'grid',
                        placeItems: 'center',
                        color: 'var(--tl)',
                    }}>
                        <Package size={26} strokeWidth={1.5} />
                    </div>
                </div>

                {/* Title */}
                <div style={{ textAlign: 'center', marginBottom: 28 }}>
                    <h1 style={{
                        fontFamily: 'var(--hf)',
                        fontSize: 22,
                        fontWeight: 800,
                        letterSpacing: '-0.02em',
                        color: 'var(--f1)',
                        margin: '0 0 8px',
                    }}>
                        {ol.title}
                    </h1>
                    <p style={{ fontSize: 14, color: 'var(--f3)', lineHeight: 1.6, margin: 0 }}>
                        {ol.subtitle}
                    </p>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit}>
                    <label style={{
                        display: 'block',
                        fontSize: 13,
                        fontWeight: 600,
                        color: 'var(--f2)',
                        marginBottom: 6,
                    }}>
                        {ol.label}
                    </label>
                    <input
                        type="text"
                        value={orderNumber}
                        onChange={e => { setOrderNumber(e.target.value); setError('') }}
                        placeholder={ol.placeholder}
                        autoComplete="off"
                        autoFocus
                        style={{
                            display: 'block',
                            width: '100%',
                            padding: '11px 14px',
                            fontSize: 15,
                            fontFamily: 'var(--mf)',
                            letterSpacing: '0.04em',
                            background: 'var(--inp)',
                            border: `1px solid ${error ? 'var(--tl)' : 'var(--bd)'}`,
                            borderRadius: 10,
                            color: 'var(--f1)',
                            outline: 'none',
                            boxSizing: 'border-box',
                            marginBottom: error ? 6 : 16,
                            transition: 'border-color 150ms',
                        }}
                    />
                    {error && (
                        <p style={{ fontSize: 12, color: 'var(--tl)', margin: '0 0 14px' }}>{error}</p>
                    )}
                    <button
                        type="submit"
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 8,
                            width: '100%',
                            padding: '13px 20px',
                            fontSize: 15,
                            fontWeight: 700,
                            color: '#fff',
                            background: 'linear-gradient(135deg, var(--tl), var(--tl7))',
                            border: 'none',
                            borderRadius: 10,
                            cursor: 'pointer',
                            transition: 'opacity 150ms',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.opacity = '0.88')}
                        onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
                    >
                        {ol.submit}
                        <ArrowRight size={16} />
                    </button>
                </form>

                {/* Back link */}
                <p style={{ textAlign: 'center', marginTop: 20, marginBottom: 0 }}>
                    <a
                        href={shopBase || '/'}
                        style={{ fontSize: 13, color: 'var(--f3)', textDecoration: 'none' }}
                        onMouseEnter={e => (e.currentTarget.style.color = 'var(--f1)')}
                        onMouseLeave={e => (e.currentTarget.style.color = 'var(--f3)')}
                    >
                        ← {siteName || 'Back to store'}
                    </a>
                </p>
            </div>
        </div>
    )
}
