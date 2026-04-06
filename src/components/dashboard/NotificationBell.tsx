'use client'

import { useEffect, useRef } from 'react'
import { Bell } from 'lucide-react'
import { useNotificationStore } from '@/store/notificationStore'
import { UnreadBadge } from '@/components/notifications/UnreadBadge'
import type { NotificationsResponse } from '@/types/notification'

/**
 * F16 — NotificationBell
 * Sits in the TopHeader. Fetches unread count on mount.
 * Shows UnreadBadge when count > 0.
 * Toggles dropdown (wired in PR #2).
 */
export function NotificationBell() {
    const { unreadCount, setUnreadCount, isDropdownOpen, setDropdownOpen } = useNotificationStore()
    const hasFetched = useRef(false)

    // Fetch initial unread count once on mount
    useEffect(() => {
        if (hasFetched.current) return
        hasFetched.current = true

        fetch('/api/notifications?limit=1')
            .then((res) => {
                if (!res.ok) return
                return res.json() as Promise<NotificationsResponse>
            })
            .then((data) => {
                if (data?.unreadCount !== undefined) {
                    setUnreadCount(data.unreadCount)
                }
            })
            .catch(() => {
                // Silent fail — badge stays at 0
            })
    }, [setUnreadCount])

    return (
        <button
            id="notification-bell-btn"
            aria-label={unreadCount > 0 ? `${unreadCount} unread notifications` : 'Notifications'}
            aria-expanded={isDropdownOpen}
            onClick={() => setDropdownOpen(!isDropdownOpen)}
            className="relative flex h-10 w-10 items-center justify-center rounded-[16px] bg-transparent border-none outline-none hover:bg-white/5 cursor-pointer transition-colors"
        >
            <Bell className="h-5 w-5 text-[#F8FAFC]" />
            <UnreadBadge count={unreadCount} />
        </button>
    )
}
