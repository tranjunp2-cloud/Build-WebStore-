'use client'

import { useEffect, useRef, useCallback } from 'react'
import { useNotificationStore } from '@/store/notificationStore'
import { useI18n } from '@/i18n'
import type { NotificationsResponse } from '@/types/notification'

// Adaptive polling: fast for users without push, slow for users with push
const POLL_FAST_MS = 15_000   // No push subscription → poll frequently
const POLL_SLOW_MS = 60_000   // Has push → poll only for badge sync
const POLL_BACKOFF_MAX_MS = 120_000
const POLL_ERROR_MULTIPLIER = 2
const SEEN_IDS_MAX = 200

function getBasePollInterval(): number {
    if (typeof window === 'undefined') return POLL_FAST_MS
    // If user granted push permission, push handles real-time → slow poll
    if ('Notification' in window && Notification.permission === 'granted') return POLL_SLOW_MS
    return POLL_FAST_MS
}

/**
 * Headless provider that:
 *  1. Listens for push messages from Service Worker (real-time, < 2s)
 *  2. Falls back to polling /api/notifications every 60s (badge sync)
 *
 * Push path: SW receives push → postMessage → this provider → emit toast + sync badge
 * Poll path: fetch /api/notifications?since=... → update badge + detect new items (if no push)
 *
 * Pauses polling when tab is hidden (Visibility API).
 * Resumes immediately on tab focus or network recovery.
 */
export function NotificationProvider() {
    const { setUnreadCount } = useNotificationStore()
    const { t, ti } = useI18n()

    const tRef = useRef(t)
    const tiRef = useRef(ti)
    tRef.current = t
    tiRef.current = ti

    const lastPollRef = useRef<string>(new Date().toISOString())
    const intervalRef = useRef(getBasePollInterval())
    const abortRef = useRef<AbortController | null>(null)

    // Track seen notification IDs to detect genuinely new items
    const seenIdsRef = useRef<Set<string>>(new Set())
    const initialPollDoneRef = useRef(false)

    const emitToast = useCallback((detail: { id: string; title: string; type?: string; message?: string }) => {
        window.dispatchEvent(new CustomEvent('notification-toast', { detail }))
    }, [])

    // Lightweight poll: sync badge count + detect new items (fallback for no-push browsers)
    const poll = useCallback(async () => {
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
            const items = data.items ?? []
            const serverUnread = data.unreadCount ?? 0

            setUnreadCount(serverUnread)

            if (!initialPollDoneRef.current) {
                // First poll: seed seen IDs, don't toast
                for (const item of items) seenIdsRef.current.add(item.id)
                initialPollDoneRef.current = true
            } else {
                // Subsequent polls: toast genuinely new items (fallback if push missed)
                const newItems = items.filter((item) => !seenIdsRef.current.has(item.id))
                for (const item of items) seenIdsRef.current.add(item.id)

                // Cap seen IDs to prevent unbounded memory growth in long sessions
                if (seenIdsRef.current.size > SEEN_IDS_MAX) {
                    const arr = [...seenIdsRef.current]
                    seenIdsRef.current = new Set(arr.slice(-SEEN_IDS_MAX / 2))
                }

                if (newItems.length > 0) {
                    if (newItems.length === 1) {
                        const item = newItems[0]
                        emitToast({ id: item.id, title: item.title, type: item.type, message: item.message })
                    } else {
                        const title = tiRef.current(tRef.current.notifications.toast.newCount, {
                            count: newItems.length,
                        })
                        emitToast({ id: `burst-${Date.now()}`, title, type: 'BURST' })
                    }
                }
            }

            lastPollRef.current = new Date().toISOString()
            intervalRef.current = getBasePollInterval()
        } catch (err) {
            if ((err as Error).name === 'AbortError') return
            intervalRef.current = Math.min(
                intervalRef.current * POLL_ERROR_MULTIPLIER,
                POLL_BACKOFF_MAX_MS,
            )
        }
    }, [setUnreadCount, emitToast])

    useEffect(() => {
        let mounted = true
        let timer: ReturnType<typeof setTimeout> | null = null

        function clearTimer() {
            if (timer) {
                clearTimeout(timer)
                timer = null
            }
        }

        function scheduleNext() {
            if (!mounted) return
            clearTimer()
            timer = setTimeout(async () => {
                await poll()
                scheduleNext()
            }, intervalRef.current)
        }

        // Initial poll immediately
        poll().then(() => scheduleNext())

        // ── Push message from Service Worker (real-time path) ──────────
        function handlePushMessage(event: MessageEvent) {
            if (event.data?.type !== 'PUSH_NOTIFICATION') return
            const payload = event.data.payload
            if (!payload?.id) return

            // Mark as seen so polling doesn't duplicate the toast
            seenIdsRef.current.add(payload.id)

            // Emit in-app toast
            emitToast({
                id: payload.id,
                title: payload.title || tRef.current.notifications.toast.newNotification,
                type: payload.type,
                message: payload.message,
            })

            // Sync badge count from server
            poll()
        }
        navigator.serviceWorker?.addEventListener('message', handlePushMessage)

        // ── Visibility change (pause/resume polling) ──────────────────
        function handleVisibility() {
            if (document.hidden) {
                clearTimer()
            } else {
                clearTimer()
                poll().then(() => scheduleNext())
            }
        }
        document.addEventListener('visibilitychange', handleVisibility)

        // ── Network recovery ──────────────────────────────────────────
        function handleOnline() {
            intervalRef.current = getBasePollInterval()
            clearTimer()
            poll().then(() => scheduleNext())
        }
        window.addEventListener('online', handleOnline)

        return () => {
            mounted = false
            clearTimer()
            if (abortRef.current) abortRef.current.abort()
            navigator.serviceWorker?.removeEventListener('message', handlePushMessage)
            document.removeEventListener('visibilitychange', handleVisibility)
            window.removeEventListener('online', handleOnline)
        }
    }, [poll, emitToast])

    return null
}
