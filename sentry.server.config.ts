import * as Sentry from '@sentry/nextjs'

const dsn = process.env.SENTRY_DSN
const env = process.env.SENTRY_ENVIRONMENT || process.env.APP_ENV || 'development'

const sampleByEnv = (e: string) =>
    e === 'production' ? 0.1 : e === 'staging' ? 0.5 : 1.0

Sentry.init({
    dsn,
    environment: env,
    tracesSampleRate: sampleByEnv(env),
    sendDefaultPii: false,
    maxBreadcrumbs: 50,
    beforeSend(event) {
        // Drop 4xx response errors to save quota
        const status = (event.contexts?.response as { status_code?: number } | undefined)?.status_code
        if (status && status >= 400 && status < 500) return null

        // Strip body for media upload routes
        const url = event.request?.url || ''
        if (/\/api\/media\//.test(url) && event.request) {
            delete event.request.data
        }

        // Strip auth cookie
        if (event.request?.cookies && typeof event.request.cookies === 'object') {
            delete (event.request.cookies as Record<string, unknown>)['payload-token']
        }
        return event
    },
})
