'use client'

import { useEffect, useRef } from 'react'
import { connectFirebaseClient, type FirebaseWebConfig } from '@/lib/firebase/firebase-client'

export type SignalMode = 'live' | 'fallback'

export interface NotificationSignalHandlers {
    /** The user's own doorbell rang (new notification or mark-read elsewhere). Also fires once on attach. */
    onSignal: () => void
    /** A broadcast doorbell rang. Also fires once on attach. */
    onBroadcast: () => void
    /** Firebase reconnected after a drop. */
    onReconnect: () => void
    /** `live` = Firebase connected (stop polling); `fallback` = poll every 60s. */
    onModeChange: (mode: SignalMode) => void
}

interface TokenResponse {
    enabled: boolean
    token?: string
    config?: FirebaseWebConfig
    userPath?: string
    broadcastPath?: string
}

const CONNECT_TIMEOUT_MS = 15_000
/** Lost connection after being live for this long → poll until Firebase reconnects. */
const DISCONNECT_FALLBACK_MS = 30_000
const RETRY_DELAYS_MS = [30_000, 60_000, 120_000, 120_000, 120_000]

/**
 * Subscribes to the Firebase RTDB doorbell. Falls back (via onModeChange) when
 * Firebase is off, unreachable, denied or disconnected for 30s after being live
 * (back to live on reconnect). 401 / `enabled:false` / permission denied
 * are final; 429, 5xx and network errors retry with backoff.
 */
export function useNotificationSignal(handlers: NotificationSignalHandlers): void {
    const handlersRef = useRef(handlers)
    handlersRef.current = handlers

    useEffect(() => {
        let cancelled = false
        let connectedOnce = false
        let retryTimer: ReturnType<typeof setTimeout> | null = null
        let connectTimer: ReturnType<typeof setTimeout> | null = null
        let disconnectTimer: ReturnType<typeof setTimeout> | null = null
        let cleanupFirebase: (() => void) | null = null

        let lastMode: SignalMode | null = null
        const mode = (m: SignalMode) => {
            if (cancelled || lastMode === m) return
            lastMode = m
            handlersRef.current.onModeChange(m)
        }

        async function start(attempt: number) {
            const retry = () => {
                mode('fallback')
                if (cancelled || attempt >= RETRY_DELAYS_MS.length) return
                retryTimer = setTimeout(() => void start(attempt + 1), RETRY_DELAYS_MS[attempt])
            }
            // Armed before any network step so a hung token fetch / sign-in also ends in
            // fallback polling instead of "unknown" (= no sync at all).
            if (connectTimer) clearTimeout(connectTimer)
            connectTimer = setTimeout(() => {
                if (connectedOnce || cancelled) return
                console.error('[Signal] Firebase not connected within 15s; falling back to polling')
                mode('fallback')
            }, CONNECT_TIMEOUT_MS)
            try {
                const res = await fetch('/api/notifications/firebase-token', { credentials: 'include' })
                if (cancelled) return
                if (res.status === 401) return mode('fallback')
                if (!res.ok) return retry()
                const data = (await res.json()) as TokenResponse
                if (cancelled) return
                if (!data.enabled || !data.token || !data.config || !data.userPath || !data.broadcastPath) {
                    return mode('fallback')
                }

                // NB: no signOut() when cancelled mid-connect — all mounts share one Firebase
                // Auth, and a late stale start must not sign out the live mount.
                const client = await connectFirebaseClient(data.config, data.token)
                if (cancelled) return

                const { ref, onValue } = await import('firebase/database')
                if (cancelled) return

                const unsubs: Array<() => void> = []
                let detached = false
                let denied = false // sticky: a later `connected` must not flip back to live

                const onDenied = (err: Error) => {
                    if (detached || cancelled) return
                    console.error('[Signal] Firebase listener denied; falling back to polling:', err.message)
                    denied = true
                    mode('fallback')
                }

                // First snapshot of each listener also counts: it covers anything created
                // between the mount-time sync and this listener attaching.
                unsubs.push(onValue(ref(client.db, data.userPath), () => handlersRef.current.onSignal(), onDenied))
                unsubs.push(onValue(ref(client.db, data.broadcastPath), () => handlersRef.current.onBroadcast(), onDenied))
                unsubs.push(onValue(ref(client.db, '.info/connected'), (snap) => {
                    if (denied) return
                    if (snap.val() !== true) {
                        // Dropped after being live: poll if the outage lasts, the SDK keeps reconnecting.
                        if (connectedOnce && !disconnectTimer) {
                            disconnectTimer = setTimeout(() => { disconnectTimer = null; mode('fallback') }, DISCONNECT_FALLBACK_MS)
                        }
                        return
                    }
                    if (disconnectTimer) { clearTimeout(disconnectTimer); disconnectTimer = null }
                    if (connectTimer) { clearTimeout(connectTimer); connectTimer = null }
                    mode('live')
                    if (connectedOnce) handlersRef.current.onReconnect()
                    connectedOnce = true
                }))

                cleanupFirebase = () => {
                    detached = true // ignore cancel callbacks triggered by sign-out
                    unsubs.forEach((u) => u())
                    void client.auth.signOut().catch(() => {}) // best-effort on unmount
                }
            } catch (err) {
                if (cancelled) return
                console.error('[Signal] Firebase connect failed; falling back to polling:', err instanceof Error ? err.message : 'unknown')
                retry()
            }
        }

        void start(0)

        return () => {
            cancelled = true
            if (retryTimer) clearTimeout(retryTimer)
            if (connectTimer) clearTimeout(connectTimer)
            if (disconnectTimer) clearTimeout(disconnectTimer)
            cleanupFirebase?.()
        }
    }, [])
}
