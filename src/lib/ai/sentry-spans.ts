import * as Sentry from '@sentry/nextjs'

/**
 * Wrap an async AI gen step in a Sentry span.
 * No-op when Sentry is not initialized (DSN missing in local dev).
 */
export async function withSentrySpan<T>(name: string, fn: () => Promise<T>): Promise<T> {
    return Sentry.startSpan({ name, op: 'ai' }, async () => fn())
}

export interface SiteGenerationPerformance {
    requestId: string
    totalMs: number
    pipelineMs: number
    aiMs: number
    mediaMs: number
    dbMs: number
    productDataMs: number
    productImageGraceMs: number
    blogGraceMs: number
    slugSyncMs: number
    pages: number
    failures: number
    locale: string
    mode: string
}

/**
 * Send a PII-safe completion event for QA benchmarking. This is intentionally
 * an event, rather than only a trace attribute, because traces are sampled.
 */
export function captureSiteGenerationPerformance(metrics: SiteGenerationPerformance): void {
    Sentry.withScope((scope) => {
        scope.setLevel('info')
        scope.setTag('generation.locale', metrics.locale)
        scope.setTag('generation.mode', metrics.mode)
        scope.setTag('generation.outcome', 'completed')
        scope.setContext('site_generation_performance', { ...metrics })
        Sentry.captureMessage('site_generation_completed', 'info')
    })
}
