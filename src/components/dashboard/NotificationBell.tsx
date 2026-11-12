'use client'

import { Bell } from 'lucide-react'
import { useNotificationStore } from '@/store/notificationStore'
import { useI18n } from '@/i18n'
import { UnreadBadge } from '@/components/notifications/UnreadBadge'
import { NotificationDropdown } from '@/components/notifications/NotificationDropdown'

/**
 * F16 — NotificationBell
 * Sits in the TopHeader. The unread count comes from the store, kept by NotificationProvider (mounted by the
 * dashboard and editor layouts) — the bell does not fetch on its own.
 * Shows UnreadBadge when count > 0.
 * Toggles dropdown (wired in PR #2).
 */
export function NotificationBell() {
    const { unreadCount, isDropdownOpen, setDropdownOpen } = useNotificationStore()
    const { t, ti } = useI18n()

    return (
        <div className="relative">
            <button
                id="notification-bell-btn"
                aria-label={unreadCount > 0 ? ti(t.notifications.ariaUnread, { count: unreadCount }) : t.notifications.ariaDefault}
                aria-expanded={isDropdownOpen}
                onClick={() => setDropdownOpen(!isDropdownOpen)}
                className="relative flex h-10 w-10 items-center justify-center rounded-[16px] bg-transparent border-none outline-none hover:bg-dash-surface-hover cursor-pointer transition-colors"
            >
                <Bell className="h-5 w-5 text-dash-text-muted" />
                <UnreadBadge count={unreadCount} />
            </button>
            <NotificationDropdown />
        </div>
    )
}
