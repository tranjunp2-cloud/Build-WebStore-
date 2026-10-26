import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import React from 'react'

const mockCart = vi.hoisted(() => ({ items: [] as Array<Record<string, unknown>> }))
const oneItem = { productId: 'product-1', productSlug: 'snack', name: 'Purrfect Snack Platter', price: 40, currency: 'MYR', quantity: 1 }

vi.mock('next/navigation', () => ({
    usePathname: vi.fn(() => '/sites/the-hehe/checkout'),
    useRouter: vi.fn(() => ({ push: vi.fn(), refresh: vi.fn() })),
}))
vi.mock('next/link', () => ({
    default: ({ href, children }: { href: string; children: React.ReactNode }) => React.createElement('a', { href }, children),
}))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() }, Toaster: () => null }))
vi.mock('@/components/site-renderer/GoogleFontsLoader', () => ({ GoogleFontsLoader: () => null }))
vi.mock('@/lib/analytics/track-event', () => ({ trackEvent: vi.fn() }))
vi.mock('@/store/cartStore', () => ({
    cartSignature: vi.fn(() => 'cart-sig'),
    useCartStore: vi.fn(() => ({
        items: mockCart.items,
        subtotal: vi.fn(() => 40),
        clearCart: vi.fn(),
        activateSiteCart: vi.fn(),
        refreshCart: vi.fn(),
        refreshStatus: 'idle',
        resolvedSignature: 'cart-sig',
        cartRevision: 1,
        changes: [],
        acknowledgeChanges: vi.fn(),
        siteId: 'site-1',
    })),
}))

import { I18nProvider } from '@/i18n'
import { CheckoutClient } from '@/app/sites/[slug]/checkout/CheckoutClient'
import { useCartStore } from '@/store/cartStore'
;(useCartStore as typeof useCartStore & { getState: () => unknown }).getState = () => ({ changes: [], refreshStatus: 'idle', resolvedSignature: 'cart-sig', items: mockCart.items, requiresConfirmation: false })

const siteData = (hasPaymentMethods: boolean) => ({
    siteId: 'site-1', tenantId: 'tenant-1', enableCod: hasPaymentMethods, enableQrBanking: false,
    shippingConfig: { westRate: 500, eastRate: 1500, freeAbove: null },
    stripeConnected: false, stripeEnabled: false, xenditConnected: false, hasPaymentMethods,
})

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })

const renderCheckout = (hasPaymentMethods: boolean) => render(
    <I18nProvider>
        <CheckoutClient slug="the-hehe" initialThemeCSS="" initialFontHeading="Outfit" initialFontBody="Inter" initialSiteData={siteData(hasPaymentMethods)} />
    </I18nProvider>,
)

async function fillForm() {
    fireEvent.change(await screen.findByPlaceholderText('e.g. Ahmad bin Ibrahim'), { target: { value: 'Ahmad' } })
    fireEvent.change(screen.getByPlaceholderText('ahmad@email.com'), { target: { value: 'ahmad@example.com' } })
    fireEvent.change(screen.getByPlaceholderText('+60 12 345 6789'), { target: { value: '+60123456789' } })
    fireEvent.change(screen.getByPlaceholderText(/No\. 17, Jalan Kenari/), { target: { value: 'No. 1' } })
    const state = await screen.findByRole('option', { name: 'Selangor' })
    fireEvent.change(state.closest('select')!, { target: { value: '1' } })
    const district = await screen.findByRole('option', { name: 'Petaling' })
    fireEvent.change(district.closest('select')!, { target: { value: '10' } })
    const postcode = await screen.findByRole('option', { name: '47810' })
    fireEvent.change(postcode.closest('select')!, { target: { value: '47810' } })
}

describe('[TC-F09.262..264] CheckoutClient stays reachable, order placement stays guarded', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        localStorage.clear()
        sessionStorage.clear()
        mockCart.items = [oneItem]
        vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
            const url = String(input)
            if (url === '/api/geo/states') return json([{ id: 1, name: 'Selangor', state_code: 'SGR', zone: 'west' }])
            if (url === '/api/users/me') return json({}, 401)
            if (url === '/api/geo/districts?stateId=1') return json([{ id: 10, name: 'Petaling' }])
            if (url === '/api/geo/postcodes?districtId=10') return json(['47810'])
            if (url === '/api/orders/calculate-shipping') {
                return json({ success: true, data: { fee: 801, rates: [{ priceSen: 801, courierName: 'Standard Delivery' }], isFree: false, degraded: false, codAvailable: true } })
            }
            throw new Error(`Unexpected fetch: ${url}`)
        }))
    })

    afterEach(() => {
        vi.unstubAllGlobals()
    })

    it('[TC-F09.262] an empty cart still shows the checkout form with Place order disabled', async () => {
        // Arrange
        mockCart.items = []

        // Act
        renderCheckout(true)

        // Assert
        expect(await screen.findByText('Order Summary')).toBeInTheDocument()
        expect(screen.getByPlaceholderText('ahmad@email.com')).toBeInTheDocument()
        expect(screen.queryByText(/your cart is empty/i)).not.toBeInTheDocument()
        expect(screen.getByRole('button', { name: /place order|enter address/i })).toBeDisabled()
    })

    it('[TC-F09.263] a store with no payment method shows the form and an inline notice, and Place order stays disabled', async () => {
        // Arrange
        renderCheckout(false)

        // Act
        await fillForm()

        // Assert
        expect(await screen.findByRole('alert', { name: '' })).toHaveTextContent(/checkout unavailable/i)
        expect(screen.getByPlaceholderText('ahmad@email.com')).toBeInTheDocument()
        await waitFor(() => expect(screen.getByRole('button', { name: /place order/i })).toBeDisabled())
    })

    it('[TC-F09.264] control: a store with a payment method has no notice and Place order enables on a complete form', async () => {
        // Arrange
        renderCheckout(true)

        // Act
        await fillForm()

        // Assert
        await waitFor(() => expect(screen.getByRole('button', { name: /place order/i })).toBeEnabled())
        expect(screen.queryByText(/checkout unavailable/i)).not.toBeInTheDocument()
    })
})
