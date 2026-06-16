import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'

// ── Mutable state driving useCartStore mock ───────────────────────────────
let mockItems: import('@/store/cartStore').CartItem[] = []
let mockIsOpen = false

// ── Mutable state driving usePathname mock ────────────────────────────────
let mockPathname = '/sites/test-site'

// ── Top-level mocks (vi.mock hoisted before imports) ─────────────────────
vi.mock('next/navigation', () => ({
    usePathname: vi.fn(() => mockPathname),
}))

vi.mock('@/store/cartStore', () => ({
    useCartStore: vi.fn(() => ({
        items: mockItems,
        isOpen: mockIsOpen,
        closeCart: vi.fn(),
        removeItem: vi.fn(),
        updateQuantity: vi.fn(),
        subtotal: vi.fn(() => mockItems.reduce((s, i) => s + i.price * i.quantity, 0)),
        itemCount: vi.fn(() => mockItems.reduce((s, i) => s + i.quantity, 0)),
    })),
}))

vi.mock('@/lib/analytics/track-event', () => ({ trackEvent: vi.fn() }))
vi.mock('sonner', () => ({ toast: { info: vi.fn(), success: vi.fn(), error: vi.fn() } }))
vi.mock('@/components/site-renderer/OwnerContext', () => ({ useIsOwner: vi.fn(() => false) }))
vi.mock('@/lib/theme/resolve', () => ({
    CSS_VARS: {
        fontBody: 'sans-serif', fontHeading: 'sans-serif',
        primary: '#000000', accent: '#007bff', accentRgb: '0,123,255', surface: '#f0f0f0',
    },
}))
vi.mock('@/i18n', () => ({
    useI18n: vi.fn(() => ({
        t: {
            storefront: {
                cart: {
                    drawerTitle: 'Shopping Cart',
                    subtitle: 'Your items',
                    subtotal: 'Subtotal',
                    shippingNote: 'Shipping calculated at checkout',
                    proceedToCheckout: 'Proceed to Checkout',
                    empty: 'Your cart is empty',
                    checkoutUnavailable: 'Checkout not available',
                },
            },
        },
    })),
}))

// ── Component under test ──────────────────────────────────────────────────
import { CartDrawer } from '@/components/storefront/CartDrawer'

// ── Fixtures ──────────────────────────────────────────────────────────────
const ITEM_ONE: import('@/store/cartStore').CartItem = {
    productId: 'prod-1',
    productSlug: 'test-product',
    name: 'Test Product',
    price: 99.99,
    currency: 'MYR',
    imageUrl: '/image.jpg',
    quantity: 1,
}

// ── TC-F09.219 / TC-F09.220 — CartDrawer checkout routing ─────────────────
describe('CartDrawer — checkout routing', () => {
    beforeEach(() => {
        mockItems = []
        mockIsOpen = false
        mockPathname = '/sites/test-site'
        vi.clearAllMocks()
    })

    afterEach(() => {
        mockItems = []
        mockIsOpen = false
        mockPathname = '/sites/test-site'
    })

    // ── TC-F09.219: Empty cart ─────────────────────────────────────────────
    describe('TC-F09.219: Empty cart → footer visible, checkout disabled', () => {
        it('renders null when drawer is closed', () => {
            // Arrange
            mockItems = []
            mockIsOpen = false
            // Act
            const { container } = render(<CartDrawer siteSlug="test-site" />)
            // Assert
            expect(container.firstChild).toBeNull()
        })

        it('renders footer even when cart is empty', () => {
            // Arrange
            mockItems = []
            mockIsOpen = true
            // Act
            render(<CartDrawer siteSlug="test-site" />)
            // Assert — footer CTA is always rendered (not gated by items.length)
            expect(screen.getByRole('button', { name: /proceed to checkout/i })).toBeInTheDocument()
        })

        it('checkout button is disabled when cart is empty', () => {
            // Arrange
            mockItems = []
            mockIsOpen = true
            // Act
            render(<CartDrawer siteSlug="test-site" />)
            // Assert
            const btn = screen.getByRole('button', { name: /proceed to checkout/i })
            expect(btn).toBeDisabled()
        })

        it('shows empty-cart message when no items', () => {
            // Arrange
            mockItems = []
            mockIsOpen = true
            // Act
            render(<CartDrawer siteSlug="test-site" />)
            // Assert
            expect(screen.getByText('Your cart is empty')).toBeInTheDocument()
        })

        it('does not render subtotal when cart is empty', () => {
            // Arrange
            mockItems = []
            mockIsOpen = true
            // Act
            render(<CartDrawer siteSlug="test-site" />)
            // Assert
            expect(screen.queryByText('Subtotal')).not.toBeInTheDocument()
        })
    })

    // ── TC-F09.220: Items + siteSlug → checkout link ───────────────────────
    describe('TC-F09.220: Cart has items → checkout renders as link with correct href', () => {
        it('renders checkout as <a> when items exist and siteSlug provided', () => {
            // Arrange — local dev: pathname starts with /sites/
            mockItems = [ITEM_ONE]
            mockIsOpen = true
            mockPathname = '/sites/bella-bakery'
            // Act
            render(<CartDrawer siteSlug="bella-bakery" />)
            // Assert — link, not button
            const link = screen.getByRole('link', { name: /proceed to checkout/i })
            expect(link).toBeInTheDocument()
            expect(link).toHaveAttribute('href', '/sites/bella-bakery/checkout')
        })

        it('includes correct siteSlug in checkout href on local dev', () => {
            // Arrange
            mockItems = [ITEM_ONE]
            mockIsOpen = true
            mockPathname = '/sites/shop-alpha'
            // Act
            render(<CartDrawer siteSlug="shop-alpha" />)
            // Assert
            expect(screen.getByRole('link', { name: /proceed to checkout/i }))
                .toHaveAttribute('href', '/sites/shop-alpha/checkout')
        })

        it('uses /checkout (no prefix) on subdomain staging/prod', () => {
            // Arrange — subdomain: pathname does not start with /sites/
            mockItems = [ITEM_ONE]
            mockIsOpen = true
            mockPathname = '/cart'
            // Act
            render(<CartDrawer siteSlug="bella-bakery" />)
            // Assert — no /sites/ prefix on subdomain
            expect(screen.getByRole('link', { name: /proceed to checkout/i }))
                .toHaveAttribute('href', '/checkout')
        })

        it('shows subtotal section when items exist', () => {
            // Arrange
            mockItems = [ITEM_ONE]
            mockIsOpen = true
            // Act
            render(<CartDrawer siteSlug="test-site" />)
            // Assert
            expect(screen.getByText('Subtotal')).toBeInTheDocument()
        })

        it('does not show empty-cart message when items present', () => {
            // Arrange
            mockItems = [ITEM_ONE]
            mockIsOpen = true
            // Act
            render(<CartDrawer siteSlug="test-site" />)
            // Assert
            expect(screen.queryByText('Your cart is empty')).not.toBeInTheDocument()
        })

        it('renders disabled button (not link) when siteSlug is empty string', () => {
            // Arrange — empty siteSlug → hasCheckoutRoute = false
            mockItems = [ITEM_ONE]
            mockIsOpen = true
            // Act
            render(<CartDrawer siteSlug="" />)
            // Assert — no checkout link; fallback button rendered
            expect(screen.queryByRole('link', { name: /proceed to checkout/i })).not.toBeInTheDocument()
            expect(screen.getByRole('button', { name: /proceed to checkout/i })).toBeInTheDocument()
        })
    })
})
