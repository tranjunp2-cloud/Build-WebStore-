'use client'

import { useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import * as Sentry from '@sentry/nextjs'
import { MascotStatusPage } from '@/components/mascot/mascot-status-page'

/**
 * Error boundary for every dashboard page (inside the dashboard layout, so the shell stays): the robot owns up, one
 * retry. A page whose session check or data load failed on our side (AuthUnavailableError, pool timeout) needs the
 * server data re-fetched, so the retry refreshes the router as well as resetting the boundary (TC-PERF-012).
 */
export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
    const router = useRouter()
    const [, startTransition] = useTransition()

    useEffect(() => {
        Sentry.captureException(error)
    }, [error])

    const retry = () =>
        startTransition(() => {
            router.refresh()
            reset()
        })

    const offline = typeof navigator !== 'undefined' && navigator.onLine === false
    return <MascotStatusPage kind={offline ? 'offline' : 'error'} onRetry={retry} />
}
