import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// GH-2132 kill switch — toggled per test
const xenditFlag = vi.hoisted(() => ({ enabled: false }))
vi.mock('@/lib/payment/xendit-visibility', () => ({
    get XENDIT_ENABLED() { return xenditFlag.enabled },
}))

const mockFind = vi.fn()
const mockFindByID = vi.fn()
vi.mock('payload', () => ({
    getPayload: vi.fn(() => Promise.resolve({ find: mockFind, findByID: mockFindByID })),
}))
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('next/headers', () => ({ headers: vi.fn(() => Promise.resolve(new Headers())) }))
vi.mock('@/app/sites/[slug]/checkout/CheckoutClient', () => ({ CheckoutClient: () => null }))
vi.mock('@/components/storefront/stripe-back-redirect', () => ({ StripeBackRedirectScript: () => null }))

import CheckoutPage from '@/app/sites/[slug]/checkout/page'

/** Renders the server component and returns the props it passes to <CheckoutClient>. */
async function getInitialSiteData(tenantFull: Record<string, unknown>) {
    mockFind
        .mockResolvedValueOnce({ docs: [{ id: 't1' }] })
        .mockResolvedValueOnce({ docs: [{ id: 's1', paymentConfig: {}, shippingConfig: null, theme: null }] })
    mockFindByID.mockResolvedValueOnce(tenantFull)
    const tree = await CheckoutPage({ params: Promise.resolve({ slug: 'shop' }) })
    const client = (tree.props.children as any[]).find((c) => c?.props?.initialSiteData !== undefined)
    return client.props.initialSiteData
}

// Xendit is the tenant's only possible method: COD/QR/Stripe all off
const XENDIT_ONLY_TENANT = { payments: {}, xenditSecretKey: 'xnd_test_abc' }

describe('Checkout SSR — Xendit temporarily hidden (GH-2132)', () => {
    beforeEach(() => { vi.clearAllMocks() })
    afterEach(() => { xenditFlag.enabled = false })

    it('[TC-F34X-24-05] connected tenant: xenditConnected=false and Xendit does not count as a payment method', async () => {
        const data = await getInitialSiteData(XENDIT_ONLY_TENANT)

        expect(data.xenditConnected).toBe(false)
        expect(data.hasPaymentMethods).toBe(false)
    })

    it('[TC-F34X-24-06] other methods unaffected: COD still enabled for a connected tenant', async () => {
        const data = await getInitialSiteData({ payments: { payment_cod: true }, xenditSecretKey: 'xnd_test_abc' })

        expect(data.xenditConnected).toBe(false)
        expect(data.enableCod).toBe(true)
        expect(data.hasPaymentMethods).toBe(true)
    })

    it('[TC-F34X-24-07] flag on restores Xendit option', async () => {
        xenditFlag.enabled = true
        const data = await getInitialSiteData(XENDIT_ONLY_TENANT)

        expect(data.xenditConnected).toBe(true)
        expect(data.hasPaymentMethods).toBe(true)
    })
})
