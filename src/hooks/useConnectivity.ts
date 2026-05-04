'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

type PendingSave = {
    fn: () => Promise<void>
    id: string
}

export function useConnectivity() {
    const [isOnline, setIsOnline] = useState(
        typeof navigator !== 'undefined' ? navigator.onLine : true
    )
    const [isSyncing, setIsSyncing] = useState(false)
    const pendingSavesRef = useRef<PendingSave[]>([])

    useEffect(() => {
        const handleOnline = () => setIsOnline(true)
        const handleOffline = () => setIsOnline(false)

        window.addEventListener('online', handleOnline)
        window.addEventListener('offline', handleOffline)

        return () => {
            window.removeEventListener('online', handleOnline)
            window.removeEventListener('offline', handleOffline)
        }
    }, [])

    // Auto-replay queued saves on reconnect
    useEffect(() => {
        if (!isOnline || pendingSavesRef.current.length === 0) return

        const replay = async () => {
            setIsSyncing(true)
            const saves = [...pendingSavesRef.current]
            pendingSavesRef.current = []

            for (const save of saves) {
                try {
                    await save.fn()
                } catch {
                    // Re-queue failed saves
                    pendingSavesRef.current.push(save)
                }
            }
            setIsSyncing(false)
        }

        void replay()
    }, [isOnline])

    const queueSave = useCallback((id: string, fn: () => Promise<void>) => {
        // Remove existing save with same id (dedup)
        pendingSavesRef.current = pendingSavesRef.current.filter(s => s.id !== id)
        pendingSavesRef.current.push({ id, fn })
    }, [])

    // beforeunload warning — check ref directly inside handler (not via stale closure)
    useEffect(() => {
        const handler = (e: BeforeUnloadEvent) => {
            if (pendingSavesRef.current.length > 0) {
                e.preventDefault()
                e.returnValue = ''
            }
        }
        window.addEventListener('beforeunload', handler)
        return () => window.removeEventListener('beforeunload', handler)
    }, [])

    const hasUnsyncedChanges = pendingSavesRef.current.length > 0

    return { isOnline, isSyncing, queueSave, hasUnsyncedChanges }
}
