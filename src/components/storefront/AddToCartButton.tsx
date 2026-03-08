'use client'

import { useCartStore } from '@/store/cartStore'

type AddToCartButtonProps = {
    product: {
        id: string
        slug: string
        name: string
        price: number
        compareAtPrice?: number
        currency: string
        imageUrl?: string
        inventory: number
    }
    primaryColor: string
    siteSlug: string
}

export function AddToCartButton({ product, primaryColor, siteSlug }: AddToCartButtonProps) {
    const { addItem, setSiteSlug } = useCartStore()
    const isOutOfStock = product.inventory <= 0

    const handleClick = () => {
        if (isOutOfStock) return
        setSiteSlug(siteSlug)
        addItem({
            productId: product.id,
            productSlug: product.slug,
            name: product.name,
            price: product.price,
            compareAtPrice: product.compareAtPrice,
            currency: product.currency || 'MYR',
            imageUrl: product.imageUrl,
        })
    }

    return (
        <button
            onClick={handleClick}
            disabled={isOutOfStock}
            style={{
                background: primaryColor,
                color: 'white',
                border: 'none',
                borderRadius: '12px',
                padding: '14px 32px',
                fontSize: '16px',
                fontWeight: 600,
                cursor: isOutOfStock ? 'not-allowed' : 'pointer',
                width: '100%',
                marginBottom: '24px',
                opacity: isOutOfStock ? 0.5 : 1,
                transition: 'opacity 0.2s',
            }}
        >
            {isOutOfStock ? 'Out of Stock' : '🛒 Add to Cart'}
        </button>
    )
}
