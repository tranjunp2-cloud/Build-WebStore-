import * as Sentry from '@sentry/nextjs'

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN
const env = process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT || 'development'

Sentry.init({
    dsn,
    environment: env,
    tracesSampleRate: env === 'production' ? 0.1 : env === 'staging' ? 0.5 : 1.0,
    sendDefaultPii: false,
    integrations: [
        Sentry.captureConsoleIntegration({ levels: ['error'] }),
    ],
    beforeSend(event) {
        const msg = event.exception?.values?.[0]?.value || ''
        if (/ResizeObserver loop|Non-Error promise rejection captured/.test(msg)) return null
        return event
    },
})

// Required by @sentry/nextjs v9+ to instrument App Router client navigations.
// Next.js calls this hook on each route transition; without it the SDK prints an
// "ACTION REQUIRED" warning on every boot and cannot trace client-side navigation.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
