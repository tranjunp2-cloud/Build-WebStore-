import { ScreenshotUploadError, uploadScreenshots } from './upload-screenshots'
import { SubmitFeedbackError, type SubmitFeedback } from './types'

export const FEEDBACK_ENDPOINT = '/api/feedback'

/**
 * Default transport: POST JSON with an `Idempotency-Key` header so the API can de-duplicate
 * a retried submit. 429 maps to `rate_limited`; every other failure to `failed`.
 * Screenshots are pushed to Lark first (on submit, not on pick); only their attachment tokens travel with the feedback.
 */
export const submitFeedback: SubmitFeedback = async (input, idempotencyKey) => {
    const { screenshots, ...rest } = input
    let screenshotTokens: string[]
    try {
        screenshotTokens = await uploadScreenshots(screenshots)
    } catch (err) {
        const limited = err instanceof ScreenshotUploadError && err.status === 429
        throw new SubmitFeedbackError(limited ? 'rate_limited' : 'failed', (err as Error).message)
    }
    const res = await fetch(FEEDBACK_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey },
        body: JSON.stringify({ ...rest, screenshotTokens }),
    })
    const body = await res.json().catch(() => null)
    if (res.status === 429) throw new SubmitFeedbackError('rate_limited', 'Too many requests')
    if (!res.ok) throw new SubmitFeedbackError('failed', body?.error?.message ?? `Feedback failed (${res.status})`)
    if (typeof body?.feedbackId !== 'string' || body.feedbackId === '') {
        throw new SubmitFeedbackError('failed', 'Feedback accepted but no id returned')
    }
    return { feedbackId: body.feedbackId }
}
