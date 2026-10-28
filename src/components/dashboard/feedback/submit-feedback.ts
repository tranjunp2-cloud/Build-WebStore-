import { ScreenshotUploadError, uploadScreenshots } from './upload-screenshots'
import { SubmitFeedbackError, type SubmitFeedback } from './types'

/** Where the form was opened; the server cannot see the client route. */
function pageContext() {
    const lang = localStorage.getItem('prefer_lang')
    return { pageUrl: location.pathname + location.search, locale: lang === 'ms' ? 'ms' : 'en' }
}

export const FEEDBACK_ENDPOINT = '/api/v1/feedback'

/**
 * Default transport: POST JSON with an `Idempotency-Key` header so the API can de-duplicate
 * a retried submit. 429 maps to `rate_limited`; every other failure to `failed`.
 * Screenshots are pushed to Lark first (on submit, not on pick); only their attachment tokens travel with the feedback.
 */
export const submitFeedback: SubmitFeedback = async (input, idempotencyKey) => {
    // `context` is display-only: the server resolves the store name from the session itself.
    const { screenshots, context: _context, ...rest } = input
    let screenshotTokens: string[]
    try {
        screenshotTokens = await uploadScreenshots(screenshots)
    } catch (err) {
        const status = err instanceof ScreenshotUploadError ? err.status : null
        const kind = status === 429 ? 'rate_limited' : status === 413 ? 'screenshot_too_large' : 'failed'
        throw new SubmitFeedbackError(kind, (err as Error).message)
    }
    const res = await fetch(FEEDBACK_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey },
        body: JSON.stringify({ ...rest, ...pageContext(), screenshotTokens }),
    })
    const body = await res.json().catch(() => null)
    if (res.status === 429) throw new SubmitFeedbackError('rate_limited', 'Too many requests')
    if (!res.ok) throw new SubmitFeedbackError('failed', body?.error?.message ?? `Feedback failed (${res.status})`)
    if (typeof body?.feedbackId !== 'string' || body.feedbackId === '') {
        throw new SubmitFeedbackError('failed', 'Feedback accepted but no id returned')
    }
    return { feedbackId: body.feedbackId }
}
