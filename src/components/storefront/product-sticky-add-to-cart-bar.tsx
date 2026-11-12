'use client'

import { useEffect, useState, type RefObject } from 'react'
import { AddToCartButton } from '@/components/storefront/AddToCartButton'

type Props = {
    /** Inline add-to-cart wrapper; bar appears only once it scrolls out of the viewport */
    anchorRef: RefObject<HTMLElement | null>
    product: React.ComponentProps<typeof AddToCartButton>['product']
    variantName: string | null
    requireVariant: boolean
    primaryColor: string
    siteSlug: string
    siteId: string
    priceLabel: string
    /** Quantity chosen in the PDP stepper; the sticky button adds the same amount */
    quantity?: number
    onSelectVariant: () => void
}

/**
 * F09 FR-15 [TC-F09.38]: mobile-only sticky bottom bar with price + Add to Cart.
 * Hidden on >=768px via CSS; on mobile shown while the inline button is off-screen.
 */
export function ProductStickyAddToCartBar({
    anchorRef, product, variantName, requireVariant, primaryColor, siteSlug, siteId, priceLabel, quantity = 1, onSelectVariant,
}: Props) {
    const [inlineVisible, setInlineVisible] = useState(true)

    useEffect(() => {
        const el = anchorRef.current
        if (!el || typeof IntersectionObserver === 'undefined') return
        const observer = new IntersectionObserver(([entry]) => setInlineVisible(entry.isIntersecting))
        observer.observe(el)
        return () => observer.disconnect()
    }, [anchorRef])

    return (
        <>
            <style>{`
                .pd-sticky-bar { display: none; }
                @media (max-width: 767px) {
                    .pd-sticky-bar { display: flex; }
                }
            `}</style>
            <div
                className="pd-sticky-bar"
                data-testid="pd-sticky-add-to-cart"
                aria-hidden={inlineVisible}
                style={{
                    position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 50,
                    alignItems: 'center', gap: '12px',
                    padding: '12px 16px', paddingBottom: 'calc(12px + env(safe-area-inset-bottom))',
                    background: '#ffffff', borderTop: '1px solid rgba(0,0,0,0.08)',
                    boxShadow: '0 -2px 12px rgba(0,0,0,0.08)',
                    transform: inlineVisible ? 'translateY(100%)' : 'translateY(0)',
                    visibility: inlineVisible ? 'hidden' : 'visible',
                    transition: 'transform 0.2s',
                }}
            >
                <span style={{ fontWeight: 700, fontSize: '16px', whiteSpace: 'nowrap' }}>{priceLabel}</span>
                <div style={{ flex: 1 }}>
                    <AddToCartButton
                        product={product}
                        variantName={variantName}
                        requireVariant={requireVariant}
                        primaryColor={primaryColor}
                        siteSlug={siteSlug}
                        siteId={siteId}
                        quantity={quantity}
                        variant="sticky"
                        onSelectVariant={onSelectVariant}
                    />
                </div>
            </div>
        </>
    )
}
