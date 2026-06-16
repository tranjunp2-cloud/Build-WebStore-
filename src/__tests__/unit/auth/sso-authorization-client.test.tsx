/**
 * TC-SSOPW2-13: SsoAuthorizationClient — client-side redirect guard
 * Verifies the whitelist guard prevents open redirect when the SSO session
 * endpoint returns a disallowed destination.
 * Convention: docs/TEST_CONVENTION.md | TC-IDs: docs/qa/F-SSO-PW2.md
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import { SsoAuthorizationClient } from '@/app/sso/authorization/_components/SsoAuthorizationClient'

// ── Module mocks ──────────────────────────────────────────────────────────────

vi.mock('next/image', () => ({
    default: vi.fn(() => null),
}))

vi.mock('lucide-react', () => ({
    Loader2: vi.fn(() => null),
}))

vi.mock('@/i18n', () => ({
    useI18n: vi.fn(() => ({
        t: {
            onboarding: {
                welcome: { title: 'Welcome', subtitle: 'Please wait...' },
            },
        },
    })),
}))

// ── window.location mock ──────────────────────────────────────────────────────

let capturedHref = ''
let fetchMock: ReturnType<typeof vi.fn>

const originalLocationDescriptor = Object.getOwnPropertyDescriptor(window, 'location')

beforeEach(() => {
    capturedHref = ''
    Object.defineProperty(window, 'location', {
        configurable: true,
        value: {
            get href() { return capturedHref },
            set href(v: string) { capturedHref = v },
        },
    })
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
    if (originalLocationDescriptor) {
        Object.defineProperty(window, 'location', originalLocationDescriptor)
    }
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
})

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('[TC-SSOPW2-13] SsoAuthorizationClient — redirect guard', () => {
    it('TC-SSOPW2-13a: redirects to /login when v2Token is absent', async () => {
        render(<SsoAuthorizationClient />)
        await waitFor(() => expect(capturedHref).toBe('/login?error=invalid_token'))
        expect(fetchMock).not.toHaveBeenCalled()
    })

    it('TC-SSOPW2-13b: follows allowed redirect from server (/dashboard)', async () => {
        fetchMock.mockResolvedValue({
            json: () => Promise.resolve({ ok: true, redirectTo: '/dashboard' }),
        })
        render(<SsoAuthorizationClient v2Token="valid-token" />)
        await waitFor(() => expect(capturedHref).toBe('/dashboard'))
    })

    it('TC-SSOPW2-13c: follows allowed redirect from server (/onboarding)', async () => {
        fetchMock.mockResolvedValue({
            json: () => Promise.resolve({ ok: true, redirectTo: '/onboarding' }),
        })
        render(<SsoAuthorizationClient v2Token="valid-token" />)
        await waitFor(() => expect(capturedHref).toBe('/onboarding'))
    })

    it('TC-SSOPW2-13: falls back to /dashboard when server returns disallowed redirectTo (open redirect guard)', async () => {
        // Core security assertion: even if the server is compromised and returns
        // an external URL, the client whitelist must block it and default to /dashboard.
        fetchMock.mockResolvedValue({
            json: () => Promise.resolve({ ok: true, redirectTo: '//evil.com' }),
        })
        render(<SsoAuthorizationClient v2Token="valid-token" />)
        await waitFor(() => expect(capturedHref).toBe('/dashboard'))
    })

    it('TC-SSOPW2-13d: falls back to /dashboard for absolute external URL', async () => {
        fetchMock.mockResolvedValue({
            json: () => Promise.resolve({ ok: true, redirectTo: 'https://evil.com/steal' }),
        })
        render(<SsoAuthorizationClient v2Token="valid-token" />)
        await waitFor(() => expect(capturedHref).toBe('/dashboard'))
    })

    it('TC-SSOPW2-13e: redirects to /login when server returns ok:false', async () => {
        fetchMock.mockResolvedValue({
            json: () => Promise.resolve({ ok: false, error: 'invalid_token' }),
        })
        render(<SsoAuthorizationClient v2Token="valid-token" />)
        await waitFor(() => expect(capturedHref).toBe('/login?error=invalid_token'))
    })

    it('TC-SSOPW2-13f: redirects to /login on network failure', async () => {
        fetchMock.mockRejectedValue(new Error('network error'))
        render(<SsoAuthorizationClient v2Token="valid-token" />)
        await waitFor(() => expect(capturedHref).toBe('/login?error=invalid_token'))
    })
})
