'use client'

import React from 'react'

type ErrorBoundaryProps = {
    blockType: string
    children: React.ReactNode
}

type ErrorBoundaryState = {
    hasError: boolean
    error?: Error
}

/**
 * Block-level error boundary.
 * If a single block crashes, other blocks continue rendering.
 * In production, errors are logged to console (add Sentry later).
 */
export class BlockErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
    constructor(props: ErrorBoundaryProps) {
        super(props)
        this.state = { hasError: false }
    }

    static getDerivedStateFromError(error: Error): ErrorBoundaryState {
        return { hasError: true, error }
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
        console.error(`[BlockErrorBoundary] Block "${this.props.blockType}" crashed:`, error, errorInfo)
        // TODO: Log to Sentry in production
    }

    render() {
        if (this.state.hasError) {
            return (
                <section className="py-12 flex items-center justify-center">
                    <div className="text-center opacity-40 text-sm">
                        <p className="mb-1">⚠️ [{this.props.blockType}] — Error loading</p>
                        <p className="text-xs opacity-60">This section could not be rendered</p>
                    </div>
                </section>
            )
        }

        return this.props.children
    }
}
