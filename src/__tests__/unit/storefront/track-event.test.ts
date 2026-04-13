import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ── Mocks ────────────────────────────────────────────────────────────────
const mockFetch = vi.fn(() => Promise.resolve({ ok: true }))

const mockSessionStorage: Record<string, string> = {}
const sessionStorageMock = {
    getItem: vi.fn((key: string) => mockSessionStorage[key] || null),
    setItem: vi.fn((key: string, value: string) => { mockSessionStorage[key] = value }),
    removeItem: vi.fn((key: string) => { delete mockSessionStorage[key] }),
    clear: vi.fn(),
    get length() { return Object.keys(mockSessionStorage).length },
    key: vi.fn(() => null),
}

const MOCK_UUID = 'evt-uuid-1234-5678'

// ── Import ───────────────────────────────────────────────────────────────
import { trackEvent } from '@/lib/analytics/track-event'

// ── Setup / Teardown ─────────────────────────────────────────────────────
beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch)
    vi.stubGlobal('sessionStorage', sessionStorageMock)
    vi.stubGlobal('crypto', { randomUUID: vi.fn(() => MOCK_UUID) })

    Object.defineProperty(window, 'location', {
        value: { pathname: '/products/test-product' },
        writable: true,
        configurable: true,
    })
    Object.defineProperty(document, 'referrer', {
        value: 'https://facebook.com',
        writable: true,
        configurable: true,
    })

    Object.keys(mockSessionStorage).forEach(k => delete mockSessionStorage[k])
    mockFetch.mockClear()
    sessionStorageMock.getItem.mockClear()
    sessionStorageMock.setItem.mockClear()
})

afterEach(() => {
    vi.restoreAllMocks()
})

// ── Tests ────────────────────────────────────────────────────────────────
describe('trackEvent', () => {
    // TC-F03-EVT-01: Fires POST /api/analytics/track with correct event type
    it('TC-F03-EVT-01: fires POST /api/analytics/track with add_to_cart event', () => {
        trackEvent({ siteId: '1', event: 'add_to_cart' })

        expect(mockFetch).toHaveBeenCalledOnce()
        expect(mockFetch).toHaveBeenCalledWith('/api/analytics/track', expect.objectContaining({
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
        }))

        const body = JSON.parse(mockFetch.mock.calls[0][1].body)
        expect(body.event).toBe('add_to_cart')
        expect(body.siteId).toBe('1')
    })

    // TC-F03-EVT-02: Sends checkout event with metadata
    it('TC-F03-EVT-02: sends checkout event with metadata', () => {
        trackEvent({
            siteId: '1',
            event: 'checkout',
            metadata: { itemCount: 3, subtotal: 150.00 },
        })

        const body = JSON.parse(mockFetch.mock.calls[0][1].body)
        expect(body.event).toBe('checkout')
        expect(body.metadata).toEqual({ itemCount: 3, subtotal: 150.00 })
    })

    // TC-F03-EVT-03: Sends purchase event with order metadata
    it('TC-F03-EVT-03: sends purchase event with order metadata', () => {
        trackEvent({
            siteId: '1',
            event: 'purchase',
            metadata: { orderNumber: 'ORD-12345678', total: 106, currency: 'MYR', itemCount: 2 },
        })

        const body = JSON.parse(mockFetch.mock.calls[0][1].body)
        expect(body.event).toBe('purchase')
        expect(body.metadata.orderNumber).toBe('ORD-12345678')
    })

    // TC-F03-EVT-04: Sends click event with CTA metadata
    it('TC-F03-EVT-04: sends click event with CTA label and URL', () => {
        trackEvent({
            siteId: '1',
            event: 'click',
            metadata: { label: 'Shop Now', url: '/products', variant: 'banner' },
        })

        const body = JSON.parse(mockFetch.mock.calls[0][1].body)
        expect(body.event).toBe('click')
        expect(body.metadata.label).toBe('Shop Now')
    })

    // TC-F03-EVT-05: Uses window.location.pathname as default pageUrl
    it('TC-F03-EVT-05: uses window.location.pathname as default pageUrl', () => {
        trackEvent({ siteId: '1', event: 'add_to_cart' })

        const body = JSON.parse(mockFetch.mock.calls[0][1].body)
        expect(body.pageUrl).toBe('/products/test-product')
    })

    // TC-F03-EVT-06: Allows custom pageUrl override
    it('TC-F03-EVT-06: allows custom pageUrl override', () => {
        trackEvent({ siteId: '1', event: 'click', pageUrl: '/custom-page' })

        const body = JSON.parse(mockFetch.mock.calls[0][1].body)
        expect(body.pageUrl).toBe('/custom-page')
    })

    // TC-F03-EVT-07: Includes referrer from document.referrer
    it('TC-F03-EVT-07: includes referrer from document.referrer', () => {
        trackEvent({ siteId: '1', event: 'click' })

        const body = JSON.parse(mockFetch.mock.calls[0][1].body)
        expect(body.referrer).toBe('https://facebook.com')
    })

    // TC-F03-EVT-08: Generates and reuses sessionId from sessionStorage
    it('TC-F03-EVT-08: generates sessionId and stores in sessionStorage', () => {
        trackEvent({ siteId: '1', event: 'click' })

        expect(sessionStorageMock.getItem).toHaveBeenCalledWith('pw-session')
        expect(sessionStorageMock.setItem).toHaveBeenCalledWith('pw-session', MOCK_UUID)

        const body = JSON.parse(mockFetch.mock.calls[0][1].body)
        expect(body.sessionId).toBe(MOCK_UUID)
    })

    // TC-F03-EVT-09: Reuses existing sessionId from sessionStorage
    it('TC-F03-EVT-09: reuses existing sessionId from sessionStorage', () => {
        mockSessionStorage['pw-session'] = 'existing-session-id'

        trackEvent({ siteId: '1', event: 'click' })

        expect(sessionStorageMock.setItem).not.toHaveBeenCalled()
        const body = JSON.parse(mockFetch.mock.calls[0][1].body)
        expect(body.sessionId).toBe('existing-session-id')
    })

    // TC-F03-EVT-10: Skips tracking on preview/builder pages
    it('TC-F03-EVT-10: skips tracking on /preview/ pages', () => {
        Object.defineProperty(window, 'location', {
            value: { pathname: '/preview/1' },
            writable: true,
            configurable: true,
        })

        trackEvent({ siteId: '1', event: 'click' })
        expect(mockFetch).not.toHaveBeenCalled()
    })

    it('TC-F03-EVT-10b: skips tracking on /builder/ pages', () => {
        Object.defineProperty(window, 'location', {
            value: { pathname: '/builder/new' },
            writable: true,
            configurable: true,
        })

        trackEvent({ siteId: '1', event: 'click' })
        expect(mockFetch).not.toHaveBeenCalled()
    })

    // TC-F03-EVT-11: Silent failure on fetch error (Scenario #44)
    it('TC-F03-EVT-11: silent failure — no throw on fetch error', () => {
        mockFetch.mockRejectedValueOnce(new Error('Network error'))

        expect(() => {
            trackEvent({ siteId: '1', event: 'purchase' })
        }).not.toThrow()

        expect(mockFetch).toHaveBeenCalledOnce()
    })

    // TC-F03-EVT-12: Handles sessionStorage unavailable (private browsing)
    it('TC-F03-EVT-12: handles sessionStorage unavailable (private browsing)', () => {
        vi.stubGlobal('sessionStorage', {
            getItem: () => { throw new Error('SecurityError') },
            setItem: () => { throw new Error('SecurityError') },
        })

        expect(() => {
            trackEvent({ siteId: '1', event: 'add_to_cart' })
        }).not.toThrow()

        const body = JSON.parse(mockFetch.mock.calls[0][1].body)
        expect(body.sessionId).toBe('')
    })

    // TC-F03-EVT-13: Multiple calls fire independently (Scenario #40)
    it('TC-F03-EVT-13: multiple calls fire independently — no dedup', () => {
        trackEvent({ siteId: '1', event: 'click' })
        trackEvent({ siteId: '1', event: 'add_to_cart' })
        trackEvent({ siteId: '1', event: 'checkout' })

        expect(mockFetch).toHaveBeenCalledTimes(3)

        const events = mockFetch.mock.calls.map(c => JSON.parse(c[1].body).event)
        expect(events).toEqual(['click', 'add_to_cart', 'checkout'])
    })
})
