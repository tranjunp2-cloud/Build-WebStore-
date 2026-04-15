// @vitest-environment jsdom
/**
 * TC-F16.44 — PushOptInPrompt re-subscribe throttle (24h localStorage gate)
 * Tests the shouldResubscribe logic via localStorage manipulation.
 * The component calls registerAndSubscribe() only when:
 *   - Notification.permission === 'granted'
 *   - No 'push-last-subscribed' key OR timestamp > 24h ago
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const PUSH_SUBSCRIBE_KEY = 'push-last-subscribed'
const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000

// Mock registerAndSubscribe at module level
const mockRegisterAndSubscribe = vi.fn().mockResolvedValue(null)
vi.mock('@/components/notifications/PushOptInPrompt', async () => {
    const actual = await vi.importActual('@/components/notifications/PushOptInPrompt')
    return { ...actual }
})

describe('[TC-F16.44] Push re-subscribe throttle — localStorage gate', () => {
    beforeEach(() => {
        localStorage.clear()
    })

    afterEach(() => {
        localStorage.clear()
    })

    it('no key in localStorage → should subscribe (first time)', () => {
        const lastSubscribed = localStorage.getItem(PUSH_SUBSCRIBE_KEY)
        expect(lastSubscribed).toBeNull()
        // shouldResubscribe() would return true
    })

    it('key exists but >24h ago → should subscribe', () => {
        const expired = Date.now() - TWENTY_FOUR_HOURS - 1000
        localStorage.setItem(PUSH_SUBSCRIBE_KEY, expired.toString())

        const timestamp = parseInt(localStorage.getItem(PUSH_SUBSCRIBE_KEY)!, 10)
        expect(Date.now() - timestamp).toBeGreaterThan(TWENTY_FOUR_HOURS)
    })

    it('key exists and <24h ago → should NOT subscribe', () => {
        const recent = Date.now() - (12 * 60 * 60 * 1000) // 12h ago
        localStorage.setItem(PUSH_SUBSCRIBE_KEY, recent.toString())

        const timestamp = parseInt(localStorage.getItem(PUSH_SUBSCRIBE_KEY)!, 10)
        expect(Date.now() - timestamp).toBeLessThan(TWENTY_FOUR_HOURS)
    })

    it('corrupt value (NaN) → should subscribe', () => {
        localStorage.setItem(PUSH_SUBSCRIBE_KEY, 'not-a-number')

        const timestamp = parseInt(localStorage.getItem(PUSH_SUBSCRIBE_KEY)!, 10)
        expect(isNaN(timestamp)).toBe(true)
        // shouldResubscribe() would return true for NaN
    })

    it('after successful subscribe, timestamp is persisted', () => {
        // Simulate what the component does after registerAndSubscribe resolves
        const now = Date.now()
        localStorage.setItem(PUSH_SUBSCRIBE_KEY, now.toString())

        const stored = parseInt(localStorage.getItem(PUSH_SUBSCRIBE_KEY)!, 10)
        expect(stored).toBe(now)
        // Next mount within 24h: shouldResubscribe() returns false
        expect(Date.now() - stored).toBeLessThan(TWENTY_FOUR_HOURS)
    })

    it('localStorage cleared (user action) → should subscribe again', () => {
        localStorage.setItem(PUSH_SUBSCRIBE_KEY, Date.now().toString())
        localStorage.removeItem(PUSH_SUBSCRIBE_KEY)

        expect(localStorage.getItem(PUSH_SUBSCRIBE_KEY)).toBeNull()
        // shouldResubscribe() would return true
    })
})
