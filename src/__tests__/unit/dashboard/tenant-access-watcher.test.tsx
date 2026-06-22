/**
 * Unit Tests: TenantAccessWatcher — false-positive eviction prevention
 * TC-IDs: TC-1270-TAW-01 through TC-1270-TAW-16
 * Bug: #1270 — "Access Revoked" dialog false-positive on HMR / stale tenant cache
 * Convention: docs/TEST_CONVENTION.md
 */

import React from 'react'
import { render, screen, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { TenantAccessWatcher } from '@/components/dashboard/TenantAccessWatcher'

// ── Module mocks (top-level) ──────────────────────────────────────────────────

vi.mock('lucide-react', () => ({
    LogOut: () => null,
}))

vi.mock('next/navigation', () => ({
    useRouter: vi.fn(() => ({ push: vi.fn() })),
}))

vi.mock('sonner', () => ({
    toast: { error: vi.fn(), success: vi.fn() },
}))

vi.mock('@/i18n', () => ({
    useI18n: () => ({
        t: {
            dashboard: {
                tenantAccessWatcher: {
                    sessionExpiredTitle: 'Session Expired',
                    sessionExpiredBody: 'Your session has expired. Please log in again.',
                    accessRevokedTitle: 'Access Revoked',
                    accessRevokedBody: 'Your access to this workspace has been removed by the workspace owner. You will now be logged out.',
                    subscriptionExpiredTitle: 'Subscription Expired',
                    subscriptionExpiredBody: 'Your subscription has expired. Please renew your plan to continue. You will now be logged out.',
                    accountSuspendedTitle: 'Account Suspended',
                    accountSuspendedBody: 'Your account has been suspended. Please contact support. You will now be logged out.',
                    acknowledge: 'Acknowledge',
                    loggingOut: 'Logging out...',
                },
            },
        },
    }),
}))

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeJsonResponse(data: unknown): Response {
    return new Response(JSON.stringify(data), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
    })
}

// Advance fake timers and flush all React state updates
const advance = (ms: number) =>
    act(async () => {
        await vi.advanceTimersByTimeAsync(ms)
    })

// Filter fetch calls to the refresh-token endpoint
const refreshCalls = (mock: ReturnType<typeof vi.fn>) =>
    mock.mock.calls.filter((c) => String(c[0]).includes('/api/auth/refresh-token'))

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('[TC-1270-TAW] TenantAccessWatcher', () => {
    let fetchMock: ReturnType<typeof vi.fn>
    const originalLocation = window.location

    beforeEach(() => {
        vi.useFakeTimers()
        vi.clearAllMocks()

        // Far-future expiresAt keeps the proactive-refresh gate silent in unrelated tests
        fetchMock = vi.fn().mockResolvedValue(
            makeJsonResponse({ ok: true, expiresAt: Date.now() + 2 * 60 * 60 * 1000 }),
        )
        global.fetch = fetchMock

        // Allow handleAcknowledge to set window.location.href without throwing
        delete (window as any).location
        window.location = { ...originalLocation, href: '' } as any
    })

    afterEach(() => {
        vi.clearAllTimers()  // drain queue before restoring real clock
        vi.useRealTimers()
        window.location = originalLocation
    })

    it('TC-1270-TAW-01: does NOT call session-check before 5s startup delay expires', async () => {
        render(<TenantAccessWatcher />)
        await advance(4999)
        expect(fetchMock).not.toHaveBeenCalled()
    })

    it('TC-1270-TAW-02: calls session-check exactly once after 5s startup delay', async () => {
        render(<TenantAccessWatcher />)
        await advance(5000)
        expect(fetchMock).toHaveBeenCalledTimes(1)
        expect(fetchMock).toHaveBeenCalledWith('/api/auth/session-check', { cache: 'no-store' })
    })

    it('TC-1270-TAW-03: retry:true × 2 then ok:true — no dialog shown throughout', async () => {
        // Arrange — 2 retries then session recovers
        fetchMock
            .mockResolvedValueOnce(makeJsonResponse({ ok: false, retry: true }))
            .mockResolvedValueOnce(makeJsonResponse({ ok: false, retry: true }))
            .mockResolvedValue(makeJsonResponse({ ok: true }))

        render(<TenantAccessWatcher />)
        await advance(5000)  // startup → retry #1 (retryCount=1 < 3)
        await advance(8000)  // retry timer → retry #2 (retryCount=2 < 3)
        await advance(8000)  // retry timer → ok:true (retryCount resets)

        // Assert
        expect(screen.queryByText('Access Revoked')).not.toBeInTheDocument()
    })

    it('TC-1270-TAW-04: retry:true × 3 consecutive → escalates and shows dialog', async () => {
        // Arrange — each call gets a fresh Response (shared body object would throw after first read)
        fetchMock.mockImplementation(() =>
            Promise.resolve(makeJsonResponse({ ok: false, retry: true })),
        )

        render(<TenantAccessWatcher />)
        await advance(5000)  // startup → retry #1 (retryCount=1)
        await advance(8000)  // retry timer → retry #2 (retryCount=2)
        await advance(8000)  // retry timer → retry #3 → cap reached → setIsEvicted

        // Assert — dialog shows "Session Expired" (reason='Unauthenticated', not "removed by owner")
        expect(screen.getByText('Session Expired')).toBeInTheDocument()
    })

    it('TC-1270-TAW-05: subscription_expired → shows dialog immediately (no 2-hit grace period)', async () => {
        // Arrange — subscription check fails at backend (DB-verified, not transient)
        fetchMock.mockResolvedValue(
            makeJsonResponse({ action: 'force_logout', reason: 'subscription_expired' }),
        )

        render(<TenantAccessWatcher />)
        await advance(5000)  // startup → force_logout → immediate setIsEvicted

        // Assert
        expect(screen.getByText('Subscription Expired')).toBeInTheDocument()
    })

    it('TC-1270-TAW-06: Account suspended → shows dialog immediately (no 2-hit grace period)', async () => {
        // Arrange — tenant banned at backend (DB-verified, not transient)
        fetchMock.mockResolvedValue(
            makeJsonResponse({ action: 'force_logout', reason: 'Account suspended' }),
        )

        render(<TenantAccessWatcher />)
        await advance(5000)  // startup → force_logout → immediate setIsEvicted

        // Assert
        expect(screen.getByText('Account Suspended')).toBeInTheDocument()
    })

    it('TC-1270-TAW-07: Removed from workspace × 1 → no dialog (first hit enters 12s grace period)', async () => {
        // Arrange — single force_logout for removal (may be stale cache on first check)
        fetchMock.mockResolvedValue(
            makeJsonResponse({ action: 'force_logout', reason: 'Removed from workspace' }),
        )

        render(<TenantAccessWatcher />)
        await advance(5000)  // startup → first hit → consecutiveFail=1, grace period starts

        // Assert — first hit alone must NOT trigger dialog
        expect(screen.queryByText('Access Revoked')).not.toBeInTheDocument()
    })

    it('TC-1270-TAW-08: Removed from workspace × 2 ≥10s apart → shows dialog', async () => {
        // Arrange — each call gets a fresh Response (shared body object would throw after first read)
        fetchMock.mockImplementation(() =>
            Promise.resolve(makeJsonResponse({ action: 'force_logout', reason: 'Removed from workspace' })),
        )

        render(<TenantAccessWatcher />)
        await advance(5000)   // startup → first hit (consecutiveFail=1, grace period starts)
        await advance(12000)  // grace expires → checkSession → second hit (elapsed≥10s) → setIsEvicted

        // Assert — confirmed removal → dialog shows
        expect(screen.getByText('Access Revoked')).toBeInTheDocument()
    })

    it('TC-1270-TAW-09: ok:true during grace period resets counter — subsequent single hit is silent', async () => {
        // Arrange — first hit → grace → recovery via ok:true → counter reset
        fetchMock
            .mockResolvedValueOnce(makeJsonResponse({ action: 'force_logout', reason: 'Removed from workspace' }))
            .mockResolvedValue(makeJsonResponse({ ok: true }))

        render(<TenantAccessWatcher />)
        await advance(5000)   // startup → first hit (consecutiveFail=1, grace starts)
        await advance(12000)  // grace expires → checkSession → ok:true → counters reset

        // Assert — recovery clears the counter, no dialog after single hit
        expect(screen.queryByText('Access Revoked')).not.toBeInTheDocument()
    })

    it('TC-1270-TAW-10: focus event during 5s startup window does not trigger session-check', async () => {
        render(<TenantAccessWatcher />)
        await advance(2000)  // within startup window — mountedRef still false

        // handleFocus guards: `if (!mountedRef.current) return` fires before any debounce
        window.dispatchEvent(new Event('focus'))
        await advance(2999)  // total 4999ms — debounce delay passed, still before 5s startup

        expect(fetchMock).not.toHaveBeenCalled()
    })

    it('TC-1270-TAW-11: focus event during grace period does not trigger additional session-check', async () => {
        // Arrange — startup returns Removed, entering grace (inGracePeriodRef=true)
        fetchMock.mockImplementation(() =>
            Promise.resolve(makeJsonResponse({ action: 'force_logout', reason: 'Removed from workspace' })),
        )

        render(<TenantAccessWatcher />)
        await advance(5000)  // startup → first hit → grace period (inGracePeriodRef=true)

        const callsAfterStartup = fetchMock.mock.calls.length  // should be 1

        // handleFocus guards: `if (inGracePeriodRef.current) return` blocks any new check
        window.dispatchEvent(new Event('focus'))
        await advance(2000)  // handleFocus debounce (2s) would fire here if not guarded

        // Assert — no additional fetch triggered by focus; no dialog (grace still pending)
        expect(fetchMock).toHaveBeenCalledTimes(callsAfterStartup)
        expect(screen.queryByText('Access Revoked')).not.toBeInTheDocument()
    })

    it('TC-1270-TAW-12: unmounting during 5s startup delay cancels timer — no fetch fires after', async () => {
        const { unmount } = render(<TenantAccessWatcher />)
        await advance(3000)   // within startup window
        unmount()             // cleanup: clearTimeout(startupTimer) + mountedRef=false
        await advance(3000)   // would have been past 5s mark — timer must be cancelled

        expect(fetchMock).not.toHaveBeenCalled()
    })

    it('TC-1270-TAW-13: focus+visibilitychange double-fire counts as one check (5s guard)', async () => {
        // Arrange — valid session; we just want to verify call count
        fetchMock.mockImplementation(() =>
            Promise.resolve(makeJsonResponse({ ok: true })),
        )

        render(<TenantAccessWatcher />)
        await advance(5000)  // startup check fires (lastCheckAt set to now)

        // Simulate tab switch: visibilitychange → immediate checkSession attempt
        // 5s guard: elapsed=0ms < 5000ms → skipped
        document.dispatchEvent(new Event('visibilitychange'))
        await advance(100)

        // focus event → 2s debounce → checkSession attempt
        // 5s guard: elapsed≈2100ms < 5000ms → skipped
        window.dispatchEvent(new Event('focus'))
        await advance(2100)

        // Only the startup check should have hit the server — both double-fire attempts suppressed
        expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    it('TC-1270-TAW-14: ok:true with expiresAt within 15min triggers token refresh', async () => {
        // Arrange — near-expiry response; gate should fire
        fetchMock.mockResolvedValue(
            makeJsonResponse({ ok: true, expiresAt: Date.now() + 5 * 60 * 1000 }),
        )

        render(<TenantAccessWatcher />)
        await advance(5000) // startup check → refresh gate evaluates (5min < REFRESH_THRESHOLD)

        // Assert — one POST to refresh-token was fired
        expect(refreshCalls(fetchMock).length).toBeGreaterThanOrEqual(1)
        expect(refreshCalls(fetchMock)[0][1]).toMatchObject({ method: 'POST' })
    })

    it('TC-1270-TAW-15: token refresh failure does not evict the user', async () => {
        // Arrange — session valid but near expiry; refresh endpoint rejects
        fetchMock.mockImplementation((url: string) => {
            if (String(url).includes('/api/auth/refresh-token')) {
                return Promise.reject(new Error('network error'))
            }
            return Promise.resolve(
                makeJsonResponse({ ok: true, expiresAt: Date.now() + 5 * 60 * 1000 }),
            )
        })

        render(<TenantAccessWatcher />)
        await advance(5000)

        // Assert — refresh fired (caught silently) and user is NOT evicted
        expect(refreshCalls(fetchMock).length).toBeGreaterThanOrEqual(1)
        expect(screen.queryByText('Session Expired')).not.toBeInTheDocument()
        expect(screen.queryByText('Access Revoked')).not.toBeInTheDocument()
    })

    it('TC-1270-TAW-16: ok:true with expiresAt beyond 15min does NOT refresh', async () => {
        // Arrange — token has 30min left; gate should stay silent
        fetchMock.mockResolvedValue(
            makeJsonResponse({ ok: true, expiresAt: Date.now() + 30 * 60 * 1000 }),
        )

        render(<TenantAccessWatcher />)
        await advance(5000) // startup check → gate evaluates (30min > REFRESH_THRESHOLD)

        // Assert — no refresh call
        expect(refreshCalls(fetchMock).length).toBe(0)
    })
})
