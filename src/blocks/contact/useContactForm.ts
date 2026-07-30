'use client'

import { useCallback, useState, type FormEvent } from 'react'

/**
 * Plan 260415 contact-bugfix — hook quản lý state submit + client validation
 * cho ContactForm. Mirror useNewsletterForm pattern nhưng có thêm multi-field
 * validation (name, email, phone, message) + per-field error map.
 */

export type SubmitState = 'idle' | 'loading' | 'success' | 'error'

export type ContactFormValues = {
    name: string
    email: string
    phone: string
    subject: string
    message: string
    website?: string // honeypot
}

export type ContactFormErrors = Partial<Record<keyof ContactFormValues | 'form', string>>

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Shared phone pattern (MY-friendly: digits, +, spaces, parens, hyphens).
 * Bounded quantifier {9,20} prevents ReDoS. Exported as string so the
 * HTML5 `pattern` attr + client-side regex stay in sync.
 */
export const PHONE_PATTERN_MY = '[0-9+\\s()-]{9,20}'
const PHONE_REGEX = new RegExp(`^${PHONE_PATTERN_MY}$`)

function validate(values: ContactFormValues, requiredFields: Set<string>): ContactFormErrors {
    const errors: ContactFormErrors = {}

    if (requiredFields.has('name') && !values.name.trim()) {
        errors.name = 'Name is required'
    }

    if (requiredFields.has('email')) {
        if (!values.email.trim()) {
            errors.email = 'Email is required'
        } else if (!EMAIL_REGEX.test(values.email)) {
            errors.email = 'Invalid email address'
        }
    }

    if (requiredFields.has('phone')) {
        if (!values.phone.trim()) {
            errors.phone = 'Phone is required'
        } else if (!PHONE_REGEX.test(values.phone)) {
            errors.phone = 'Invalid phone format'
        }
    } else if (values.phone && !PHONE_REGEX.test(values.phone)) {
        errors.phone = 'Invalid phone format'
    }

    if (requiredFields.has('subject') && !values.subject.trim()) {
        errors.subject = 'Subject is required'
    }

    if (requiredFields.has('message')) {
        if (!values.message.trim()) {
            errors.message = 'Message is required'
        } else if (values.message.trim().length < 5) {
            errors.message = 'Message too short'
        }
    }

    return errors
}

type UseContactFormArgs = {
    siteId?: string
    requiredFieldNames?: string[]
}

export function useContactForm({ siteId, requiredFieldNames = [] }: UseContactFormArgs) {
    const [state, setState] = useState<SubmitState>('idle')
    const [errors, setErrors] = useState<ContactFormErrors>({})
    const [submitError, setSubmitError] = useState('')

    const requiredFields = new Set(requiredFieldNames)

    const handleSubmit = useCallback(
        async (e: FormEvent<HTMLFormElement>) => {
            e.preventDefault()
            if (!siteId) {
                setSubmitError('Configuration error: missing site ID')
                setState('error')
                return
            }

            const form = e.currentTarget
            const formData = new FormData(form)
            const values: ContactFormValues = {
                name: String(formData.get('name') || ''),
                email: String(formData.get('email') || ''),
                phone: String(formData.get('phone') || ''),
                subject: String(formData.get('subject') || ''),
                message: String(formData.get('message') || ''),
                website: String(formData.get('website') || ''),
            }

            const validationErrors = validate(values, requiredFields)
            if (Object.keys(validationErrors).length > 0) {
                setErrors(validationErrors)
                setState('error')
                return
            }

            setErrors({})
            setSubmitError('')
            setState('loading')

            try {
                const res = await fetch('/api/contact-submit', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ...values, siteId }),
                })

                if (res.ok) {
                    setState('success')
                    form.reset()
                } else {
                    const data = await res.json().catch(() => ({}))
                    setSubmitError(data.error || 'Something went wrong. Please try again.')
                    setState('error')
                }
            } catch {
                setSubmitError('Network error. Please try again.')
                setState('error')
            }
        },
        [siteId, requiredFields],
    )

    const reset = useCallback(() => {
        setState('idle')
        setErrors({})
        setSubmitError('')
    }, [])

    return { state, errors, submitError, handleSubmit, reset }
}
