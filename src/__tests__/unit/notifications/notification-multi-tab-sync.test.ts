// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi, beforeAll } from 'vitest'

// ── TC-F16.18: Multi-tab notification sync via BroadcastChannel ────────

// Must set up BroadcastChannel BEFORE store module evaluates
const mockPostMessage = vi.fn()
let onMessageCallback: ((event: any) => void) | null = null

beforeAll(() => {
    // Inject BroadcastChannel into global BEFORE module loads
    ;(globalThis as any).BroadcastChannel = class MockBroadcastChannel {
        name: string
        constructor(name: string) {
            this.name = name
        }
        postMessage = mockPostMessage
        set onmessage(cb: ((event: any) => void) | null) {
            onMessageCallback = cb
        }
        get onmessage() {
            return onMessageCallback
        }
        close = vi.fn()
    }
})

// Force fresh module evaluation with our mock BroadcastChannel in place
// Use dynamic import to ensure BroadcastChannel is set before module evaluates
let useNotificationStore: typeof import('@/store/notificationStore').useNotificationStore

beforeAll(async () => {
    // Reset module registry so store re-evaluates with our BroadcastChannel
    vi.resetModules()
    const mod = await import('@/store/notificationStore')
    useNotificationStore = mod.useNotificationStore
})

function getState() {
    return useNotificationStore.getState()
}

function simulateMessageFromOtherTab(data: any) {
    if (onMessageCallback) {
        onMessageCallback({ data })
    }
}

describe('[TC-F16.18] Multi-tab sync — BroadcastChannel', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        useNotificationStore.setState({ unreadCount: 0, isDropdownOpen: false })
    })

    it('broadcasts setUnreadCount to other tabs', () => {
        getState().setUnreadCount(5)

        expect(mockPostMessage).toHaveBeenCalledWith({
            action: 'setUnreadCount',
            count: 5,
        })
    })

    it('broadcasts resetUnread to other tabs', () => {
        getState().setUnreadCount(10)
        vi.clearAllMocks()

        getState().resetUnread()

        expect(mockPostMessage).toHaveBeenCalledWith({ action: 'resetUnread' })
        expect(getState().unreadCount).toBe(0)
    })

    it('does NOT broadcast incrementUnreadCount (SSE handles this)', () => {
        getState().incrementUnreadCount()

        expect(mockPostMessage).not.toHaveBeenCalled()
    })

    it('does NOT broadcast decrementUnreadCount', () => {
        getState().setUnreadCount(5)
        vi.clearAllMocks()

        getState().decrementUnreadCount(2)

        expect(mockPostMessage).not.toHaveBeenCalled()
    })

    it('receives resetUnread from other tab → updates local state', () => {
        getState().setUnreadCount(10)
        vi.clearAllMocks()

        simulateMessageFromOtherTab({ action: 'resetUnread' })

        expect(getState().unreadCount).toBe(0)
        // Should NOT re-broadcast (avoids infinite loop)
        expect(mockPostMessage).not.toHaveBeenCalled()
    })

    it('receives setUnreadCount from other tab → updates local state', () => {
        simulateMessageFromOtherTab({ action: 'setUnreadCount', count: 7 })

        expect(getState().unreadCount).toBe(7)
        expect(mockPostMessage).not.toHaveBeenCalled()
    })

    it('ignores unknown actions from other tabs', () => {
        getState().setUnreadCount(5)
        vi.clearAllMocks()

        simulateMessageFromOtherTab({ action: 'unknownAction' })

        expect(getState().unreadCount).toBe(5)
    })

    it('clamps negative count from setUnreadCount broadcast', () => {
        getState().setUnreadCount(-3)

        expect(getState().unreadCount).toBe(0)
        expect(mockPostMessage).toHaveBeenCalledWith({
            action: 'setUnreadCount',
            count: 0,
        })
    })

    it('clamps negative count received from other tab', () => {
        simulateMessageFromOtherTab({ action: 'setUnreadCount', count: -5 })

        expect(getState().unreadCount).toBe(0)
    })
})
