import * as Sentry from '@sentry/nextjs'

/**
 * Wrap an async AI gen step in a Sentry span.
 * No-op when Sentry is not initialized (DSN missing in local dev).
 */
export async function withSentrySpan<T>(name: string, fn: () => Promise<T>): Promise<T> {
    return Sentry.startSpan({ name, op: 'ai' }, async () => fn())
}
