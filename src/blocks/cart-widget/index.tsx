'use client'

import { ShoppingCart } from 'lucide-react'
import { useEffect } from 'react'
import type { BlockProps } from '../types'
import type { CartWidgetConfig } from './config'
import { useCartStore } from '@/store/cartStore'
import { CSS_VARS } from '@/lib/theme/resolve'
import { CartDrawer } from '@/components/storefront/CartDrawer'

export function CartWidgetBlock({ block, theme, site }: BlockProps<CartWidgetConfig> & { site?: { slug?: string } }) {
    const count = useCartStore(state => state.items.reduce((sum, item) => sum + item.quantity, 0))
    const openCart = useCartStore(state => state.openCart)
    const setSiteSlug = useCartStore(state => state.setSiteSlug)
    const siteSlug = String(site?.slug || '')

    useEffect(() => {
        if (siteSlug) {
            setSiteSlug(siteSlug)
        }
    }, [setSiteSlug, siteSlug])

    const isFloating = block.variant !== 'inline'

    return (
        <>
            <section className={isFloating ? 'fixed bottom-6 left-6 z-40' : 'py-10'}>
                <div className={isFloating ? '' : 'container mx-auto px-6'}>
                    <button
                        type="button"
                        onClick={openCart}
                        className="relative inline-flex items-center gap-3 rounded-2xl border px-4 py-3 font-medium text-white shadow-[0_16px_32px_rgba(2,6,23,0.22)] transition-transform duration-200 hover:-translate-y-0.5"
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
                </div>
            </section>
            <CartDrawer siteSlug={siteSlug} />
        </>
    )
}
