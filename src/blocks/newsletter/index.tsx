'use client'

import { FormEvent, useCallback, useId, useRef, useState } from 'react'
import { AnimatedSection } from '../shared/animations'
import type { BlockProps } from '../types'
import type { NewsletterConfig } from './config'
import { CSS_VARS } from '@/lib/theme/resolve'

type SubmitState = 'idle' | 'loading' | 'success' | 'error'

function useNewsletterForm(siteId?: string) {
    const [state, setState] = useState<SubmitState>('idle')
    const [error, setError] = useState('')
    const inputRef = useRef<HTMLInputElement>(null)

    const handleSubmit = useCallback(async (e: FormEvent) => {
        e.preventDefault()
        const email = inputRef.current?.value?.trim()
        if (!email) return

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!emailRegex.test(email)) {
            setError('Please enter a valid email address')
            setState('error')
            return
        }

        setState('loading')
        setError('')

        try {
            const res = await fetch('/api/subscribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, siteId: siteId || '' }),
            })
            if (res.ok) {
                setState('success')
                if (inputRef.current) inputRef.current.value = ''
            } else {
                const data = await res.json().catch(() => ({}))
                setError(data.error || 'Something went wrong. Please try again.')
                setState('error')
            }
        } catch {
            setError('Network error. Please try again.')
            setState('error')
        }
    }, [siteId])

    return { state, error, inputRef, handleSubmit }
}

function EmailForm({
    placeholder,
    buttonLabel,
    siteId,
    layout = 'row',
}: {
    placeholder: string
    buttonLabel: string
    siteId?: string
    layout?: 'row' | 'stack'
}) {
    const { state, error, inputRef, handleSubmit } = useNewsletterForm(siteId)
    const formId = useId()
    const inputId = `newsletter-email-${formId}`
    const errorId = `newsletter-error-${formId}`

    if (state === 'success') {
        return (
            <div className="flex items-center justify-center gap-2 py-3 px-4" style={{ color: CSS_VARS.primary }}>
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                    <path d="M16.667 5L7.5 14.167 3.333 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span className="font-medium">Thanks for subscribing!</span>
            </div>
        )
    }

    return (
        <form onSubmit={handleSubmit} className={`flex ${layout === 'stack' ? 'flex-col' : 'flex-col sm:flex-row'} gap-3`}>
            <div className="flex-1">
                <label htmlFor={inputId} className="sr-only">Email address</label>
                <input
                    ref={inputRef}
                    id={inputId}
                    type="email"
                    autoComplete="email"
                    placeholder={placeholder}
                    required
                    disabled={state === 'loading'}
                    className="w-full px-4 py-3 bg-transparent border focus:outline-none focus:ring-2 transition-colors"
                    style={{
                        borderColor: error ? '#ef4444' : 'rgba(var(--brand-primary-rgb), 0.3)',
                        borderRadius: CSS_VARS.radiusMd,
                        color: CSS_VARS.text,
                        outlineColor: CSS_VARS.primary,
                    }}
                    aria-describedby={error ? errorId : undefined}
                />
                {error && (
                    <p id={errorId} className="text-sm mt-1" style={{ color: '#ef4444' }} role="alert">
                        {error}
                    </p>
                )}
            </div>
            <button
                type="submit"
                disabled={state === 'loading'}
                className="px-6 py-3 font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50 flex-shrink-0 flex items-center justify-center gap-2"
                style={{
                    background: CSS_VARS.primary,
                    borderRadius: CSS_VARS.radiusMd,
                }}
            >
                {state === 'loading' && (
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                )}
                {buttonLabel}
            </button>
        </form>
    )
}

function InlineVariant({ block, siteId }: { block: NewsletterConfig; siteId?: string }) {
    const { headline, subheadline, buttonLabel = 'Subscribe', placeholder = 'your@email.com' } = block
    return (
        <AnimatedSection className="py-12 md:py-16" style={{ color: CSS_VARS.text, background: CSS_VARS.surface }}>
            <div className="container mx-auto px-6">
                <div className="flex flex-col lg:flex-row items-center gap-6 lg:gap-12 max-w-4xl mx-auto">
                    <div className="flex-1 text-center lg:text-left">
                        <h2 className="text-2xl md:text-3xl font-bold mb-2" style={{ fontFamily: CSS_VARS.fontHeading }}>
                            {headline || 'Stay Updated'}
                        </h2>
                        {subheadline && <p style={{ color: CSS_VARS.muted }}>{subheadline}</p>}
                    </div>
                    <div className="flex-1 w-full max-w-md">
                        <EmailForm placeholder={placeholder} buttonLabel={buttonLabel} siteId={siteId} layout="row" />
                    </div>
                </div>
            </div>
        </AnimatedSection>
    )
}

function PopupVariant({ block, siteId }: { block: NewsletterConfig; siteId?: string }) {
    const { headline, subheadline, buttonLabel = 'Subscribe', placeholder = 'your@email.com' } = block
    return (
        <AnimatedSection className="py-16 md:py-20" style={{ color: CSS_VARS.text, background: CSS_VARS.background }}>
            <div className="container mx-auto px-6">
                <div
                    className="max-w-md mx-auto text-center p-8 md:p-10"
                    style={{
                        background: CSS_VARS.surface,
                        borderRadius: CSS_VARS.radiusLg,
                        boxShadow: CSS_VARS.shadowMd,
                        border: '1px solid rgba(var(--brand-primary-rgb), 0.1)',
                    }}
                >
                    <h2 className="text-2xl md:text-3xl font-bold mb-3" style={{ fontFamily: CSS_VARS.fontHeading }}>
                        {headline || 'Stay Updated'}
                    </h2>
                    {subheadline && <p className="mb-6" style={{ color: CSS_VARS.muted }}>{subheadline}</p>}
                    <EmailForm placeholder={placeholder} buttonLabel={buttonLabel} siteId={siteId} layout="stack" />
                </div>
            </div>
        </AnimatedSection>
    )
}

function BannerVariant({ block, siteId }: { block: NewsletterConfig; siteId?: string }) {
    const { headline, subheadline, buttonLabel = 'Subscribe', placeholder = 'your@email.com' } = block
    return (
        <AnimatedSection
            className="py-16 md:py-20"
            style={{
                background: 'linear-gradient(135deg, var(--brand-primary), var(--brand-secondary))',
                color: '#ffffff',
            }}
        >
            <div className="container mx-auto px-6">
                <div className="flex flex-col lg:flex-row items-center gap-6 lg:gap-12 max-w-4xl mx-auto">
                    <div className="flex-1 text-center lg:text-left">
                        <h2 className="text-2xl md:text-3xl font-bold mb-2" style={{ fontFamily: CSS_VARS.fontHeading }}>
                            {headline || 'Stay Updated'}
                        </h2>
                        {subheadline && <p className="opacity-85">{subheadline}</p>}
                    </div>
                    <div className="flex-1 w-full max-w-md">
                        <EmailForm placeholder={placeholder} buttonLabel={buttonLabel} siteId={siteId} layout="row" />
                    </div>
                </div>
            </div>
        </AnimatedSection>
    )
}

export function NewsletterBlock({ block, site }: BlockProps<NewsletterConfig>) {
    const { variant = 'inline' } = block
    const siteId = (site as Record<string, unknown>)?.id as string | undefined

    switch (variant) {
        case 'popup':
            return <PopupVariant block={block} siteId={siteId} />
        case 'banner':
            return <BannerVariant block={block} siteId={siteId} />
        case 'inline':
        default:
            return <InlineVariant block={block} siteId={siteId} />
    }
}
