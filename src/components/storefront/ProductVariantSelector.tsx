'use client'

import { useState } from 'react'
import { useI18n } from '@/i18n'
import { variantPriceRange } from '@/lib/storefront/variant-price-range'

type Variant = {
    name: string
    price: number
    compareAtPrice?: number | null
    stock: number
}

type Props = {
    variants: Variant[]
    currency: string
    primaryColor: string
    basePrice: number
    baseCompareAtPrice?: number | null
    onSelect?: (variant: Variant | null) => void
}

function formatPrice(price: number, currency: string) {
    if (currency === 'MYR') return `RM ${price.toFixed(2)}`
    if (currency === 'SGD') return `S$${price.toFixed(2)}`
    return `$${price.toFixed(2)}`
}

export function ProductVariantSelector({ variants, currency, primaryColor, basePrice, baseCompareAtPrice, onSelect }: Props) {
    const { t, ti } = useI18n()
    const [selected, setSelected] = useState<Variant | null>(null)

    if (!variants.length) return null

    // Before a pick, price from the variants (the base price may be 0 when only variants are priced).
    // The base compare-at belongs to the base price, not the variants, so no discount badge until a variant is picked.
    const range = variantPriceRange(variants)
    const showFrom = selected == null && range != null && range.min !== range.max
    const displayPrice = selected?.price ?? range?.min ?? basePrice
    const displayCompareAt = selected != null ? selected.compareAtPrice : range != null ? null : baseCompareAtPrice
    const hasDiscount = displayCompareAt != null && displayCompareAt > displayPrice
    const discountPercent = hasDiscount ? Math.round((1 - displayPrice / displayCompareAt!) * 100) : 0

    const handleSelect = (v: Variant) => {
        if (v.stock === 0) return
        const next = selected?.name === v.name ? null : v
        setSelected(next)
        onSelect?.(next)
    }

    return (
        <div>
            {/* Price — updates when variant is selected; aria-live announces change to screen readers */}
            <div
                style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}
                aria-live="polite"
                aria-atomic="true"
            >
                <span style={{ fontSize: '28px', fontWeight: 700, color: 'var(--text)' }}>
                    {showFrom
                        ? ti(t.storefront.products.fromPrice, { price: formatPrice(displayPrice, currency) })
                        : formatPrice(displayPrice, currency)}
                </span>
                {hasDiscount && (
                    <>
                        <span style={{ fontSize: '18px', color: 'var(--text-muted, #999)', textDecoration: 'line-through' }}>
                            {formatPrice(displayCompareAt!, currency)}
                        </span>
                        <span style={{ background: '#fef2f2', color: '#ef4444', fontSize: '13px', fontWeight: 600, padding: '4px 10px', borderRadius: '20px' }}>
                            -{discountPercent}%
                        </span>
                    </>
                )}
            </div>

            {/* Variant buttons */}
            <div style={{ marginBottom: '24px' }}>
                <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)', marginBottom: '10px' }}>
                    {t.storefront.products.variantLabel}
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {variants.map((v) => {
                        const isSelected = selected?.name === v.name
                        const isOos = v.stock === 0
                        return (
                            <button
                                key={v.name}
                                type="button"
                                disabled={isOos}
                                title={isOos ? t.storefront.products.outOfStock : undefined}
                                onClick={() => handleSelect(v)}
                                style={{
                                    padding: '8px 16px',
                                    borderRadius: '8px',
                                    fontSize: '13px',
                                    fontWeight: 500,
                                    cursor: isOos ? 'not-allowed' : 'pointer',
                                    opacity: isOos ? 0.45 : 1,
                                    border: `1.5px solid ${isSelected ? primaryColor : 'rgba(0,0,0,0.15)'}`,
                                    background: isSelected ? primaryColor : 'transparent',
                                    color: isSelected ? '#fff' : 'var(--text)',
                                    transition: 'all 0.15s',
                                }}
                                aria-pressed={isSelected}
                            >
                                {v.name}
                                {isOos && (
                                    <span style={{ marginLeft: '6px', fontSize: '11px', opacity: 0.8 }}>
                                        ({t.storefront.products.outOfStock})
                                    </span>
                                )}
                            </button>
                        )
                    })}
                </div>
                {selected && selected.stock > 0 && (
                    <p style={{ fontSize: '12px', marginTop: '8px', color: selected.stock > 5 ? '#22c55e' : '#f59e0b' }}>
                        {ti(t.storefront.products.stockLeft, { count: selected.stock })}
                    </p>
                )}
            </div>
        </div>
    )
}
