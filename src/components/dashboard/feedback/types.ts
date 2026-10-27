export type FeedbackType = 'problem' | 'mismatch' | 'suggestion'
export const FEEDBACK_TYPES: readonly FeedbackType[] = ['problem', 'mismatch', 'suggestion']

export type FeedbackArea = 'products' | 'orders' | 'payments' | 'customers' | 'design' | 'settings' | 'other'
export const FEEDBACK_AREAS: readonly FeedbackArea[] = [
    'products', 'orders', 'payments', 'customers', 'design', 'settings', 'other',
]

export const MAX_DETAILS_LENGTH = 2000
export const MAX_SCREENSHOTS = 9
export const MAX_SCREENSHOT_BYTES = 5 * 1024 * 1024
export const ACCEPTED_SCREENSHOT_TYPES = ['image/png', 'image/jpeg'] as const

/** Context attached automatically; the user never edits it. */
export type FeedbackContext = {
    /** Display name of the current store; line is hidden when absent. */
    storeName?: string
}

export type FeedbackInput = {
    type: FeedbackType
    area: FeedbackArea
    details: string
    /** Screenshots held in the browser; the submit adapter uploads them. */
    screenshots: File[]
    context: FeedbackContext
}

export type FeedbackResult = {
    /** Support code (e.g. FB-26-004812) returned once the API has accepted the feedback. */
    feedbackId: string
}

/** `rate_limited` = server said slow down; `failed` = any other failure. Entered data is kept in both. */
export type SubmitFailureKind = 'failed' | 'rate_limited'

export class SubmitFeedbackError extends Error {
    constructor(public readonly kind: SubmitFailureKind, message: string) {
        super(message)
        this.name = 'SubmitFeedbackError'
    }
}

/**
 * Submit seam. The dialog depends on this signature only, so the transport can change
 * without touching the UI. `idempotencyKey` is stable across retries of the same feedback.
 * Implementations throw `SubmitFeedbackError` to signal the failure kind.
 */
export type SubmitFeedback = (input: FeedbackInput, idempotencyKey: string) => Promise<FeedbackResult>
