'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useState } from 'react'
import { useI18n } from '@/i18n'

type Category = {
    id: string
    name: string
    slug: string
    parent?: string | Category | null
    breadcrumbs?: string
}

type AttributeFilter = {
    key: string
    values: string[]
}

type Props = {
    categories: Category[]
    attributes: AttributeFilter[]
    minPrice: number
    maxPrice: number
    primaryColor: string
}

export function PlpSidebar({ categories, attributes, minPrice, maxPrice, primaryColor }: Props) {
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()
    const { t } = useI18n()

    const currentCat = searchParams.get('category')
    const currentMinPrice = searchParams.get('minPrice') || ''
    const currentMaxPrice = searchParams.get('maxPrice') || ''

    const [priceRange, setPriceRange] = useState({ min: currentMinPrice, max: currentMaxPrice })

    const updateFilter = (params: URLSearchParams) => {
        // preserve 'view' parameter if it exists
        const view = searchParams.get('view')
        if (view) params.set('view', view)
        
        router.push(`${pathname}?${params.toString()}`, { scroll: false })
    }

    const handleCategoryClick = (catSlug: string | null) => {
        const params = new URLSearchParams(searchParams.toString())
        if (catSlug) params.set('category', catSlug)
        else params.delete('category')
        updateFilter(params)
    }

    const handlePriceApply = () => {
        const params = new URLSearchParams(searchParams.toString())
        if (priceRange.min) params.set('minPrice', String(priceRange.min))
        else params.delete('minPrice')
        if (priceRange.max) params.set('maxPrice', String(priceRange.max))
        else params.delete('maxPrice')
        updateFilter(params)
    }

    const handleAttrToggle = (attrKey: string, val: string) => {
        const params = new URLSearchParams(searchParams.toString())
        const key = `attr_${attrKey}`
        const existing = params.getAll(key)
        
        if (existing.includes(val)) {
            const newValues = existing.filter(v => v !== val)
            params.delete(key)
            newValues.forEach(v => params.append(key, v))
        } else {
            params.append(key, val)
        }
        updateFilter(params)
    }

    // Build category tree (up to 3 levels)
    const level1 = categories.filter(c => !c.parent)

    return (
        <div style={{ width: '260px', flexShrink: 0, paddingRight: '24px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '24px', color: '#111' }}>Filters</h2>

            {/* Categories */}
            <div style={{ marginBottom: '32px' }}>
                <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '16px', color: '#333' }}>Categories</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <button
                        onClick={() => handleCategoryClick(null)}
                        style={{
                            textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                            color: !currentCat ? primaryColor : '#666',
                            fontWeight: !currentCat ? 600 : 400,
                            fontSize: '15px'
                        }}
                    >
                        {t.storefront.products.allProducts}
                    </button>
                    {level1.map(c1 => {
                        const level2 = categories.filter(c => (typeof c.parent === 'object' ? c.parent?.id : c.parent) === c1.id)
                        return (
                            <div key={c1.id}>
                                <button
                                    onClick={() => handleCategoryClick(c1.slug)}
                                    style={{
                                        textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                                        color: currentCat === c1.slug ? primaryColor : '#333',
                                        fontWeight: currentCat === c1.slug ? 600 : 500,
                                        marginTop: '4px',
                                        fontSize: '15px'
                                    }}
                                >
                                    {c1.name}
                                </button>
                                {level2.length > 0 && (
                                    <div style={{ paddingLeft: '12px', marginTop: '6px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                        {level2.map(c2 => {
                                            const level3 = categories.filter(c => (typeof c.parent === 'object' ? c.parent?.id : c.parent) === c2.id)
                                            return (
                                                <div key={c2.id}>
                                                    <button
                                                        onClick={() => handleCategoryClick(c2.slug)}
                                                        style={{
                                                            textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                                                            color: currentCat === c2.slug ? primaryColor : '#666',
                                                            fontWeight: currentCat === c2.slug ? 600 : 400,
                                                            fontSize: '14px'
                                                        }}
                                                    >
                                                        {c2.name}
                                                    </button>
                                                    {level3.length > 0 && (
                                                        <div style={{ paddingLeft: '12px', marginTop: '6px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                                            {level3.map(c3 => (
                                                                <button
                                                                    key={c3.id}
                                                                    onClick={() => handleCategoryClick(c3.slug)}
                                                                    style={{
                                                                        textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                                                                        color: currentCat === c3.slug ? primaryColor : '#888',
                                                                        fontWeight: currentCat === c3.slug ? 600 : 400,
                                                                        fontSize: '13px'
                                                                    }}
                                                                >
                                                                    - {c3.name}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            )
                                        })}
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            </div>

            {/* Price Filter */}
            <div style={{ marginBottom: '32px' }}>
                <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '16px', color: '#333' }}>{t.storefront.products.priceRange}</h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                    <input
                        type="number"
                        placeholder={minPrice.toString()}
                        value={priceRange.min}
                        onChange={(e) => setPriceRange({ ...priceRange, min: e.target.value })}
                        style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #e5e7eb', fontSize: '13px', outlineColor: primaryColor }}
                    />
                    <span style={{ color: '#888' }}>-</span>
                    <input
                        type="number"
                        placeholder={maxPrice.toString()}
                        value={priceRange.max}
                        onChange={(e) => setPriceRange({ ...priceRange, max: e.target.value })}
                        style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #e5e7eb', fontSize: '13px', outlineColor: primaryColor }}
                    />
                </div>
                <button
                    onClick={handlePriceApply}
                    style={{
                        width: '100%', padding: '8px', borderRadius: '6px', background: '#f9fafb', border: '1px solid #e5e7eb',
                        cursor: 'pointer', fontSize: '13px', fontWeight: 600, color: '#374151', 
                        transition: 'background 0.2s',
                    }}
                    onMouseOver={(e) => e.currentTarget.style.background = '#f3f4f6'}
                    onMouseOut={(e) => e.currentTarget.style.background = '#f9fafb'}
                >
                    {t.storefront.products.applyFilter}
                </button>
            </div>

            {/* Dynamic Attributes */}
            {attributes.length > 0 && (
                <div>
                    <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '16px', color: '#333' }}>{t.storefront.products.specifications}</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                        {attributes.map(attr => {
                            const selectedValues = searchParams.getAll(`attr_${attr.key}`)
                            return (
                                <div key={attr.key}>
                                    <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '10px', color: '#555' }}>{attr.key}</div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        {attr.values.map(val => (
                                            <label key={val} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', cursor: 'pointer' }}>
                                                <input
                                                    type="checkbox"
                                                    checked={selectedValues.includes(val)}
                                                    onChange={() => handleAttrToggle(attr.key, val)}
                                                    style={{ accentColor: primaryColor, width: '16px', height: '16px' }}
                                                />
                                                <span style={{ color: '#555' }}>{val}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}
        </div>
    )
}
