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

    // ─── TC-F09.223: Variant dedup and cart operations ─────────────────────

    describe('variants — composite key (productId + variantName)', () => {
        it('[TC-F09.223] addItem with variantName carries variant price', () => {
            // Arrange: product with variant Red @ RM 59.90
            const redVariant: Omit<CartItem, 'quantity'> = {
                ...mockItem,
                price: 59.90, // variant overrides base price
                variantName: 'Red',
            }

            // Act: add variant item to cart
            useCartStore.getState().addItem(redVariant)

            // Assert: cart line preserves variant price and name
            const items = useCartStore.getState().items
            expect(items).toHaveLength(1)
            expect(items[0].price).toBe(59.90)
            expect(items[0].variantName).toBe('Red')
        })

        it('[TC-F09.224] two variants of same product = 2 cart lines', () => {
            // Arrange: same product, different variants
            const redVariant: Omit<CartItem, 'quantity'> = {
                ...mockItem,
                price: 59.90,
                variantName: 'Red',
            }
            const blueVariant: Omit<CartItem, 'quantity'> = {
                ...mockItem,
                price: 64.90,
                variantName: 'Blue',
            }

            // Act: add both variants
            useCartStore.getState().addItem(redVariant)
            useCartStore.getState().addItem(blueVariant)

            // Assert: two separate cart lines
            const items = useCartStore.getState().items
            expect(items).toHaveLength(2)
            expect(items[0].variantName).toBe('Red')
            expect(items[0].price).toBe(59.90)
            expect(items[1].variantName).toBe('Blue')
            expect(items[1].price).toBe(64.90)
        })

        it('[TC-F09.224] removeItem targets only matching variant line', () => {
            // Arrange: cart with Red and Blue variants
            const redVariant: Omit<CartItem, 'quantity'> = {
                ...mockItem,
                price: 59.90,
                variantName: 'Red',
            }
            const blueVariant: Omit<CartItem, 'quantity'> = {
                ...mockItem,
                price: 64.90,
                variantName: 'Blue',
            }
            useCartStore.getState().addItem(redVariant)
            useCartStore.getState().addItem(blueVariant)

            // Act: remove only Red variant
            useCartStore.getState().removeItem('prod-1', 'Red')

            // Assert: only Blue remains
            const items = useCartStore.getState().items
            expect(items).toHaveLength(1)
            expect(items[0].variantName).toBe('Blue')
        })

        it('[TC-F09.224b] updateQuantity targets only matching variant line', () => {
            // Arrange: cart with Red variant
            const redVariant: Omit<CartItem, 'quantity'> = {
                ...mockItem,
                price: 59.90,
                variantName: 'Red',
            }
            useCartStore.getState().addItem(redVariant)
            useCartStore.getState().addItem(redVariant)
            expect(useCartStore.getState().items[0].quantity).toBe(2)

            // Act: update quantity for Red variant only
            useCartStore.getState().updateQuantity('prod-1', 5, 'Red')

            // Assert: quantity updated for Red variant
            const items = useCartStore.getState().items
            expect(items).toHaveLength(1)
            expect(items[0].quantity).toBe(5)
            expect(items[0].variantName).toBe('Red')
        })

        it('[TC-F09.224c] adding same variant twice increments quantity', () => {
            // Arrange: variant item
            const redVariant: Omit<CartItem, 'quantity'> = {
                ...mockItem,
                price: 59.90,
                variantName: 'Red',
            }

            // Act: add twice
            useCartStore.getState().addItem(redVariant)
            useCartStore.getState().addItem(redVariant)

            // Assert: single line with quantity=2
            const items = useCartStore.getState().items
            expect(items).toHaveLength(1)
            expect(items[0].quantity).toBe(2)
            expect(items[0].variantName).toBe('Red')
        })

        it('[TC-F09.224b] removing variant with updateQuantity(0) removes line', () => {
            // Arrange: variant in cart
            const redVariant: Omit<CartItem, 'quantity'> = {
                ...mockItem,
                price: 59.90,
                variantName: 'Red',
            }
            useCartStore.getState().addItem(redVariant)

            // Act: update quantity to 0
            useCartStore.getState().updateQuantity('prod-1', 0, 'Red')

            // Assert: item removed
            expect(useCartStore.getState().items).toHaveLength(0)
        })

        it('[TC-F09.224e] same product without variant and with variant are separate lines', () => {
            // Arrange: product with and without variant
            const baseItem: Omit<CartItem, 'quantity'> = {
                ...mockItem,
                price: 49.90,
                // no variantName
            }
            const variantItem: Omit<CartItem, 'quantity'> = {
                ...mockItem,
                price: 59.90,
                variantName: 'Red',
            }

            // Act: add both
            useCartStore.getState().addItem(baseItem)
            useCartStore.getState().addItem(variantItem)

            // Assert: two separate lines
            const items = useCartStore.getState().items
            expect(items).toHaveLength(2)
            expect(items[0].variantName).toBeUndefined()
            expect(items[0].price).toBe(49.90)
            expect(items[1].variantName).toBe('Red')
            expect(items[1].price).toBe(59.90)
        })

        it('[TC-F09.224d] localStorage persists variant data', () => {
            // Arrange: variant item
            const redVariant: Omit<CartItem, 'quantity'> = {
                ...mockItem,
                price: 59.90,
                variantName: 'Red',
            }

            // Act: add to cart
            useCartStore.getState().addItem(redVariant)

            // Assert: localStorage contains variant
            const stored = JSON.parse(localStorageMock.getItem('primeweb-cart') || '[]')
            expect(stored).toHaveLength(1)
            expect(stored[0].variantName).toBe('Red')
            expect(stored[0].price).toBe(59.90)
        })
    })

    // ─── TC-F09.238: Variant inventory snapshot cap ────────────────────────────
    // Tests the cartStore cap mechanism given a correct inventory snapshot.
    // The propagation of selectedVariant.stock → inventory snapshot is gated by TC-F09.237.

    describe('[TC-F09.238] variant inventory snapshot cap', () => {
        it('[TC-F09.238] addItem caps quantity at stored variant inventory (stock=3)', () => {
            // Arrange: item with inventory=3 (simulates selectedVariant.stock snapshot from fix #1179)
            const variantItem: Omit<CartItem, 'quantity'> = {
                ...mockItem,
                variantName: 'Red',
                inventory: 3,
            }

            // Act: attempt 4 adds (exceeds variant stock of 3)
            useCartStore.getState().addItem(variantItem)
            useCartStore.getState().addItem(variantItem)
            useCartStore.getState().addItem(variantItem)
            useCartStore.getState().addItem(variantItem) // 4th is no-op

            // Assert: quantity capped at variant stock (3), not unlimited
            const items = useCartStore.getState().items
            expect(items).toHaveLength(1)
            expect(items[0].quantity).toBe(3)
        })

        it('[TC-F09.238b] updateQuantity above variant inventory clamps to variant stock', () => {
            // Arrange: Red variant with inventory=3 at qty=2
            const variantItem: Omit<CartItem, 'quantity'> = {
                ...mockItem,
                variantName: 'Red',
                inventory: 3,
            }
            useCartStore.getState().addItem(variantItem)
            useCartStore.getState().addItem(variantItem) // qty=2

            // Act: try to set quantity to 10 (far above variant stock)
            useCartStore.getState().updateQuantity('prod-1', 10, 'Red')

            // Assert: clamped to variant inventory (3)
            expect(useCartStore.getState().items[0].quantity).toBe(3)
        })
    })
})
