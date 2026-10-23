'use client'

import { useEffect, useRef, useCallback } from 'react'
import { useNotificationStore } from '@/store/notificationStore'
import { useI18n } from '@/i18n'
import { useNotificationSignal, type SignalMode } from '@/hooks/use-notification-signal'
import type { NotificationsResponse } from '@/types/notification'

const SYNC_LIMIT = 50
const SINCE_OVERLAP_MS = 5_000       // re-read a little history; seenIds dedupes
const DEBOUNCE_MS = 1_000            // coalesce signal bursts
const MIN_GAP_MS = 3_000             // protect the 60/min API rate limit across tabs/devices
const BROADCAST_JITTER_MS = 5_000    // spread thundering herd after a broadcast
const STALE_MS = 60_000              // refetch on tab focus if older than this
const FALLBACK_POLL_MS = 60_000      // only when Firebase is unavailable
const SEEN_IDS_MAX = 200

/**
 * Headless provider that keeps the unread badge + toasts in sync.
 *
 *  - Firebase RTDB "doorbell" (useNotificationSignal): server rings → we GET /api/notifications.
 *  - Service Worker push messages: instant toast when the OS push arrives.
 *  - Fetch also on mount, tab visible, network back, Firebase reconnect.
 *  - NO interval polling while Firebase is live; 60s polling only as a fallback
 *    when Firebase is off / unreachable / denied.
 *
 * Hidden tabs never fetch: they mark themselves dirty and refresh when shown again.
 */
export function NotificationProvider() {
    const { setUnreadCount } = useNotificationStore()
    const { t, ti } = useI18n()

    const tRef = useRef(t)
    const tiRef = useRef(ti)
    tRef.current = t
    tiRef.current = ti

    const abortRef = useRef<AbortController | null>(null)
    const newestCreatedAtRef = useRef<string | null>(null) // server clock, never client's
    const seenIdsRef = useRef<Set<string>>(new Set())
    const initialDoneRef = useRef(false)
    const dirtyRef = useRef(false)
    const stoppedRef = useRef(false)          // 401: session gone
    const lastSyncAtRef = useRef(0)
    const blockedUntilRef = useRef(0)         // 429 Retry-After
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const jitterTimersRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set())
    const fallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const modeRef = useRef<SignalMode | 'unknown'>('unknown')

    const emitToast = useCallback((detail: { id: string; title: string; type?: string; message?: string }) => {
        window.dispatchEvent(new CustomEvent('notification-toast', { detail }))
    }, [])

    const markSeen = useCallback((id: string) => {
        const seen = seenIdsRef.current
        seen.add(id)
        if (seen.size > SEEN_IDS_MAX) {
            seenIdsRef.current = new Set([...seen].slice(-SEEN_IDS_MAX / 2))
        }
    }, [])

    const sync = useCallback(async () => {
        if (stoppedRef.current) return
        abortRef.current?.abort()
        const controller = new AbortController()
        abortRef.current = controller
        dirtyRef.current = false
        lastSyncAtRef.current = Date.now()

        try {
            const params = new URLSearchParams({ limit: String(SYNC_LIMIT) })
            if (newestCreatedAtRef.current) {
                const since = new Date(Date.parse(newestCreatedAtRef.current) - SINCE_OVERLAP_MS)
                params.set('since', since.toISOString())
            }
            const res = await fetch(`/api/notifications?${params}`, { signal: controller.signal })
            if (res.status === 401) { stoppedRef.current = true; return }
            if (res.status === 429) {
                const wait = Number(res.headers.get('Retry-After')) || 30
                blockedUntilRef.current = Date.now() + wait * 1000
                dirtyRef.current = true
                return
            }
            if (!res.ok) throw new Error(`HTTP ${res.status}`)

            const data = (await res.json()) as NotificationsResponse
            const items = data.items ?? []
            setUnreadCount(data.unreadCount ?? 0)

            for (const item of items) {
                if (item.createdAt && (!newestCreatedAtRef.current || item.createdAt > newestCreatedAtRef.current)) {
                    newestCreatedAtRef.current = item.createdAt
                }
            }

            // Only genuinely new AND still-unread items toast (first sync just seeds).
            const fresh = initialDoneRef.current
                ? items.filter((i) => !seenIdsRef.current.has(i.id) && !i.isRead)
                : []
            for (const item of items) markSeen(item.id)
            initialDoneRef.current = true

            if (fresh.length === 1) {
                const item = fresh[0]
                emitToast({ id: item.id, title: item.title, type: item.type, message: item.message })
            } else if (fresh.length > 1) {
                const title = tiRef.current(tRef.current.notifications.toast.newCount, { count: fresh.length })
                emitToast({ id: `burst-${Date.now()}`, title, type: 'BURST' })
            }
        } catch (err) {
            if ((err as Error).name === 'AbortError') return
            dirtyRef.current = true // retry on next focus / online / reconnect / fallback tick
        }
    }, [setUnreadCount, emitToast, markSeen])

    const requestSync = useCallback(() => {
        if (stoppedRef.current) return
        if (document.hidden) { dirtyRef.current = true; return }
        if (debounceRef.current) return // a sync is already scheduled
        const now = Date.now()
        const delay = Math.max(
            DEBOUNCE_MS,
            MIN_GAP_MS - (now - lastSyncAtRef.current),
            blockedUntilRef.current - now,
        )
        debounceRef.current = setTimeout(() => {
            debounceRef.current = null
            void sync()
        }, delay)
    }, [sync])

    const scheduleFallback = useCallback(() => {
        if (fallbackTimerRef.current) clearTimeout(fallbackTimerRef.current)
        fallbackTimerRef.current = setTimeout(() => {
            fallbackTimerRef.current = null
            if (modeRef.current !== 'fallback') return
            if (document.hidden) dirtyRef.current = true
            else void sync()
            scheduleFallback()
        }, FALLBACK_POLL_MS)
    }, [sync])

    const handleModeChange = useCallback((mode: SignalMode) => {
        if (modeRef.current === mode) return
        modeRef.current = mode
        if (mode === 'fallback') scheduleFallback()
        else if (fallbackTimerRef.current) { clearTimeout(fallbackTimerRef.current); fallbackTimerRef.current = null }
    }, [scheduleFallback])

    const handleBroadcast = useCallback(() => {
        const timers = jitterTimersRef.current
        const timer = setTimeout(() => { timers.delete(timer); requestSync() }, Math.random() * BROADCAST_JITTER_MS)
        timers.add(timer)
    }, [requestSync])

    useNotificationSignal({
        onSignal: requestSync,
        onBroadcast: handleBroadcast,
        onReconnect: requestSync,
        onModeChange: handleModeChange,
    })

    useEffect(() => {
        void sync() // initial load

        // Push from Service Worker: instant toast, unless the signal-sync already showed it.
        function handlePushMessage(event: MessageEvent) {
            if (event.data?.type !== 'PUSH_NOTIFICATION') return
            const payload = event.data.payload
            if (!payload?.id) return
            const id = String(payload.id)
            const alreadyShown = seenIdsRef.current.has(id)
            markSeen(id)
            if (!alreadyShown) {
                emitToast({
                    id,
                    title: payload.title || tRef.current.notifications.toast.newNotification,
                    type: payload.type,
                    message: payload.message,
                })
            }
            requestSync() // badge count
        }
        navigator.serviceWorker?.addEventListener('message', handlePushMessage)

        function handleVisibility() {
            if (document.hidden) return
            if (dirtyRef.current || Date.now() - lastSyncAtRef.current > STALE_MS) requestSync()
        }
        document.addEventListener('visibilitychange', handleVisibility)
        window.addEventListener('online', requestSync)

        const jitterTimers = jitterTimersRef.current
        return () => {
            abortRef.current?.abort()
            if (debounceRef.current) clearTimeout(debounceRef.current)
            if (fallbackTimerRef.current) clearTimeout(fallbackTimerRef.current)
            jitterTimers.forEach(clearTimeout)
            jitterTimers.clear()
            navigator.serviceWorker?.removeEventListener('message', handlePushMessage)
            document.removeEventListener('visibilitychange', handleVisibility)
            window.removeEventListener('online', requestSync)
        }
    }, [sync, requestSync, emitToast, markSeen])

    return null
}
