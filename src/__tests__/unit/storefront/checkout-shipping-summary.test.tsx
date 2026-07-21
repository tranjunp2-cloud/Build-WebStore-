import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import React from 'react'

const mockRefreshCart = vi.fn()
const mockActivateSiteCart = vi.fn()

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
        activateSiteCart: mockActivateSiteCart,
        refreshCart: mockRefreshCart,
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
    return new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json' },
    })
}

// ── TC-F14.159: Checkout shipping money-unit integration ───────────────────
describe('[TC-F14.159] CheckoutClient shipping money-unit integration', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        localStorage.clear()
        sessionStorage.clear()

        vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
            const url = String(input)
            if (url === '/api/geo/states') {
                return jsonResponse([{ id: 1, name: 'Selangor', state_code: 'SGR', zone: 'west' }])
            }
            if (url === '/api/users/me') return jsonResponse({}, 401)
            if (url === '/api/geo/districts?stateId=1') {
                return jsonResponse([{ id: 10, name: 'Petaling' }])
            }
            if (url === '/api/geo/postcodes?districtId=10') return jsonResponse(['47810'])
            if (url === '/api/orders/calculate-shipping') {
                return jsonResponse({
                    success: true,
                    data: {
                        fee: 801,
                        rates: [{ priceSen: 801, courierName: 'Standard Delivery' }],
                        isFree: false,
                        degraded: false,
                        codAvailable: true,
                    },
                })
            }
            throw new Error(`Unexpected fetch: ${url}`)
        }))
    })

    afterEach(() => {
        vi.useRealTimers()
        vi.unstubAllGlobals()
    })

    it('renders RM 8.01 shipping and RM 48.01 total from the canonical priceSen quote', async () => {
        // Arrange
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

        // Act
        const stateOption = await screen.findByRole('option', { name: 'Selangor' })
        fireEvent.change(stateOption.closest('select')!, { target: { value: '1' } })

        const districtOption = await screen.findByRole('option', { name: 'Petaling' })
        fireEvent.change(districtOption.closest('select')!, { target: { value: '10' } })

        const postcodeOption = await screen.findByRole('option', { name: '47810' })
        fireEvent.change(postcodeOption.closest('select')!, { target: { value: '47810' } })

        // Assert
        const summary = screen.getByText('Order Summary').closest('.sum-card')
        expect(summary).not.toBeNull()
        await waitFor(() => {
            expect(within(summary!).getByText('RM 8.01')).toBeVisible()
            expect(summary!.querySelector('.st-v')).toHaveTextContent('RM48.01')
        })

        const quoteCall = vi.mocked(fetch).mock.calls.find(([url]) => String(url) === '/api/orders/calculate-shipping')
        expect(quoteCall).toBeDefined()
        expect(JSON.parse(String(quoteCall![1]?.body))).toMatchObject({ subtotalSen: 4000 })
    })
})
