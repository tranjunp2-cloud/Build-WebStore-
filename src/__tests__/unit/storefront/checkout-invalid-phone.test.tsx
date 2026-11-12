import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import React from 'react'

const mockCartState = { changes: [], refreshStatus: 'idle', resolvedSignature: 'cart-sig', items: [{ productId: 'product-1', quantity: 1 }], requiresConfirmation: false }

vi.mock('next/navigation', () => ({
    usePathname: vi.fn(() => '/sites/the-hehe/checkout'),
    useRouter: vi.fn(() => ({ push: vi.fn(), refresh: vi.fn() })),
}))

vi.mock('next/link', () => ({
    default: ({ href, children }: { href: string; children: React.ReactNode }) =>
        React.createElement('a', { href }, children),
}))

vi.mock('sonner', () => ({
    toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
    Toaster: () => null,
}))

vi.mock('@/components/site-renderer/GoogleFontsLoader', () => ({
    GoogleFontsLoader: () => null,
}))

vi.mock('@/lib/analytics/track-event', () => ({ trackEvent: vi.fn() }))

vi.mock('@/store/cartStore', () => ({
    cartSignature: vi.fn(() => 'cart-sig'),
    useCartStore: vi.fn(() => ({
        items: [{
            productId: 'product-1',
            productSlug: 'purrfect-snack-platter',
            name: 'Purrfect Snack Platter',
            price: 40,
            currency: 'MYR',
            quantity: 1,
        }],
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
;(useCartStore as typeof useCartStore & { getState: () => typeof mockCartState }).getState = () => mockCartState

const initialSiteData = {
    siteId: 'site-1',
    tenantId: 'tenant-1',
    enableCod: true,
    enableQrBanking: true,
    shippingConfig: { westRate: 500, eastRate: 1500, freeAbove: null },
    stripeConnected: false,
    stripeEnabled: false,
    xenditConnected: false,
    hasPaymentMethods: true,
}

function jsonResponse(data: unknown, status = 200) {
    return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })
}

async function fillCheckoutForm(phone: string) {
    fireEvent.change(await screen.findByPlaceholderText('e.g. Ahmad bin Ibrahim'), { target: { value: 'Ahmad' } })
    fireEvent.change(screen.getByPlaceholderText('ahmad@email.com'), { target: { value: 'ahmad@example.com' } })
    fireEvent.change(screen.getByPlaceholderText('+60 12 345 6789'), { target: { value: phone } })
    fireEvent.change(screen.getByPlaceholderText(/No\. 17, Jalan Kenari/), { target: { value: 'No. 1' } })

    const stateOption = await screen.findByRole('option', { name: 'Selangor' })
    fireEvent.change(stateOption.closest('select')!, { target: { value: '1' } })
    const districtOption = await screen.findByRole('option', { name: 'Petaling' })
    fireEvent.change(districtOption.closest('select')!, { target: { value: '10' } })
    const postcodeOption = await screen.findByRole('option', { name: '47810' })
    fireEvent.change(postcodeOption.closest('select')!, { target: { value: '47810' } })
}

async function waitForShippingSettled() {
    await waitFor(() => {
        const summary = screen.getByText('Order Summary').closest('.sum-card')
        expect(summary!.querySelector('.st-v')).toHaveTextContent('RM45.00')
    })
}

function renderCheckout() {
    render(
        <I18nProvider>
            <CheckoutClient
                slug="the-hehe"
                initialThemeCSS=""
                initialFontHeading="Outfit"
                initialFontBody="Inter"
                initialSiteData={initialSiteData}
            />
        </I18nProvider>,
    )
}

// ── TC-F09.299: Place Order locked while phone is not a valid MY number (GH-2208) ──
describe('[TC-F09.299] CheckoutClient blocks Place Order for invalid phone', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        localStorage.clear()
        sessionStorage.clear()

        vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
            const url = String(input)
            if (url === '/api/geo/states') return jsonResponse([{ id: 1, name: 'Selangor', state_code: 'SGR', zone: 'west' }])
            if (url === '/api/users/me') return jsonResponse({}, 401)
            if (url === '/api/geo/districts?stateId=1') return jsonResponse([{ id: 10, name: 'Petaling' }])
            if (url === '/api/geo/postcodes?districtId=10') return jsonResponse(['47810'])
            if (url === '/api/orders/calculate-shipping') {
                return jsonResponse({
                    success: true,
                    data: { fee: 500, rates: [{ priceSen: 500, courierName: 'Standard Delivery' }], isFree: false, degraded: false, codAvailable: true },
                })
            }
            throw new Error(`Unexpected fetch: ${url}`)
        }))
    })

    afterEach(() => {
        vi.unstubAllGlobals()
    })

    it('keeps Place Order disabled when phone is 123456789 (issue repro)', async () => {
        // Arrange
        renderCheckout()

        // Act
        await fillCheckoutForm('123456789')

        // Assert — wait until shipping settles so only the phone can be the blocker
        await waitForShippingSettled()
        expect(screen.getByRole('button', { name: /place order/i })).toBeDisabled()
    })

    it('keeps Place Order disabled when phone is empty', async () => {
        // Arrange
        renderCheckout()

        // Act
        await fillCheckoutForm('')

        // Assert
        await waitForShippingSettled()
        expect(screen.getByRole('button', { name: /place order/i })).toBeDisabled()
    })

    it('enables Place Order once phone is a valid MY mobile', async () => {
        // Arrange
        renderCheckout()

        // Act
        await fillCheckoutForm('012-345 6789')

        // Assert
        await waitFor(() => expect(screen.getByRole('button', { name: /place order/i })).toBeEnabled())
    })
})
