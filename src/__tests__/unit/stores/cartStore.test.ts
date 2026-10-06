// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { cartSignature, useCartStore, type CartItem } from '@/store/cartStore'

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
        useCartStore.setState({ items: [], isOpen: false, siteId: '1', siteSlug: 'bella-bakery', refreshStatus: 'idle', resolvedSignature: null, cartRevision: 0, changes: [], requiresConfirmation: false, legacyCartCleared: false })
    })

    afterEach(() => {
        vi.unstubAllGlobals()
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
            const stored = JSON.parse(localStorageMock.getItem('primeweb-cart:1') || '[]')
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

    describe('activateSiteCart', () => {
        it('[TC-F09.14] loads only the active site cart and clears unverifiable legacy data', () => {
            // Arrange
            localStorageMock.setItem('primeweb-cart', JSON.stringify([{ ...mockItem, quantity: 1 }]))
            localStorageMock.setItem('primeweb-cart:2', JSON.stringify([{ ...mockItem2, quantity: 1 }]))

            // Act
            useCartStore.getState().activateSiteCart('2', 'cookie-shop')

            // Assert
            expect(useCartStore.getState().items).toEqual([{ ...mockItem2, quantity: 1 }])
            expect(localStorageMock.getItem('primeweb-cart')).toBeNull()
            expect(useCartStore.getState().legacyCartCleared).toBe(true)
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
            const stored = JSON.parse(localStorageMock.getItem('primeweb-cart:1') || '[]')
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


    // ─── TC-F09.57: Seller product changes reconcile cart snapshots ─────────
    describe('[TC-F09.57] refreshCart reconciliation', () => {
        const currentLine = {
            productId: 1,
            variant: null,
            available: true,
            changed: ['name', 'price', 'imageUrl', 'inventory'],
            product: {
                name: 'Chocolate Cake v2',
                slug: 'chocolate-cake-v2',
                price: 39.9,
                compareAtPrice: 49.9,
                currency: 'MYR',
                imageUrl: '/images/cake-v2.jpg',
                inventory: 2,
                quantity: 2,
            },
        }

        it('[TC-F09.57] applies canonical fields and clamps quantity returned by the resolver', async () => {
            // Arrange
            useCartStore.setState({ siteId: '7', siteSlug: 'bella-bakery' })
            useCartStore.getState().addItem({ ...mockItem, productId: '1' })
            useCartStore.getState().updateQuantity('1', 5)
            vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ lines: [currentLine] }) }))

            // Act
            await useCartStore.getState().refreshCart()

            // Assert
            expect(useCartStore.getState().items).toEqual([{
                ...mockItem,
                productId: '1',
                productSlug: 'chocolate-cake-v2',
                name: 'Chocolate Cake v2',
                price: 39.9,
                compareAtPrice: 49.9,
                imageUrl: '/images/cake-v2.jpg',
                inventory: 2,
                quantity: 2,
                unavailable: false,
            }])
            expect(useCartStore.getState().changes[0]).toMatchObject({ productId: '1', fields: expect.arrayContaining(['price', 'quantity']) })
            expect(useCartStore.getState().resolvedSignature).toBe(cartSignature(useCartStore.getState().items))
            expect(useCartStore.getState().requiresConfirmation).toBe(true)
        })

        it('[TC-F09.57] preserves pending changes across a later no-change refresh until acknowledged', async () => {
            // Arrange
            useCartStore.setState({ siteId: '7', siteSlug: 'bella-bakery' })
            useCartStore.getState().addItem({ ...mockItem, productId: '1' })
            useCartStore.getState().updateQuantity('1', 5)
            const noChangeLine = { ...currentLine, changed: [] }
            vi.stubGlobal('fetch', vi.fn()
                .mockResolvedValueOnce({ ok: true, json: async () => ({ lines: [currentLine] }) })
                .mockResolvedValueOnce({ ok: true, json: async () => ({ lines: [noChangeLine] }) }))

            // Act
            await useCartStore.getState().refreshCart()
            const firstChanges = useCartStore.getState().changes
            await useCartStore.getState().refreshCart()

            // Assert
            expect(useCartStore.getState().changes).toEqual(firstChanges)
            expect(useCartStore.getState().requiresConfirmation).toBe(true)
            expect(useCartStore.getState().resolvedSignature).toBe(cartSignature(useCartStore.getState().items))
        })

        it('[TC-F09.57] merges sequential line changes until the customer acknowledges them', async () => {
            // Arrange
            useCartStore.setState({ siteId: '7', siteSlug: 'bella-bakery' })
            useCartStore.getState().addItem({ ...mockItem, productId: '1', inventory: 10 })
            useCartStore.getState().updateQuantity('1', 3)
            useCartStore.getState().addItem({ ...mockItem2, productId: '2' })
            const productTwoLine = {
                productId: 2,
                variant: null,
                available: true,
                changed: [],
                product: {
                    name: mockItem2.name,
                    slug: mockItem2.productSlug,
                    price: mockItem2.price,
                    currency: mockItem2.currency,
                    inventory: null,
                    quantity: 1,
                },
            }
            const firstRefreshLines = [
                {
                    ...currentLine,
                    changed: ['price'],
                    product: { ...currentLine.product, inventory: 10, quantity: 3 },
                },
                productTwoLine,
            ]
            const secondRefreshLines = [
                {
                    ...currentLine,
                    changed: [],
                    product: { ...currentLine.product, inventory: 2, quantity: 2 },
                },
                {
                    ...productTwoLine,
                    changed: ['price'],
                    product: { ...productTwoLine.product, price: 19.9 },
                },
            ]
            vi.stubGlobal('fetch', vi.fn()
                .mockResolvedValueOnce({ ok: true, json: async () => ({ lines: firstRefreshLines }) })
                .mockResolvedValueOnce({ ok: true, json: async () => ({ lines: secondRefreshLines }) }))

            // Act
            await useCartStore.getState().refreshCart()
            await useCartStore.getState().refreshCart()

            // Assert
            const pendingChanges = useCartStore.getState().changes
            expect(pendingChanges).toHaveLength(2)
            expect(pendingChanges.find(change => change.productId === '1')).toMatchObject({
                fields: expect.arrayContaining(['price', 'quantity']),
                previous: { price: 49.9, quantity: 3 },
                current: { price: 39.9, quantity: 2 },
            })
            expect(pendingChanges.find(change => change.productId === '2')).toMatchObject({
                fields: ['price'],
                previous: { price: 29.9, quantity: 1 },
                current: { price: 19.9, quantity: 1 },
            })
            expect(useCartStore.getState().requiresConfirmation).toBe(true)

            // Act
            useCartStore.getState().acknowledgeChanges()

            // Assert
            expect(useCartStore.getState().changes).toEqual([])
            expect(useCartStore.getState().requiresConfirmation).toBe(false)
        })

        it('[TC-F09.57] clears pending confirmation only when changes are acknowledged', async () => {
            // Arrange
            useCartStore.setState({ siteId: '7', siteSlug: 'bella-bakery' })
            useCartStore.getState().addItem({ ...mockItem, productId: '1' })
            vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ lines: [currentLine] }) }))
            await useCartStore.getState().refreshCart()

            // Act
            useCartStore.getState().acknowledgeChanges()

            // Assert
            expect(useCartStore.getState().changes).toEqual([])
            expect(useCartStore.getState().requiresConfirmation).toBe(false)
        })

        it('[TC-F09.57] preserves a pending price confirmation when quantity changes or another item is added', async () => {
            // Arrange
            useCartStore.setState({ siteId: '7', siteSlug: 'bella-bakery' })
            useCartStore.getState().addItem({ ...mockItem, productId: '1', inventory: 10 })
            const priceChangeLine = {
                ...currentLine,
                changed: ['price'],
                product: { ...currentLine.product, inventory: 10, quantity: 1 },
            }
            vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ lines: [priceChangeLine] }) }))
            await useCartStore.getState().refreshCart()
            const pendingChanges = useCartStore.getState().changes

            // Act
            useCartStore.getState().updateQuantity('1', 2)
            useCartStore.getState().addItem({ ...mockItem2, productId: '2' })

            // Assert
            expect(useCartStore.getState().changes).toEqual(pendingChanges)
            expect(useCartStore.getState().requiresConfirmation).toBe(true)
        })

        it('[TC-F09.57] removes only the pending notice for the cart line that was removed', () => {
            // Arrange
            const itemOne = { ...mockItem, productId: '1', quantity: 1, unavailable: false }
            const itemTwo = { ...mockItem2, productId: '2', quantity: 1, unavailable: false }
            const changeOne = { productId: '1', fields: ['price'], previous: { price: 49.9, quantity: 1 }, current: { price: 39.9, quantity: 1 } }
            const changeTwo = { productId: '2', fields: ['price'], previous: { price: 29.9, quantity: 1 }, current: { price: 19.9, quantity: 1 } }
            useCartStore.setState({ items: [itemOne, itemTwo], changes: [changeOne, changeTwo], requiresConfirmation: true })

            // Act
            useCartStore.getState().removeItem('1')

            // Assert
            expect(useCartStore.getState().changes).toEqual([changeTwo])
            expect(useCartStore.getState().requiresConfirmation).toBe(true)
        })

        it('[TC-F09.57] marks unavailable lines and excludes their obsolete price from subtotal', async () => {
            // Arrange
            useCartStore.setState({ siteId: '7', siteSlug: 'bella-bakery' })
            useCartStore.getState().addItem({ ...mockItem, productId: '1' })
            vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ lines: [{ productId: 1, variant: null, available: false, reason: 'unavailable' }] }) }))

            // Act
            await useCartStore.getState().refreshCart()

            // Assert
            expect(useCartStore.getState().items[0].unavailable).toBe(true)
            expect(useCartStore.getState().subtotal()).toBe(0)
            expect(useCartStore.getState().refreshStatus).toBe('idle')
            expect(useCartStore.getState().changes[0]).toMatchObject({
                productId: '1',
                fields: ['unavailable'],
            })
            expect(useCartStore.getState().requiresConfirmation).toBe(true)
        })

        it('[TC-F09.57] ignores a stale resolver response after the line is removed', async () => {
            // Arrange
            useCartStore.setState({ siteId: '7', siteSlug: 'bella-bakery' })
            useCartStore.getState().addItem({ ...mockItem, productId: '1' })
            let resolveFetch: ((value: unknown) => void) | undefined
            vi.stubGlobal('fetch', vi.fn(() => new Promise(resolve => { resolveFetch = resolve })))
            const refresh = useCartStore.getState().refreshCart()

            // Act
            useCartStore.getState().removeItem('1')
            resolveFetch!({ ok: true, json: async () => ({ lines: [currentLine] }) })
            await refresh

            // Assert
            expect(useCartStore.getState().items).toEqual([])
            expect(useCartStore.getState().resolvedSignature).toBeNull()
        })

        it('[TC-F09.57] preserves cart data when the resolver network request fails', async () => {
            // Arrange
            useCartStore.setState({ siteId: '7', siteSlug: 'bella-bakery' })
            useCartStore.getState().addItem({ ...mockItem, productId: '1' })
            vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network unavailable')))

            // Act
            await useCartStore.getState().refreshCart()

            // Assert
            expect(useCartStore.getState().items).toEqual([{ ...mockItem, productId: '1', quantity: 1, unavailable: false }])
            expect(useCartStore.getState().refreshStatus).toBe('error')
            expect(useCartStore.getState().resolvedSignature).toBeNull()
        })

        it('[TC-F09.57] keeps a newer site refresh deduplicated when an older request settles', async () => {
            // Arrange
            useCartStore.setState({ siteId: '7', siteSlug: 'bella-bakery' })
            useCartStore.getState().addItem({ ...mockItem, productId: '1' })
            localStorageMock.setItem('primeweb-cart:8', JSON.stringify([{ ...mockItem2, productId: '2', quantity: 1, unavailable: false }]))

            let resolveOld: ((value: unknown) => void) | undefined
            let resolveNew: ((value: unknown) => void) | undefined
            const fetchMock = vi.fn()
                .mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve }))
                .mockImplementationOnce(() => new Promise(resolve => { resolveNew = resolve }))
            vi.stubGlobal('fetch', fetchMock)
            const oldRefresh = useCartStore.getState().refreshCart()
            useCartStore.getState().activateSiteCart('8', 'cookie-shop')
            const newRefresh = useCartStore.getState().refreshCart()

            // Act
            resolveOld!({ ok: true, json: async () => ({ lines: [currentLine] }) })
            await oldRefresh
            const deduplicatedRefresh = useCartStore.getState().refreshCart()

            // Assert
            expect(fetchMock).toHaveBeenCalledTimes(2)

            // Arrange — finish the active request so no promise leaks into another test
            resolveNew!({
                ok: true,
                json: async () => ({
                    lines: [{
                        productId: 2,
                        variant: null,
                        available: true,
                        changed: [],
                        product: {
                            name: mockItem2.name,
                            slug: mockItem2.productSlug,
                            price: mockItem2.price,
                            currency: mockItem2.currency,
                            inventory: null,
                            quantity: 1,
                        },
                    }],
                }),
            })

            // Act
            await Promise.all([newRefresh, deduplicatedRefresh])

            // Assert
            expect(fetchMock).toHaveBeenCalledTimes(2)
            expect(useCartStore.getState().siteId).toBe('8')
            expect(useCartStore.getState().refreshStatus).toBe('idle')
        })
    })

})
