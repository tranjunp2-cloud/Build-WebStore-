'use client'

import { ShoppingCart } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { BlockProps } from '../types'
import type { CartWidgetConfig } from './config'
import { useCartStore } from '@/store/cartStore'
import { CSS_VARS } from '@/lib/theme/resolve'
import { CartDrawer } from '@/components/storefront/CartDrawer'
import { CONTAINER, INNER_PADDING, TOUCH_TARGET } from '@/lib/design-tokens'
import { useBlockEditCallback } from '@/components/site-renderer/BlockEditCallbackContext'
import { useInFloatingContainer } from '@/components/site-renderer/FloatingContainerContext'

export function CartWidgetBlock({ block, theme: _theme, site }: BlockProps<CartWidgetConfig>) {
    void _theme
    const storeCount = useCartStore(state => state.items.reduce((sum, item) => sum + item.quantity, 0))
    const openCart = useCartStore(state => state.openCart)
    const callback = useBlockEditCallback()
    const inContainer = useInFloatingContainer()
    const setSiteSlug = useCartStore(state => state.setSiteSlug)
    // tenantSlug is injected by both storefront page ({ ...site, tenantSlug: slug }) and
    // preview page ({ ...site, tenantSlug: tenant.slug }). Sites collection has no slug field.
    const siteSlug = String((site as Record<string, unknown>)?.tenantSlug || '')

    // Defer cart count to client-only to prevent SSR/hydration mismatch.
    // Server always has count=0 (no localStorage), client reads from localStorage.
    const [count, setCount] = useState(0)
    useEffect(() => {
        setCount(storeCount)
    }, [storeCount])

    useEffect(() => {
        if (siteSlug) {
            setSiteSlug(siteSlug)
        }
    }, [setSiteSlug, siteSlug])

    // ── Inline variant ─────────────────────────────────────────────────
    if (block.variant === 'inline') {
        return (
            <>
                <section className="py-10">
                    <div className={`${CONTAINER.default} mx-auto ${INNER_PADDING}`}>
                        <button
                            type="button"
                            onClick={callback ? undefined : openCart}
                            className={`inline-flex items-center gap-4 rounded-2xl border px-6 py-4 font-medium transition-all duration-200 hover:shadow-lg ${TOUCH_TARGET.min}`}
                            style={{
                                border: `1px solid rgba(var(--brand-primary-rgb), 0.188)`,
                                background: `rgba(var(--brand-primary-rgb), 0.04)`,
                            }}
                        >
                            <ShoppingCart className="h-5 w-5" style={{ color: CSS_VARS.primary }} />
                            <span className="font-semibold">{block.label || 'Cart'}</span>
                            <span
                                className="inline-flex min-h-7 min-w-7 items-center justify-center rounded-full px-2 text-xs font-bold text-white"
                                style={{ background: CSS_VARS.primary }}
                            >
                                {count}
                            </span>
                        </button>
                    </div>
                </section>
                <CartDrawer siteSlug={siteSlug} siteId={site?.id ? String(site.id) : undefined} />
            </>
        )
    }

    // ── Default: floating ────────────────────────────────────────────────
    return (
        <>
            <section className={inContainer ? '' : 'fixed bottom-6 left-6 z-40'}>
                <button
                    type="button"
                    onClick={callback ? undefined : openCart}
                    className={`relative inline-flex items-center gap-3 rounded-2xl border px-4 py-3 font-medium text-white shadow-[0_16px_32px_rgba(2,6,23,0.22)] transition-transform duration-200 hover:-translate-y-0.5 ${TOUCH_TARGET.min}`}
                    style={{
                        background: `linear-gradient(135deg, ${CSS_VARS.primary}, ${CSS_VARS.secondary})`,
                        borderColor: `rgba(var(--brand-primary-rgb), 0.333)`,
                    }}
                >
                    <ShoppingCart className="h-5 w-5" />
                    {block.showLabel ? <span>{block.label || 'Cart'}</span> : null}
                    <span className="absolute -right-2 -top-2 inline-flex min-h-6 min-w-6 items-center justify-center rounded-full bg-white px-1.5 text-xs font-bold text-slate-900">
                        {count}
                    </span>
                </button>
            </section>
            <CartDrawer siteSlug={siteSlug} siteId={site?.id ? String(site.id) : undefined} />
        </>
    )
}
