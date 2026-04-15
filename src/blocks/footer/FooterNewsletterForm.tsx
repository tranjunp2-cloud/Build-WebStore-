'use client'

import { useCallback, useEffect, useId, useRef, useState, type FormEvent } from 'react'

/**
 * Plan 260415 footer-bugfix — wire newsletter input inert thành real submit.
 * Dùng existing `/api/subscribe` endpoint (không cần collection change).
 *
 * Match pattern từ newsletter block `useNewsletterForm` nhưng self-contained
 * trong footer block. Future: có thể refactor thành shared hook sau.
 */

type SubmitState = 'idle' | 'loading' | 'success' | 'error'

export type FooterNewsletterFormProps = {
    siteId?: string
    variant: 'mega-footer' | 'expanded'
    placeholder?: string
    buttonLabel?: string
}

export function FooterNewsletterForm({
    siteId,
    variant,
    placeholder = 'Enter your email',
    buttonLabel = 'Subscribe',
}: FooterNewsletterFormProps) {
    const [state, setState] = useState<SubmitState>('idle')
    const [error, setError] = useState('')
    const inputRef = useRef<HTMLInputElement>(null)
    const abortRef = useRef<AbortController | null>(null)
    const formId = useId()
    const inputId = `footer-newsletter-${formId}`
    const errorId = `footer-newsletter-error-${formId}`

    useEffect(() => {
        return () => {
            abortRef.current?.abort()
        }
    }, [])

    const handleSubmit = useCallback(
        async (e: FormEvent) => {
            e.preventDefault()
            const email = inputRef.current?.value?.trim()
            if (!email) return

            // Native HTML5 email validation
            if (!inputRef.current?.validity.valid) {
                setError('Please enter a valid email address')
                setState('error')
                return
            }

            setState('loading')
            setError('')

            abortRef.current?.abort()
            abortRef.current = new AbortController()

            try {
                const res = await fetch('/api/subscribe', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, siteId: siteId || '', source: 'footer' }),
                    signal: abortRef.current.signal,
                })

                if (res.status === 429) {
                    const retryAfter = res.headers.get('Retry-After')
                    const minutes = retryAfter ? Math.ceil(parseInt(retryAfter, 10) / 60) : 5
                    setError(`Too many attempts. Try again in ${minutes} minute${minutes !== 1 ? 's' : ''}.`)
                    setState('error')
                    return
                }

                if (res.ok) {
                    setState('success')
                    if (inputRef.current) inputRef.current.value = ''
                } else {
                    const data = await res.json().catch(() => ({}))
                    setError(data.error || 'Something went wrong. Please try again.')
                    setState('error')
                }
            } catch (err) {
                if (err instanceof Error && err.name === 'AbortError') return
                setError('Network error. Please try again.')
                setState('error')
            }
        },
        [siteId],
    )

    const isMega = variant === 'mega-footer'

    if (state === 'success') {
        return (
            <div
                role="status"
                aria-live="polite"
                className="flex items-center justify-center gap-2 py-3 text-sm font-medium"
                style={{ color: isMega ? '#ffffff' : 'var(--brand-primary)' }}
            >
                <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                    <path d="M16.667 5L7.5 14.167 3.333 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Thanks for subscribing!
            </div>
        )
    }

    return (
        <form onSubmit={handleSubmit} noValidate className="w-full">
            <div className="flex gap-2 max-w-md mx-auto">
                <label htmlFor={inputId} className="sr-only">
                    Email address
                </label>
                <input
                    ref={inputRef}
                    id={inputId}
                    name="email"
                    type="email"
                    autoComplete="email"
                    placeholder={placeholder}
                    aria-label="Email address"
                    aria-describedby={error ? errorId : undefined}
                    aria-invalid={!!error}
                    disabled={state === 'loading'}
                    required
                    className={`flex-1 px-4 py-2.5 rounded-lg text-base outline-none transition-colors disabled:opacity-60 ${
                        isMega
                            ? 'bg-white/20 text-white placeholder-white/60 border border-white/20 focus-visible:border-white/50'
                            : 'text-current border focus-visible:ring-2 focus-visible:ring-[rgba(var(--brand-primary-rgb),0.25)]'
                    }`}
                    style={
                        !isMega
                            ? {
                                  background: 'rgba(var(--brand-primary-rgb), 0.04)',
                                  borderColor: error ? '#ef4444' : 'rgba(var(--brand-primary-rgb), 0.15)',
                              }
                            : undefined
                    }
                />
                <button
                    type="submit"
                    disabled={state === 'loading'}
                    className="px-5 py-2.5 rounded-lg text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-60 flex-shrink-0 flex items-center justify-center gap-2"
                    style={
                        isMega
                            ? { background: '#ffffff', color: 'var(--brand-primary)' }
                            : { background: 'var(--brand-primary)', color: '#ffffff' }
                    }
                >
                    {state === 'loading' && (
                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                    )}
                    {buttonLabel}
                </button>
            </div>
            {error && (
                <p
                    id={errorId}
                    role="alert"
                    className="text-xs mt-2 text-center"
                    style={{ color: isMega ? 'rgba(255,255,255,0.9)' : '#ef4444' }}
                >
                    {error}
                </p>
            )}
        </form>
    )
}
