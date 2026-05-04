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
    integrations: [
        // Auto-capture console.error() as Sentry events — catches all caught errors
        // that are logged but not re-thrown (106+ catch blocks in codebase)
        Sentry.captureConsoleIntegration({ levels: ['error'] }),
    ],
    beforeSend(event) {
        // Drop Next.js internal abort — happens when user navigates away mid-stream, not a real error
        const errType = event.exception?.values?.[0]?.type
        if (errType === 'ResponseAborted') return null

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
