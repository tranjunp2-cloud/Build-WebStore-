import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useCartStore, type CartItem } from '@/store/cartStore'

// Mock localStorage
const localStorageMock = (() => {
    let store: Record<string, string> = {}
    return {
        getItem: (key: string) => store[key] || null,
        setItem: (key: string, value: string) => { store[key] = value },
        removeItem: (key: string) => { delete store[key] },
        clear: () => { store = {} },
    }
})()
Object.defineProperty(window, 'localStorage', { value: localStorageMock })

const mockItem: Omit<CartItem, 'quantity'> = {
    productId: 'prod-1',
    productSlug: 'chocolate-cake',
    name: 'Chocolate Cake',
    price: 49.90,
    currency: 'MYR',
    imageUrl: '/images/cake.jpg',
}

const mockItem2: Omit<CartItem, 'quantity'> = {
    productId: 'prod-2',
    productSlug: 'butter-cookies',
    name: 'Butter Cookies',
    price: 29.90,
    currency: 'MYR',
}

describe('CartStore', () => {
    beforeEach(() => {
        localStorageMock.clear()
        useCartStore.setState({ items: [], isOpen: false, siteSlug: '' })
    })

    describe('addItem', () => {
        it('should add a new item with quantity 1', () => {
            useCartStore.getState().addItem(mockItem)
            const items = useCartStore.getState().items
            expect(items).toHaveLength(1)
            expect(items[0].productId).toBe('prod-1')
            expect(items[0].quantity).toBe(1)
        })

        it('should increment quantity when adding same product', () => {
            useCartStore.getState().addItem(mockItem)
            useCartStore.getState().addItem(mockItem)
            const items = useCartStore.getState().items
            expect(items).toHaveLength(1)
            expect(items[0].quantity).toBe(2)
        })

        it('should open cart drawer when item is added', () => {
            useCartStore.getState().addItem(mockItem)
            expect(useCartStore.getState().isOpen).toBe(true)
        })

        it('should persist to localStorage', () => {
            useCartStore.getState().addItem(mockItem)
            const stored = JSON.parse(localStorageMock.getItem('primeweb-cart') || '[]')
            expect(stored).toHaveLength(1)
            expect(stored[0].productId).toBe('prod-1')
        })
    })

    describe('removeItem', () => {
        it('should remove an item by productId', () => {
            useCartStore.getState().addItem(mockItem)
            useCartStore.getState().addItem(mockItem2)
            useCartStore.getState().removeItem('prod-1')
            const items = useCartStore.getState().items
            expect(items).toHaveLength(1)
            expect(items[0].productId).toBe('prod-2')
        })
    })

    describe('updateQuantity', () => {
        it('should update quantity for a product', () => {
            useCartStore.getState().addItem(mockItem)
            useCartStore.getState().updateQuantity('prod-1', 5)
            expect(useCartStore.getState().items[0].quantity).toBe(5)
        })

        it('should remove item when quantity <= 0', () => {
            useCartStore.getState().addItem(mockItem)
            useCartStore.getState().updateQuantity('prod-1', 0)
            expect(useCartStore.getState().items).toHaveLength(0)
        })
    })

    describe('clearCart', () => {
        it('should remove all items', () => {
            useCartStore.getState().addItem(mockItem)
            useCartStore.getState().addItem(mockItem2)
            useCartStore.getState().clearCart()
            expect(useCartStore.getState().items).toHaveLength(0)
        })
    })

    describe('computed values', () => {
        it('itemCount should sum quantities', () => {
            useCartStore.getState().addItem(mockItem)
            useCartStore.getState().addItem(mockItem)
            useCartStore.getState().addItem(mockItem2)
            expect(useCartStore.getState().itemCount()).toBe(3)
        })

        it('subtotal should calculate correctly', () => {
            useCartStore.getState().addItem(mockItem)  // 49.90 x 1
            useCartStore.getState().addItem(mockItem2) // 29.90 x 1
            const subtotal = useCartStore.getState().subtotal()
            expect(subtotal).toBeCloseTo(79.80)
        })

        it('subtotal with multiple quantities', () => {
            useCartStore.getState().addItem(mockItem)
            useCartStore.getState().addItem(mockItem) // 49.90 x 2
            expect(useCartStore.getState().subtotal()).toBeCloseTo(99.80)
        })
    })

    describe('cart drawer', () => {
        it('toggleCart should flip isOpen', () => {
            expect(useCartStore.getState().isOpen).toBe(false)
            useCartStore.getState().toggleCart()
            expect(useCartStore.getState().isOpen).toBe(true)
            useCartStore.getState().toggleCart()
            expect(useCartStore.getState().isOpen).toBe(false)
        })

        it('openCart / closeCart', () => {
            useCartStore.getState().openCart()
            expect(useCartStore.getState().isOpen).toBe(true)
            useCartStore.getState().closeCart()
            expect(useCartStore.getState().isOpen).toBe(false)
        })
    })

    describe('setSiteSlug', () => {
        it('should set site slug', () => {
            useCartStore.getState().setSiteSlug('bella-bakery')
            expect(useCartStore.getState().siteSlug).toBe('bella-bakery')
        })
    })
})
