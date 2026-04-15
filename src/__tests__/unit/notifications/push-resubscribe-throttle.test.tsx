// @vitest-environment jsdom
/**
 * TC-F16.44 — PushOptInPrompt re-subscribe throttle (24h localStorage gate)
 * Renders the component with mocked SW + Notification API, asserts
 * registerAndSubscribe is called/skipped based on localStorage timestamp.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, act } from '@testing-library/react'
import React from 'react'

const PUSH_SUBSCRIBE_KEY = 'push-last-subscribed'
const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000

// Track fetch calls to /api/notifications/push-subscribe
let fetchCalls: string[] = []

// Mock i18n
vi.mock('@/i18n', () => ({
    useI18n: () => ({
        t: {
            notifications: {
                push: { title: 'Enable?', description: 'Desc', enable: 'Enable', later: 'Later' },
            },
        },
    }),
}))

// Stub VAPID key so the component doesn't bail out early
vi.stubEnv('NEXT_PUBLIC_VAPID_PUBLIC_KEY', 'BFake_VAPID_KEY_FOR_TESTING_ONLY_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')

describe('[TC-F16.44] PushOptInPrompt re-subscribe throttle', () => {
    const mockSubscription = {
        toJSON: () => ({ endpoint: 'https://push.example.com', keys: { p256dh: 'a', auth: 'b' } }),
    }

    beforeEach(() => {
        localStorage.clear()
        fetchCalls = []

        // Mock fetch — track push-subscribe calls
        vi.stubGlobal('fetch', vi.fn(async (url: string) => {
            fetchCalls.push(url)
            return { ok: true, json: async () => ({}) }
        }))

        // Mock serviceWorker
        const mockSW = {
            register: vi.fn().mockResolvedValue({
                pushManager: {
                    subscribe: vi.fn().mockResolvedValue(mockSubscription),
                },
            }),
            ready: Promise.resolve({
                pushManager: {
                    subscribe: vi.fn().mockResolvedValue(mockSubscription),
                },
            }),
        }
        Object.defineProperty(navigator, 'serviceWorker', {
            value: mockSW,
            configurable: true,
            writable: true,
        })
    })

    afterEach(() => {
        vi.unstubAllGlobals()
        vi.restoreAllMocks()
        localStorage.clear()
    })

    async function renderWithPermission(permission: string) {
        vi.stubGlobal('Notification', { permission })
        // Dynamic import to pick up env stub
        const { PushOptInPrompt } = await import('@/components/notifications/PushOptInPrompt')
        let result: ReturnType<typeof render>
        await act(async () => {
            result = render(<PushOptInPrompt />)
        })
        // Flush async registerAndSubscribe promise chain
        await act(async () => {
            await new Promise((r) => setTimeout(r, 10))
        })
        return result!
    }

    it('permission=granted, no timestamp → calls registerAndSubscribe', async () => {
        await renderWithPermission('granted')

        const subscribeCalls = fetchCalls.filter((u) => u.includes('push-subscribe'))
        expect(subscribeCalls.length).toBe(1)
        // Timestamp should be persisted
        expect(localStorage.getItem(PUSH_SUBSCRIBE_KEY)).toBeTruthy()
    })

    it('permission=granted, fresh timestamp (<24h) → skips registerAndSubscribe', async () => {
        localStorage.setItem(PUSH_SUBSCRIBE_KEY, Date.now().toString())

        await renderWithPermission('granted')

        const subscribeCalls = fetchCalls.filter((u) => u.includes('push-subscribe'))
        expect(subscribeCalls.length).toBe(0)
    })

    it('permission=granted, expired timestamp (>24h) → calls registerAndSubscribe', async () => {
        const expired = Date.now() - TWENTY_FOUR_HOURS - 1000
        localStorage.setItem(PUSH_SUBSCRIBE_KEY, expired.toString())

        await renderWithPermission('granted')

        const subscribeCalls = fetchCalls.filter((u) => u.includes('push-subscribe'))
        expect(subscribeCalls.length).toBe(1)
    })

    it('permission=granted, corrupt NaN timestamp → calls registerAndSubscribe', async () => {
        localStorage.setItem(PUSH_SUBSCRIBE_KEY, 'not-a-number')

        await renderWithPermission('granted')

        const subscribeCalls = fetchCalls.filter((u) => u.includes('push-subscribe'))
        expect(subscribeCalls.length).toBe(1)
    })

    it('permission=default → skips registerAndSubscribe', async () => {
        await renderWithPermission('default')

        const subscribeCalls = fetchCalls.filter((u) => u.includes('push-subscribe'))
        expect(subscribeCalls.length).toBe(0)
    })

    it('permission=denied → skips registerAndSubscribe', async () => {
        await renderWithPermission('denied')

        const subscribeCalls = fetchCalls.filter((u) => u.includes('push-subscribe'))
        expect(subscribeCalls.length).toBe(0)
    })
})
