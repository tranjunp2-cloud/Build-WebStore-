import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render } from '@testing-library/react'
import React from 'react'

// ── Mocks ────────────────────────────────────────────────────────────────
const mockFetch = vi.fn(() => Promise.resolve({ ok: true }))

const mockSessionStorage: Record<string, string> = {}
const sessionStorageMock = {
    getItem: vi.fn((key: string) => mockSessionStorage[key] || null),
    setItem: vi.fn((key: string, value: string) => { mockSessionStorage[key] = value }),
    removeItem: vi.fn((key: string) => { delete mockSessionStorage[key] }),
    clear: vi.fn(() => { Object.keys(mockSessionStorage).forEach(k => delete mockSessionStorage[k]) }),
    get length() { return Object.keys(mockSessionStorage).length },
    key: vi.fn(() => null),
}

const MOCK_UUID = 'test-uuid-1234-5678'

// ── Imports ──────────────────────────────────────────────────────────────
import { TrackingManager } from '@/components/site-renderer/TrackingManager'

// ── Setup / Teardown ─────────────────────────────────────────────────────
beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch)
    vi.stubGlobal('sessionStorage', sessionStorageMock)
    vi.stubGlobal('crypto', { randomUUID: vi.fn(() => MOCK_UUID) })

    Object.defineProperty(window, 'location', {
        value: { pathname: '/test-page' },
        writable: true,
        configurable: true,
    })
    Object.defineProperty(document, 'referrer', {
        value: 'https://google.com',
        writable: true,
        configurable: true,
    })

    // Clear state
    Object.keys(mockSessionStorage).forEach(k => delete mockSessionStorage[k])
    mockFetch.mockClear()
    sessionStorageMock.getItem.mockClear()
    sessionStorageMock.setItem.mockClear()
})

afterEach(() => {
    vi.restoreAllMocks()
})

// ── Tests ────────────────────────────────────────────────────────────────
describe('TrackingManager', () => {
    // TC-F09-TRACK-01: Renders null — no DOM output
    it('TC-F09-TRACK-01: renders null — no DOM output', () => {
        const { container } = render(<TrackingManager siteId="site-1" />)
        expect(container.innerHTML).toBe('')
    })

    // TC-F09-TRACK-02: Calls fetch POST /api/analytics/track on mount
    it('TC-F09-TRACK-02: calls POST /api/analytics/track on mount', async () => {
        render(<TrackingManager siteId="site-1" />)

        await vi.waitFor(() => {
            expect(mockFetch).toHaveBeenCalledOnce()
        })

        expect(mockFetch).toHaveBeenCalledWith('/api/analytics/track', expect.objectContaining({
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
        }))
    })

    // TC-F09-TRACK-03: Payload correct: siteId, event='pageview', pageUrl, referrer
    it('TC-F09-TRACK-03: sends correct payload with siteId, event, pageUrl, referrer', async () => {
        render(<TrackingManager siteId="site-123" />)

        await vi.waitFor(() => {
            expect(mockFetch).toHaveBeenCalledOnce()
        })

        const body = JSON.parse(mockFetch.mock.calls[0][1].body)
        expect(body).toEqual({
            siteId: 'site-123',
            event: 'pageview',
            pageUrl: '/test-page',
            referrer: 'https://google.com',
            sessionId: MOCK_UUID,
        })
    })

    // TC-F09-TRACK-04: Skips tracking when isOwner=true
    it('TC-F09-TRACK-04: skips tracking when isOwner=true', async () => {
        render(<TrackingManager siteId="site-1" isOwner={true} />)

        // Give useEffect time to fire (if it were going to)
        await new Promise(r => setTimeout(r, 50))
        expect(mockFetch).not.toHaveBeenCalled()
    })

    // TC-F09-TRACK-05: Skips tracking when siteId is empty
    it('TC-F09-TRACK-05: skips tracking when siteId is empty', async () => {
        render(<TrackingManager siteId="" />)

        await new Promise(r => setTimeout(r, 50))
        expect(mockFetch).not.toHaveBeenCalled()
    })

    // TC-F09-TRACK-06: Silent failure — no throw on fetch error
    it('TC-F09-TRACK-06: silent failure — no throw on fetch error', async () => {
        mockFetch.mockRejectedValueOnce(new Error('Network error'))

        // Should not throw
        expect(() => {
            render(<TrackingManager siteId="site-1" />)
        }).not.toThrow()

        await vi.waitFor(() => {
            expect(mockFetch).toHaveBeenCalledOnce()
        })
    })

    // TC-F09-TRACK-07: Tracks only once per mount (useRef guard)
    it('TC-F09-TRACK-07: tracks only once per mount (useRef guard)', async () => {
        const { rerender } = render(<TrackingManager siteId="site-1" />)

        await vi.waitFor(() => {
            expect(mockFetch).toHaveBeenCalledOnce()
        })

        // Re-render with same props
        rerender(<TrackingManager siteId="site-1" />)
        await new Promise(r => setTimeout(r, 50))

        expect(mockFetch).toHaveBeenCalledOnce()
    })

    // TC-F09-TRACK-08: Generates sessionId in sessionStorage
    it('TC-F09-TRACK-08: generates sessionId and stores in sessionStorage', async () => {
        render(<TrackingManager siteId="site-1" />)

        await vi.waitFor(() => {
            expect(mockFetch).toHaveBeenCalledOnce()
        })

        expect(sessionStorageMock.getItem).toHaveBeenCalledWith('pw-session')
        expect(sessionStorageMock.setItem).toHaveBeenCalledWith('pw-session', MOCK_UUID)

        const body = JSON.parse(mockFetch.mock.calls[0][1].body)
        expect(body.sessionId).toBe(MOCK_UUID)
    })
})
