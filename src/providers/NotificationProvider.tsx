'use client'

import { useEffect, useRef } from 'react'
import { useNotificationStore } from '@/store/notificationStore'
import { useI18n } from '@/i18n'
import type { NotificationsResponse } from '@/types/notification'

const DEBOUNCE_MS = 1000
const RECONNECT_BASE_MS = 3000
const RECONNECT_MAX_MS = 60000
const MAX_RECONNECT_ATTEMPTS = 10

/**
 * Headless provider that manages the SSE connection to /api/notifications/stream.
 *
 * On each incoming notification event:
 *  1. Immediately increments the unread badge count
 *  2. Buffers events for 1s (debounce)
 *  3. After quiet period, emits a 'notification-toast' CustomEvent:
 *     - Single event → fetches latest notification for specific toast content
 *     - Burst (N events) → generic "{count} new notifications" toast
 *
 * Auto-reconnects on SSE error with exponential backoff.
 * Cleans up EventSource + timers on unmount.
 */
export function NotificationProvider() {
    const incrementUnreadCount = useNotificationStore((s) => s.incrementUnreadCount)
    const { t, ti } = useI18n()

    // Refs to access latest values in async callbacks without re-triggering effects
    const tRef = useRef(t)
    const tiRef = useRef(ti)
    tRef.current = t
    tiRef.current = ti
    const incrementRef = useRef(incrementUnreadCount)
    incrementRef.current = incrementUnreadCount

    useEffect(() => {
        let mounted = true
        let eventSource: EventSource | null = null
        const buffer: string[] = []
        let debounceTimer: ReturnType<typeof setTimeout> | null = null
        let reconnectTimer: ReturnType<typeof setTimeout> | null = null
        let reconnectAttempts = 0

        function emitToast(detail: { id: string; title: string; type?: string; message?: string }) {
            window.dispatchEvent(new CustomEvent('notification-toast', { detail }))
        }

        async function processBuffer() {
            const events = buffer.splice(0)
            if (events.length === 0) return

            if (events.length === 1) {
                try {
                    const res = await fetch('/api/notifications?limit=1')
                    if (res.ok) {
                        const data = (await res.json()) as NotificationsResponse
                        const item = data.items?.[0]
                        if (item) {
                            emitToast({
                                id: item.id,
                                title: item.title,
                                type: item.type,
                                message: item.message,
                            })
                            return
                        }
                    }
                } catch {
                    // Fallback to generic toast below
                }
                emitToast({
                    id: events[0],
                    title: tRef.current.notifications.toast.newNotification,
                })
            } else {
                const title = tiRef.current(tRef.current.notifications.toast.newCount, {
                    count: events.length,
                })
                emitToast({ id: `burst-${Date.now()}`, title, type: 'BURST' })
            }
        }

        function connect() {
            if (!mounted) return
            if (eventSource) eventSource.close()

            const es = new EventSource('/api/notifications/stream')
            eventSource = es

            es.addEventListener('connected', () => {
                reconnectAttempts = 0
            })

            es.addEventListener('notification', (event: MessageEvent) => {
                try {
                    const data = JSON.parse(event.data) as { id?: string | number }
                    incrementRef.current()
                    buffer.push(String(data.id ?? Date.now()))
                    if (debounceTimer) clearTimeout(debounceTimer)
                    debounceTimer = setTimeout(() => processBuffer(), DEBOUNCE_MS)
                } catch {
                    // Malformed event — ignore
                }
            })

            es.onerror = () => {
                es.close()
                eventSource = null
                if (mounted && reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
                    const delay = Math.min(
                        RECONNECT_BASE_MS * 2 ** reconnectAttempts,
                        RECONNECT_MAX_MS,
                    )
                    reconnectAttempts += 1
                    reconnectTimer = setTimeout(() => connect(), delay)
                }
            }
        }

        connect()

        return () => {
            mounted = false
            if (eventSource) eventSource.close()
            if (debounceTimer) clearTimeout(debounceTimer)
            if (reconnectTimer) clearTimeout(reconnectTimer)
        }
    }, []) // eslint-disable-line react-hooks/exhaustive-deps -- refs used for latest values

    return null
}
