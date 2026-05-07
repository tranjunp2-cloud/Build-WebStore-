'use client'

import { useEffect } from 'react'
import * as Sentry from '@sentry/nextjs'

export default function StorefrontError({
    error,
    reset,
}: {
    error: Error & { digest?: string }
    reset: () => void
}) {
    useEffect(() => {
        Sentry.captureException(error)
    }, [error])

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
            <div className="text-center px-6">
                <h2 className="text-2xl font-semibold text-gray-800 mb-2">Page unavailable</h2>
                <p className="text-gray-500 mb-6">This page encountered an error. Please try again.</p>
                <button
                    onClick={() => reset()}
                    className="px-6 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-700 transition-colors"
                >
                    Try again
                </button>
            </div>
        </div>
    )
}
