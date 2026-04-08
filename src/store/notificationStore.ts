/**
 * F16 — Notification Store (Zustand)
 * Manages unread count and dropdown open state.
 * Pattern follows builderStore.ts (no persist — always fresh from API on mount).
 */

import { create } from 'zustand'

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

    setUnreadCount: (count) => set({ unreadCount: Math.max(0, count) }),

    incrementUnreadCount: () =>
        set((state) => ({ unreadCount: state.unreadCount + 1 })),

    decrementUnreadCount: (by = 1) =>
        set((state) => ({ unreadCount: Math.max(0, state.unreadCount - by) })),

    setDropdownOpen: (open) => set({ isDropdownOpen: open }),

    resetUnread: () => set({ unreadCount: 0 }),
}))
