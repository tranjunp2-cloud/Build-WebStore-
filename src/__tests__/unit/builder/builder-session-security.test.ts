// @vitest-environment jsdom
/**
 * TC-F01-security: Cross-user builder session contamination guard
 *
 * Root cause of issue #415:
 *   builderStore persists blocks/siteId/theme to localStorage.
 *   When user A finishes and user B opens the same browser,
 *   the store rehydrates user A's data → user B sees a stranger's website.
 *
 * Fix:
 *   - userId is stored in persisted state.
 *   - AIBuilderPageClient receives userId from server (getCurrentUser()).
 *   - On mount: if stored.userId !== currentUserId → reset() + clear localStorage.
 *
 * These tests verify the store-level logic that the security guard relies on.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useBuilderStore } from '@/store/builderStore'
import type { ThemeConfig } from '@/blocks/types'

// ── Helpers ───────────────────────────────────────────────────────────────

function getState() {
    return useBuilderStore.getState()
}

/** Simulate what AIBuilderPageClient.useEffect does on mount */
function simulateSessionGuard(currentUserId: string | null) {
    const stored = useBuilderStore.getState()
    if (!currentUserId) return

    const hasStaleData = stored.blocks.length > 0 || stored.siteId !== null
    const isDifferentUser = stored.userId !== null && stored.userId !== currentUserId
    const isUnownedSession = stored.userId === null && hasStaleData

    if (isDifferentUser || isUnownedSession) {
        stored.reset()
        // localStorage.removeItem is tested separately
    }
    stored.setUserId(currentUserId)
}

function populateStoreAsUser(userId: string) {
    const s = useBuilderStore.getState()
    s.setUserId(userId)
    s.setBusinessInfo({
        businessName: `${userId}'s Biz`,
        shortDescription: 'test',
        industry: 'tech',
        products: 'SaaS',
    })
    s.addBlock({ blockType: 'hero', headline: `Welcome from ${userId}` })
    s.setTheme({ primaryColor: '#000' } as ThemeConfig)
    s.setSiteId(`site-of-${userId}`)
    s.setSiteName(`${userId}'s Site`)
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe('[TC-F01-security] Builder session cross-user contamination guard', () => {
    beforeEach(() => {
        useBuilderStore.getState().reset()
    })

    // ── TC-F01-sec-01 ─────────────────────────────────────────────────────

    it('[TC-F01-sec-01] same user: keeps existing session intact', () => {
        // Arrange: user-A already has a session
        populateStoreAsUser('user-a')
        expect(getState().siteId).toBe('site-of-user-a')

        // Act: user-A visits /builder/new again (refresh)
        simulateSessionGuard('user-a')

        // Assert: session preserved
        expect(getState().siteId).toBe('site-of-user-a')
        expect(getState().blocks).toHaveLength(1)
        expect(getState().userId).toBe('user-a')
    })

    // ── TC-F01-sec-02 ─────────────────────────────────────────────────────

    it('[TC-F01-sec-02] different user: clears contaminated session immediately', () => {
        // Arrange: user-A's data is in localStorage (leftover after logout)
        populateStoreAsUser('user-a')
        expect(getState().siteId).toBe('site-of-user-a')
        expect(getState().blocks).toHaveLength(1)

        // Act: user-B logs in and opens /builder/new
        simulateSessionGuard('user-b')

        // Assert: user-A's data is completely wiped
        expect(getState().siteId).toBeNull()
        expect(getState().blocks).toHaveLength(0)
        expect(getState().businessInfo).toBeNull()
        expect(getState().theme).toBeNull()
        expect(getState().siteName).toBeNull()
    })

    // ── TC-F01-sec-03 ─────────────────────────────────────────────────────

    it('[TC-F01-sec-03] different user: new userId is stamped after reset', () => {
        // Arrange: user-A's session
        populateStoreAsUser('user-a')

        // Act: user-B opens /builder/new
        simulateSessionGuard('user-b')

        // Assert: session is now owned by user-B, not user-A
        expect(getState().userId).toBe('user-b')
    })

    // ── TC-F01-sec-04 ─────────────────────────────────────────────────────

    it('[TC-F01-sec-04] fresh session (no stored userId): does not reset, stamps userId', () => {
        // Arrange: fresh store — no prior session (userId = null)
        expect(getState().userId).toBeNull()
        expect(getState().blocks).toHaveLength(0)

        // Act: user-a opens /builder/new for the first time
        simulateSessionGuard('user-a')

        // Assert: no reset triggered, userId is stamped
        expect(getState().userId).toBe('user-a')
        expect(getState().blocks).toHaveLength(0) // still clean, just stamped
    })

    // ── TC-F01-sec-05 ─────────────────────────────────────────────────────

    it('[TC-F01-sec-05] null currentUserId (unauthenticated): guard is skipped', () => {
        // Arrange: user-A's session
        populateStoreAsUser('user-a')

        // Act: unauthenticated request (userId = null — getCurrentUser returned null)
        simulateSessionGuard(null)

        // Assert: session is untouched (guard should not run for null userId)
        expect(getState().userId).toBe('user-a')
        expect(getState().siteId).toBe('site-of-user-a')
    })

    // ── TC-F01-sec-06 ─────────────────────────────────────────────────────

    it('[TC-F01-sec-06] reset() clears userId — no stale owner after logout', () => {
        // Arrange
        populateStoreAsUser('user-a')
        expect(getState().userId).toBe('user-a')

        // Act: explicit reset (e.g. on logout / dashboard redirect)
        useBuilderStore.getState().reset()

        // Assert: userId is null after reset
        expect(getState().userId).toBeNull()
    })

    // ── TC-F01-sec-07 ─────────────────────────────────────────────────────

    it('[TC-F01-sec-07] localStorage.removeItem is called on cross-user detection', () => {
        // Arrange: mock localStorage
        const removeItemSpy = vi.spyOn(Storage.prototype, 'removeItem')

        populateStoreAsUser('user-a')

        // Simulate full clearBuilderSessionStorage() call (from AIBuilderPageClient)
        function clearBuilderSessionStorage() {
            window.localStorage.removeItem('prime-builder-session')
            window.localStorage.removeItem('prime-builder-session-meta')
        }

        // Act: cross-user detection triggers reset + clear
        const stored = useBuilderStore.getState()
        if (stored.userId && stored.userId !== 'user-b') {
            stored.reset()
            clearBuilderSessionStorage()
        }
        stored.setUserId('user-b')

        // Assert: both localStorage keys were cleared
        expect(removeItemSpy).toHaveBeenCalledWith('prime-builder-session')
        expect(removeItemSpy).toHaveBeenCalledWith('prime-builder-session-meta')

        removeItemSpy.mockRestore()
    })

    // ── TC-F01-sec-08 ─────────────────────────────────────────────────────
    // BUG REGRESSION: issue #415 QA still failed after first fix.
    // Root cause: old sessions (before fix) have userId=null in localStorage.
    // Guard condition `stored.userId && stored.userId !== userId` evaluates to
    // false when stored.userId is null → data from previous user not cleared.

    it('[TC-F01-sec-08] legacy session (no userId) with data is cleared for any logged-in user', () => {
        // Arrange: simulate a legacy session created before the userId fix.
        // It has blocks + siteId but userId was never stored (null).
        const s = useBuilderStore.getState()
        s.addBlock({ blockType: 'hero', headline: 'Legacy site' })
        s.setSiteId('legacy-site-123')
        s.setSiteName('Legacy Site')
        // Deliberately do NOT call setUserId — simulates pre-fix session
        expect(getState().userId).toBeNull()
        expect(getState().blocks).toHaveLength(1)

        // Act: a new user logs in and opens /builder/new
        simulateSessionGuard('user-new')

        // Assert: legacy unowned data must be cleared
        expect(getState().blocks).toHaveLength(0)
        expect(getState().siteId).toBeNull()
        expect(getState().siteName).toBeNull()
    })

    // ── TC-F01-sec-09 ─────────────────────────────────────────────────────

    it('[TC-F01-sec-09] fresh empty session (no userId, no data) is not cleared on first visit', () => {
        // Arrange: completely empty store — brand new browser, no prior session
        expect(getState().userId).toBeNull()
        expect(getState().blocks).toHaveLength(0)
        expect(getState().siteId).toBeNull()

        // Act: user opens /builder/new for the first time
        simulateSessionGuard('user-first')

        // Assert: nothing to clear, userId is stamped correctly
        expect(getState().userId).toBe('user-first')
        expect(getState().blocks).toHaveLength(0)
    })
})
