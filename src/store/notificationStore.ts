/**
 * F16 — Notification Store (Zustand)
 * Manages unread count and dropdown open state.
 * Pattern follows builderStore.ts (no persist — always fresh from API on mount).
 * Cross-tab sync via BroadcastChannel for mark-read actions.
 */

import { create } from 'zustand'

// ── Cross-tab sync ────────────────────────────────────────────────────────

const channel = typeof window !== 'undefined'
    ? new BroadcastChannel('notification-sync')
    : null

// ── Types ─────────────────────────────────────────────────────────────────

type NotificationState = {
    unreadCount: number
    isDropdownOpen: boolean
}

type NotificationActions = {
    setUnreadCount: (count: number) => void
    incrementUnreadCount: () => void
    decrementUnreadCount: (by?: number) => void
    setDropdownOpen: (open: boolean) => void
    resetUnread: () => void
}

// ── Store ──────────────────────────────────────────────────────────────────

export const useNotificationStore = create<NotificationState & NotificationActions>()((set) => ({
    unreadCount: 0,
    isDropdownOpen: false,

    setUnreadCount: (count) => {
        set({ unreadCount: Math.max(0, count) })
        channel?.postMessage({ action: 'setUnreadCount', count: Math.max(0, count) })
    },

    incrementUnreadCount: () =>
        set((state) => ({ unreadCount: state.unreadCount + 1 })),
        // Don't broadcast increment — SSE already delivers to all tabs

    decrementUnreadCount: (by = 1) =>
        set((state) => ({ unreadCount: Math.max(0, state.unreadCount - by) })),

    setDropdownOpen: (open) => set({ isDropdownOpen: open }),

    resetUnread: () => {
        set({ unreadCount: 0 })
        channel?.postMessage({ action: 'resetUnread' })
    },
}))

// ── Listen for messages from other tabs ───────────────────────────────────

if (channel) {
    channel.onmessage = (event) => {
        const { action, count } = event.data
        if (action === 'resetUnread') {
            // Use setState directly to avoid re-broadcasting
            useNotificationStore.setState({ unreadCount: 0 })
        } else if (action === 'setUnreadCount' && typeof count === 'number') {
            useNotificationStore.setState({ unreadCount: Math.max(0, count) })
        }
    }
}
