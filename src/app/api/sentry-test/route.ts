/**
 * TEMPORARY — remove before merging to main.
 * Phase 04 verification: confirms Sentry captures server errors on staging.
 * Usage: GET /api/sentry-test → 500, event appears in Sentry dashboard within 60s.
 */

import * as Sentry from '@sentry/nextjs'
import { NextResponse } from 'next/server'

export async function GET() {
    if (process.env.SENTRY_ENVIRONMENT !== 'staging') {
        return NextResponse.json({ error: 'disabled' }, { status: 404 })
    }
    Sentry.captureMessage('sentry-test endpoint hit', 'info')
    throw new Error('Sentry verification — intentional throw from /api/sentry-test')
}
