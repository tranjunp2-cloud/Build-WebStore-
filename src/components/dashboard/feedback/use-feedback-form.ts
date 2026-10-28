'use client'

import { useCallback, useRef, useState } from 'react'
import { useScreenshots } from './use-screenshots'
import {
    SubmitFeedbackError,
    type FeedbackArea,
    type FeedbackContext,
    type FeedbackType,
    type SubmitFailureKind,
    type SubmitFeedback,
} from './types'

export type FormStatus = 'idle' | 'submitting' | 'success'
export type FormErrors = { area?: true; details?: true }
export type InvalidField = keyof FormErrors | 'screenshots'

type Options = {
    context: FeedbackContext
    submit: SubmitFeedback
}

/**
 * Form state for the feedback dialog.
 * - Validation keeps the entered values and exposes which required field is missing.
 * - `handleSubmit` returns the first invalid field so the view can move focus there.
 * - The idempotency key is reused on retry of the same payload, so a request that landed but
 *   whose response was lost is not duplicated; editing the form rotates it.
 */
export function useFeedbackForm({ context, submit }: Options) {
    const [type, setType] = useState<FeedbackType>('problem')
    const [area, setAreaState] = useState<FeedbackArea | ''>('')
    const [details, setDetailsState] = useState('')
    const [errors, setErrors] = useState<FormErrors>({})
    const [status, setStatus] = useState<FormStatus>('idle')
    const [failure, setFailure] = useState<SubmitFailureKind | null>(null)
    const [feedbackId, setFeedbackId] = useState('')
    const screenshots = useScreenshots()

    // Ref guard: state updates are async, a double click could pass a `status` check twice.
    const inFlight = useRef(false)
    const idempotencyKey = useRef('')
    const keyedPayload = useRef('')

    const setArea = useCallback((value: FeedbackArea) => {
        setAreaState(value)
        setErrors((e) => ({ ...e, area: undefined }))
    }, [])

    const setDetails = useCallback((value: string) => {
        setDetailsState(value)
        setErrors((e) => ({ ...e, details: undefined }))
    }, [])

    const isDirty = !!(area || details.trim() || screenshots.items.length)

    /** Returns the first invalid field, or null when the feedback was accepted (or blocked in flight). */
    const handleSubmit = useCallback(async (): Promise<InvalidField | null> => {
        if (inFlight.current) return null

        if (!area || !details.trim()) {
            setErrors({ area: !area || undefined, details: !details.trim() || undefined })
            return !area ? 'area' : 'details'
        }
        if (screenshots.hasError) return 'screenshots'

        inFlight.current = true
        setStatus('submitting')
        setFailure(null)
        // Same payload → same key (a landed-but-unanswered request is not duplicated on retry).
        // Edited payload → fresh key, otherwise the server would treat the edit as the old request.
        const payloadSignature = JSON.stringify([
            type, area, details.trim(),
            screenshots.items.map(({ file }) => [file.name, file.size, file.lastModified]),
        ])
        if (!idempotencyKey.current || keyedPayload.current !== payloadSignature) {
            idempotencyKey.current = crypto.randomUUID()
            keyedPayload.current = payloadSignature
        }
        try {
            const result = await submit(
                {
                    type,
                    area,
                    details: details.trim(),
                    screenshots: screenshots.items.map((i) => i.file),
                    context,
                },
                idempotencyKey.current,
            )
            setFeedbackId(result.feedbackId)
            setStatus('success')
        } catch (err) {
            console.error('[Feedback] submit failed', err)
            setFailure(err instanceof SubmitFeedbackError ? err.kind : 'failed')
            setStatus('idle')
        } finally {
            inFlight.current = false
        }
        return null
    }, [type, area, details, screenshots.items, screenshots.hasError, context, submit])

    return {
        type, setType,
        area, setArea,
        details, setDetails,
        screenshots,
        errors, status, failure, feedbackId, isDirty,
        handleSubmit,
    }
}
