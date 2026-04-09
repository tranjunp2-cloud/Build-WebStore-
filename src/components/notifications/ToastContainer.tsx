'use client'

import { useEffect, useState, useCallback } from 'react'
import { LiveToast } from './LiveToast'

interface ToastData {
    id: string
    title: string
    type?: string
    message?: string
}

const MAX_VISIBLE = 3

/**
 * Renders up to MAX_VISIBLE live toast notifications.
 * Listens for 'notification-toast' CustomEvents dispatched by NotificationProvider.
 *
 * Positioned fixed bottom-right, above sidebar/navigation (z-200).
 */
export function ToastContainer() {
    const [toasts, setToasts] = useState<ToastData[]>([])

    useEffect(() => {
        const handler = (event: Event) => {
            const { detail } = event as CustomEvent<ToastData>
            setToasts((prev) => {
                const next = [detail, ...prev]
                return next.slice(0, MAX_VISIBLE)
            })
        }
        window.addEventListener('notification-toast', handler)
        return () => window.removeEventListener('notification-toast', handler)
    }, [])

    const handleDismiss = useCallback((id: string) => {
        setToasts((prev) => prev.filter((t) => t.id !== id))
    }, [])

    if (toasts.length === 0) return null

    return (
        <div className="fixed bottom-6 right-6 z-[200] flex flex-col-reverse gap-3 pointer-events-none">
            {toasts.map((toast) => (
                <div key={toast.id} className="pointer-events-auto">
                    <LiveToast {...toast} onDismiss={handleDismiss} />
                </div>
            ))}
        </div>
    )
}
