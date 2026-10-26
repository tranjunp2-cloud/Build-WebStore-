'use client'

import { useEffect } from 'react'
import * as Sentry from '@sentry/nextjs'
import { MascotStatusPage } from '@/components/mascot/mascot-status-page'

/** A dashboard page crashed: keep the shell, let the robot own up, one retry. */
export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
    useEffect(() => {
        Sentry.captureException(error)
    }, [error])
    const offline = typeof navigator !== 'undefined' && navigator.onLine === false
    return <MascotStatusPage kind={offline ? 'offline' : 'error'} onRetry={reset} />
}
