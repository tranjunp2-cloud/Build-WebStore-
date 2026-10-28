import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { extractTenantId, tenantIdForQuery, withAuth } from '@/lib/auth'
import { feedbackGuardKey, getFeedbackBlockSeconds, recordFeedbackSubmit } from '@/lib/feedback/feedback-spam-guard'
import { LarkApiError } from '@/lib/lark/lark-base-client'
import {
    extractReporter,
    feedbackSchema,
    submitFeedbackToLarkBase,
    uuidV4Schema,
} from '@/lib/feedback/feedback-report'

export const dynamic = 'force-dynamic'

const errorResponse = (status: number, code: string, message: string, headers?: HeadersInit) =>
    NextResponse.json({ error: { code, message } }, { status, headers })

/** Store name from the DB (never the client). Fail-open: a lookup error only leaves the Store column empty. */
async function lookupStoreName(tenantId: string | number | null): Promise<string | null> {
    if (!tenantId) return null
    try {
        const payload = await getPayload({ config })
        const tenant = await payload.findByID({ collection: 'tenants', id: tenantId, depth: 0, select: { name: true } })
        return (tenant as { name?: string }).name?.trim() || null
    } catch (err) {
        console.error('[feedback] store name lookup failed', err instanceof Error ? err.message : err)
        return null
    }
}

/**
 * POST /api/feedback
 * Headers: Idempotency-Key (UUID v4). Body: FeedbackInput (without screenshots).
 * Writes one record to the Lark Base report table and returns `{ feedbackId }`.
 * Only responds 2xx after Lark accepted the record (the UI shows the ID as confirmation).
 */
export const POST = withAuth(async (user, request) => {
    const guardKey = feedbackGuardKey(extractTenantId(user), user.id)
    const blockedFor = await getFeedbackBlockSeconds(guardKey)
    if (blockedFor) {
        return errorResponse(429, 'RATE_LIMITED', 'Too many submissions. Please try again later.', {
            'Retry-After': String(blockedFor),
        })
    }

    const key = uuidV4Schema.safeParse(request.headers.get('idempotency-key'))
    if (!key.success) return errorResponse(400, 'INVALID_IDEMPOTENCY_KEY', 'Idempotency-Key must be a UUID v4')

    const json = await request.json().catch(() => null)
    const parsed = feedbackSchema.safeParse(json)
    if (!parsed.success) return errorResponse(400, 'INVALID_BODY', 'Invalid feedback data')

    const appToken = process.env.LARK_BASE_APP_TOKEN
    const tableId = process.env.LARK_BASE_REPORT_TABLE_ID
    if (!appToken || !tableId) {
        console.error('[feedback] LARK_BASE_APP_TOKEN / LARK_BASE_REPORT_TABLE_ID not configured')
        return errorResponse(503, 'REPORTING_UNAVAILABLE', 'Feedback is temporarily unavailable')
    }

    const tenantId = extractTenantId(user)
    const storeName = await lookupStoreName(tenantIdForQuery(user))

    try {
        const { feedbackId } = await submitFeedbackToLarkBase(
            parsed.data,
            key.data,
            // Tenant and reporter come from the session, never from the client body.
            { tenantId, storeName, ...extractReporter(user) },
            { appToken, tableId },
        )
        await recordFeedbackSubmit(guardKey)
        return NextResponse.json({ feedbackId })
    } catch (err) {
        const larkCode = err instanceof LarkApiError ? err.code : null
        const httpStatus = err instanceof LarkApiError ? err.httpStatus : null
        console.error('[feedback] Lark submit failed', { larkCode, httpStatus })
        return errorResponse(502, 'UPSTREAM_ERROR', 'Could not submit the feedback. Please try again.')
    }
})
