import { after, NextResponse } from 'next/server'
import { extractTenantId, tenantIdForQuery, withAuth } from '@/lib/auth'
import { feedbackTypesFor, isFeedbackWindowOpen, lookupTenantInfo } from '@/lib/feedback/feedback-availability'
import { claimFeedbackKey, feedbackGuardKey, getFeedbackBlockSeconds, recordFeedbackSubmit } from '@/lib/feedback/feedback-spam-guard'
import { notifyNewFeedback } from '@/lib/feedback/feedback-card-notify'
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

/**
 * POST /api/v1/feedback
 * Headers: Idempotency-Key (UUID v4). Body: FeedbackInput (without screenshots).
 * Writes one record to the Lark Base report table and returns `{ feedbackId }`.
 * Only responds 2xx after Lark accepted the record (the UI shows the ID as confirmation).
 */
export const POST = withAuth(async (user, request) => {
    if (!isFeedbackWindowOpen()) return errorResponse(403, 'FEEDBACK_CLOSED', 'Feedback is not open right now')

    const guardKey = feedbackGuardKey(user.id)
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
    const { storeName, isMigratedStore } = await lookupTenantInfo(tenantIdForQuery(user))
    if (!feedbackTypesFor(isMigratedStore).includes(parsed.data.type)) {
        return errorResponse(400, 'INVALID_BODY', 'Feedback type not available for this store')
    }

    try {
        const { feedbackId, recordId, fields } = await submitFeedbackToLarkBase(
            parsed.data,
            key.data,
            // Tenant and reporter come from the session, never from the client body.
            { tenantId, storeName, ...extractReporter(user) },
            { appToken, tableId },
        )
        // Lark cannot tell us a retry from a new submit, so we remember the key: a retry does not count.
        if (await claimFeedbackKey(key.data)) {
            await recordFeedbackSubmit(guardKey)
            // Group card: best effort, after the response, and only for the first claim of a key (a retry must
            // not post twice). notifyNewFeedback never throws, so Lark can neither delay nor fail the submission.
            after(() => notifyNewFeedback({ recordId, appToken, tableId, fields }))
        }
        return NextResponse.json({ feedbackId })
    } catch (err) {
        const larkCode = err instanceof LarkApiError ? err.code : null
        const httpStatus = err instanceof LarkApiError ? err.httpStatus : null
        console.error('[feedback] Lark submit failed', { larkCode, httpStatus })
        return errorResponse(502, 'UPSTREAM_ERROR', 'Could not submit the feedback. Please try again.')
    }
})
