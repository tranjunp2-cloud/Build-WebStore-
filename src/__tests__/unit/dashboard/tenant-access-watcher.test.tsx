/**
 * Unit Tests: TenantAccessWatcher — false-positive eviction prevention
 * TC-IDs: TC-1270-TAW-01 through TC-1270-TAW-12
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

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('[TC-1270-TAW] TenantAccessWatcher', () => {
    let fetchMock: ReturnType<typeof vi.fn>
    const originalLocation = window.location

    beforeEach(() => {
        vi.useFakeTimers()
        vi.clearAllMocks()

        fetchMock = vi.fn().mockResolvedValue(makeJsonResponse({ ok: true }))
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

        // Assert — dialog shows with "Access Revoked" heading (reason='Unauthenticated')
        expect(screen.getByText('Access Revoked')).toBeInTheDocument()
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
})
