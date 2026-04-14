'use client'

import { useEffect, useRef, useCallback } from 'react'
import { useNotificationStore } from '@/store/notificationStore'
import { useI18n } from '@/i18n'
import type { NotificationsResponse } from '@/types/notification'

const POLL_INTERVAL_MS = 15_000
const POLL_BACKOFF_MAX_MS = 60_000
const POLL_ERROR_MULTIPLIER = 2

/**
 * Headless provider that polls /api/notifications for new notifications.
 *
 * On each poll cycle:
 *  1. Fetches notifications newer than last check
 *  2. Updates unread badge count
 *  3. Emits 'notification-toast' CustomEvent for new items:
 *     - Single new item → fetches details for specific toast
 *     - Multiple new items → generic "{count} new notifications" toast
 *
 * Pauses polling when tab is hidden (Visibility API).
 * Uses AbortController to prevent overlapping fetches.
 * Exponential backoff on consecutive errors.
 */
export function NotificationProvider() {
    const { setUnreadCount } = useNotificationStore()
    const { t, ti } = useI18n()

    const tRef = useRef(t)
    const tiRef = useRef(ti)
    tRef.current = t
    tiRef.current = ti

    const lastPollRef = useRef<string>(new Date().toISOString())
    const intervalRef = useRef(POLL_INTERVAL_MS)
    const prevUnreadRef = useRef<number | null>(null)
    const abortRef = useRef<AbortController | null>(null)

    const emitToast = useCallback((detail: { id: string; title: string; type?: string; message?: string }) => {
        window.dispatchEvent(new CustomEvent('notification-toast', { detail }))
    }, [])

    const poll = useCallback(async () => {
        // Abort any in-flight request
        if (abortRef.current) abortRef.current.abort()
        const controller = new AbortController()
        abortRef.current = controller

        try {
            const since = encodeURIComponent(lastPollRef.current)
            const res = await fetch(`/api/notifications?since=${since}`, {
                signal: controller.signal,
            })

            if (!res.ok) throw new Error(`HTTP ${res.status}`)

            const data = (await res.json()) as NotificationsResponse
            const newItems = data.items ?? []
            const serverUnread = data.unreadCount ?? 0

            // Update unread count from server (source of truth)
            setUnreadCount(serverUnread)

            // Emit toast only for genuinely new notifications
            const hadPrevCount = prevUnreadRef.current !== null
            const countDelta = hadPrevCount ? serverUnread - (prevUnreadRef.current ?? 0) : 0
            prevUnreadRef.current = serverUnread

            if (hadPrevCount && countDelta > 0 && newItems.length > 0) {
                if (newItems.length === 1) {
                    const item = newItems[0]
                    emitToast({
                        id: item.id,
                        title: item.title,
                        type: item.type,
                        message: item.message,
                    })
                } else {
                    const title = tiRef.current(tRef.current.notifications.toast.newCount, {
                        count: newItems.length,
                    })
                    emitToast({ id: `burst-${Date.now()}`, title, type: 'BURST' })
                }
            }

            lastPollRef.current = new Date().toISOString()
            // Reset interval on success
            intervalRef.current = POLL_INTERVAL_MS
        } catch (err) {
            if ((err as Error).name === 'AbortError') return
            // Exponential backoff on error
            intervalRef.current = Math.min(
                intervalRef.current * POLL_ERROR_MULTIPLIER,
                POLL_BACKOFF_MAX_MS,
            )
        }
    }, [setUnreadCount, emitToast])

    useEffect(() => {
        let mounted = true
        let timer: ReturnType<typeof setTimeout> | null = null

        function scheduleNext() {
            if (!mounted) return
            timer = setTimeout(async () => {
                await poll()
                scheduleNext()
            }, intervalRef.current)
        }

        // Initial poll immediately
        poll().then(() => scheduleNext())

        // Pause/resume on visibility change
        function handleVisibility() {
            if (document.hidden) {
                if (timer) clearTimeout(timer)
                timer = null
            } else {
                // Fetch immediately on tab focus, then resume schedule
                poll().then(() => scheduleNext())
            }
        }

        document.addEventListener('visibilitychange', handleVisibility)

        return () => {
            mounted = false
            if (timer) clearTimeout(timer)
            if (abortRef.current) abortRef.current.abort()
            document.removeEventListener('visibilitychange', handleVisibility)
        }
    }, [poll])

    return null
}
