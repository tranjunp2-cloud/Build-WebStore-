import * as Sentry from '@sentry/nextjs'

const env = process.env.SENTRY_ENVIRONMENT || process.env.APP_ENV || 'development'

Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: env,
    tracesSampleRate: env === 'production' ? 0.1 : env === 'staging' ? 0.5 : 1.0,
    sendDefaultPii: false,
})
