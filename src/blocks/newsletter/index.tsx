'use client'

import { FormEvent, useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { AnimatedSection } from '../shared/animations'
import type { BlockProps } from '../types'
import type { NewsletterConfig } from './config'
import { CSS_VARS } from '@/lib/theme/resolve'
import { Heading, Body } from '../shared/Typography'
import { TOUCH_TARGET, CARD_PADDING } from '@/lib/design-tokens'
import { SectionWrapper } from '../shared/SectionWrapper'
import { GridLines, DuotoneOverlay, NoiseTexture, LayeredShapes } from '../shared/decorative'
import { isInEditorPreview } from '@/lib/storefront/editor-intercept'

// ── Local helpers (Plan 260415 newsletter-compliance) ──────────────────────
// Brand identity vars preserved per Option C additive strategy.

const POPUP_STORAGE_KEY = 'newsletter-popup-dismissed'
const POPUP_DISMISS_DURATION_MS = 7 * 24 * 60 * 60 * 1000 // 7 days
const POPUP_AUTO_OPEN_DELAY_MS = 30_000 // 30 seconds

type NewsletterSectionProps = {
    children: ReactNode
    padding?: 'compact' | 'default'
    style?: React.CSSProperties
    decorative?: ReactNode
}

/** Outer wrapper cho inline + banner variants. AnimatedSection + token container. */
function NewsletterSection({ children, padding = 'default', style, decorative }: NewsletterSectionProps) {
    return (
        <AnimatedSection style={style} className={decorative ? 'relative overflow-hidden' : ''}>
            {decorative}
            <SectionWrapper
                as="div"
                padding={padding}
                container="default"
                background="transparent"
                innerClassName={decorative ? 'relative z-10' : ''}
            >
                {children}
            </SectionWrapper>
        </AnimatedSection>
    )
}

type SubmitState = 'idle' | 'loading' | 'success' | 'error'

function useNewsletterForm(siteId?: string) {
    const [state, setState] = useState<SubmitState>('idle')
    const [error, setError] = useState('')
    const inputRef = useRef<HTMLInputElement>(null)
    const abortRef = useRef<AbortController | null>(null)

    // Plan 260415 Lỗi L — cleanup AbortController on unmount để tránh
    // setState warning khi component unmount giữa fetch.
    useEffect(() => {
        return () => {
            abortRef.current?.abort()
        }
    }, [])

    const handleSubmit = useCallback(
        async (e: FormEvent) => {
            e.preventDefault()
            const form = e.currentTarget as HTMLFormElement
            const emailInput = inputRef.current
            const email = emailInput?.value?.trim()
            if (!email) return

            // Plan 260415 Lỗi D — dùng native HTML5 validity check thay vì
            // custom regex. Browser handle edge cases (IDN, quoted local) tốt hơn.
            if (!emailInput?.validity.valid) {
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
                    body: JSON.stringify({ email, siteId: siteId || '' }),
                    signal: abortRef.current.signal,
                })

                // Plan 260415 Lỗi J — handle 429 rate limit với Retry-After header
                if (res.status === 429) {
                    const retryAfter = res.headers.get('Retry-After')
                    const minutes = retryAfter ? Math.ceil(parseInt(retryAfter, 10) / 60) : 5
                    setError(`Too many attempts. Please try again in ${minutes} minute${minutes !== 1 ? 's' : ''}.`)
                    setState('error')
                    return
                }

                if (res.ok) {
                    setState('success')
                    if (inputRef.current) inputRef.current.value = ''
                    form.reset()
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

    return { state, error, inputRef, handleSubmit }
}

type EmailFormProps = {
    placeholder: string
    buttonLabel: string
    siteId?: string
    layout?: 'row' | 'stack'
    onSuccess?: () => void
    variantColor?: 'brand' | 'inverse'
}

function EmailForm({ placeholder, buttonLabel, siteId, layout = 'row', onSuccess, variantColor = 'brand' }: EmailFormProps) {
    const { state, error, inputRef, handleSubmit } = useNewsletterForm(siteId)
    const formId = useId()
    const inputId = `newsletter-email-${formId}`
    const errorId = `newsletter-error-${formId}`

    useEffect(() => {
        if (state === 'success' && onSuccess) {
            const timer = setTimeout(onSuccess, 2500)
            return () => clearTimeout(timer)
        }
        return undefined
    }, [state, onSuccess])

    if (state === 'success') {
        return (
            <div
                className="flex items-center justify-center gap-2 py-3 px-4"
                role="status"
                aria-live="polite"
                style={{ color: variantColor === 'inverse' ? '#ffffff' : CSS_VARS.primary }}
            >
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                    <path d="M16.667 5L7.5 14.167 3.333 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span className="font-medium">Thanks for subscribing!</span>
            </div>
        )
    }

    return (
        <form onSubmit={handleSubmit} className={`flex ${layout === 'stack' ? 'flex-col' : 'flex-col sm:flex-row'} gap-3`} noValidate>
            <div className="flex-1">
                <label htmlFor={inputId} className="sr-only">Email address</label>
                <input
                    ref={inputRef}
                    id={inputId}
                    name="email"
                    type="email"
                    autoComplete="email"
                    placeholder={placeholder}
                    required
                    disabled={state === 'loading'}
                    className={`w-full px-4 py-3 rounded-md outline-none focus-visible:ring-2 transition-colors disabled:opacity-60 ${variantColor === 'inverse' ? 'border-2 bg-white/15 placeholder:text-white focus-visible:ring-white/50' : 'border focus-visible:ring-[rgba(var(--brand-primary-rgb),0.35)]'}`}
                    style={{
                        borderColor: error ? '#ef4444' : variantColor === 'inverse' ? 'rgba(255,255,255,0.9)' : 'rgba(var(--brand-primary-rgb), 0.3)',
                        color: variantColor === 'inverse' ? '#ffffff' : CSS_VARS.text,
                    }}
                    aria-describedby={error ? errorId : undefined}
                    aria-invalid={!!error}
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
                className={`px-6 py-3 rounded-md ${TOUCH_TARGET.min} font-semibold transition-all hover:opacity-90 disabled:opacity-50 flex-shrink-0 flex items-center justify-center gap-2`}
                style={{
                    background: variantColor === 'inverse' ? '#ffffff' : CSS_VARS.primary,
                    color: variantColor === 'inverse' ? CSS_VARS.primary : '#ffffff',
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

// ── Inline variant ──────────────────────────────────────────────────────────

function InlineVariant({ block, siteId }: { block: NewsletterConfig; siteId?: string }) {
    const { headline, subheadline, buttonLabel = 'Subscribe', placeholder = 'your@email.com' } = block
    return (
        <NewsletterSection
            padding="compact"
            style={{ color: CSS_VARS.text, background: CSS_VARS.surface }}
            decorative={<GridLines color={CSS_VARS.primary} spacing={48} opacity={0.05} />}
        >
            <div className="flex flex-col lg:flex-row items-center gap-6 lg:gap-12 max-w-4xl mx-auto">
                <div className="flex-1 text-center lg:text-left">
                    <Heading level={2} className="mb-2" style={{ fontFamily: CSS_VARS.fontHeading }}>
                        {headline || 'Stay Updated'}
                    </Heading>
                    {subheadline && <Body style={{ color: CSS_VARS.muted }}>{subheadline}</Body>}
                </div>
                <div className="flex-1 w-full max-w-md">
                    <EmailForm placeholder={placeholder} buttonLabel={buttonLabel} siteId={siteId} layout="row" />
                </div>
            </div>
        </NewsletterSection>
    )
}

// ── Popup variant — REAL <dialog> modal ─────────────────────────────────────
// Plan 260415 Lỗi A — refactor popup thành real <dialog> element với:
// - showModal() → focus trap native, backdrop native
// - Timer auto-open 30s (Decision 2) + localStorage dismiss 7 days
// - Escape close (native), backdrop click close (custom handler)
// - Body scroll lock khi open
// - Respect prefers-reduced-motion: skip auto-open

function PopupVariant({ block, siteId }: { block: NewsletterConfig; siteId?: string }) {
    const { headline, subheadline, buttonLabel = 'Subscribe', placeholder = 'your@email.com' } = block
    const dialogRef = useRef<HTMLDialogElement>(null)
    const [isOpen, setIsOpen] = useState(false)

    const openDialog = useCallback(() => {
        if (dialogRef.current && !dialogRef.current.open) {
            dialogRef.current.showModal()
            setIsOpen(true)
            // Body scroll lock
            document.body.style.overflow = 'hidden'
        }
    }, [])

    const closeDialog = useCallback((persist = true) => {
        if (dialogRef.current?.open) {
            dialogRef.current.close()
            setIsOpen(false)
            document.body.style.overflow = ''
            if (persist) {
                try {
                    localStorage.setItem(POPUP_STORAGE_KEY, String(Date.now()))
                } catch {
                    // Ignore storage errors (private mode, quota)
                }
            }
        }
    }, [])

    // Auto-open timer sau 30s nếu chưa dismiss trong 7 ngày
    useEffect(() => {
        if (typeof window === 'undefined') return

        // Skip auto-open in non-production contexts: test-harness screenshots,
        // AI builder (generation preview), and editor iframe (/preview/{siteId}).
        const { pathname } = window.location
        if (pathname.startsWith('/test-harness/')) return
        if (pathname.startsWith('/builder/')) return
        if (isInEditorPreview()) return

        const prefersReducedMotion =
            typeof window.matchMedia === 'function' &&
            window.matchMedia('(prefers-reduced-motion: reduce)').matches

        if (prefersReducedMotion) return

        // Check localStorage dismiss
        try {
            const dismissedAt = localStorage.getItem(POPUP_STORAGE_KEY)
            if (dismissedAt) {
                const elapsed = Date.now() - parseInt(dismissedAt, 10)
                if (elapsed < POPUP_DISMISS_DURATION_MS) return
            }
        } catch {
            // Ignore — treat as not dismissed
        }

        const timer = setTimeout(openDialog, POPUP_AUTO_OPEN_DELAY_MS)
        return () => clearTimeout(timer)
    }, [openDialog])

    // Native Escape key → dialog.close fires 'close' event
    useEffect(() => {
        const dialog = dialogRef.current
        if (!dialog) return

        const handleClose = () => {
            setIsOpen(false)
            document.body.style.overflow = ''
            try {
                localStorage.setItem(POPUP_STORAGE_KEY, String(Date.now()))
            } catch {
                // Ignore
            }
        }

        dialog.addEventListener('close', handleClose)
        return () => dialog.removeEventListener('close', handleClose)
    }, [])

    // Backdrop click close
    const handleBackdropClick = useCallback(
        (e: React.MouseEvent<HTMLDialogElement>) => {
            if (e.target === dialogRef.current) {
                closeDialog(true)
            }
        },
        [closeDialog],
    )

    const handleSuccess = useCallback(() => {
        closeDialog(true)
    }, [closeDialog])

    return (
        <dialog
            ref={dialogRef}
            onClick={handleBackdropClick}
            className="p-0 rounded-2xl backdrop:bg-black/60 backdrop:backdrop-blur-sm open:animate-in open:fade-in-0 open:zoom-in-95 max-w-md w-[calc(100%-2rem)]"
            style={{
                background: CSS_VARS.surface,
                color: CSS_VARS.text,
                border: '1px solid rgba(var(--brand-primary-rgb), 0.15)',
            }}
            aria-labelledby={`newsletter-popup-heading-${useId()}`}
        >
            {isOpen && (
                <div className="p-8 md:p-10 text-center relative">
                    <button
                        type="button"
                        onClick={() => closeDialog(true)}
                        className={`absolute top-3 right-3 p-2 rounded-full opacity-60 hover:opacity-100 transition-opacity ${TOUCH_TARGET.min} flex items-center justify-center`}
                        aria-label="Close newsletter popup"
                    >
                        <X size={18} />
                    </button>
                    <Heading level={2} className="mb-3" style={{ fontFamily: CSS_VARS.fontHeading }}>
                        {headline || 'Stay Updated'}
                    </Heading>
                    {subheadline && <Body className="mb-6" style={{ color: CSS_VARS.muted }}>{subheadline}</Body>}
                    <EmailForm
                        placeholder={placeholder}
                        buttonLabel={buttonLabel}
                        siteId={siteId}
                        layout="stack"
                        onSuccess={handleSuccess}
                    />
                </div>
            )}
        </dialog>
    )
}

// ── Banner variant ───────────────────────────────────────────────────────────
// Plan 260415 Lỗi B — text color giờ dùng `#ffffff` cùng với explicit bg gradient.
// Banner chủ động dùng primary+secondary gradient → text trắng luôn đúng contrast
// (thiết kế gradient đảm bảo dark tone). Nhưng form inputs dùng variantColor='inverse'
// để match white theme trên gradient bg.

function BannerVariant({ block, siteId }: { block: NewsletterConfig; siteId?: string }) {
    const { headline, subheadline, buttonLabel = 'Subscribe', placeholder = 'your@email.com' } = block
    return (
        <NewsletterSection
            style={{
                background: 'linear-gradient(135deg, var(--brand-primary), var(--brand-secondary))',
                color: '#ffffff',
            }}
            decorative={<DuotoneOverlay color1={CSS_VARS.primary} color2={CSS_VARS.secondary} opacity={0.3} blendMode="overlay" />}
        >
            <div className="flex flex-col lg:flex-row items-center gap-6 lg:gap-12 max-w-4xl mx-auto">
                <div className="flex-1 text-center lg:text-left">
                    <Heading level={2} className="mb-2" style={{ fontFamily: CSS_VARS.fontHeading }}>
                        {headline || 'Stay Updated'}
                    </Heading>
                    {subheadline && <Body className="opacity-85">{subheadline}</Body>}
                </div>
                <div className="flex-1 w-full max-w-md">
                    <EmailForm
                        placeholder={placeholder}
                        buttonLabel={buttonLabel}
                        siteId={siteId}
                        layout="row"
                        variantColor="inverse"
                    />
                </div>
            </div>
        </NewsletterSection>
    )
}

// ── A5 (260417) — 3 new newsletter variants ──────────────────────────────────

/**
 * stacked-card: centered card with shadow, form stacks vertically inside.
 * Different from inline (which is horizontal row). Use for emphasized
 * standalone newsletter section. A4 vocab: NoiseTexture (card texture).
 */
function StackedCardVariant({ block, siteId }: { block: NewsletterConfig; siteId?: string }) {
    const { headline, subheadline, buttonLabel = 'Subscribe', placeholder = 'your@email.com' } = block
    return (
        <NewsletterSection style={{ color: CSS_VARS.text, background: CSS_VARS.background }}>
            <div
                className={`max-w-lg mx-auto text-center ${CARD_PADDING.lg} relative overflow-hidden`}
                style={{
                    background: CSS_VARS.surface,
                    borderRadius: 'var(--radius-lg)',
                    boxShadow: '0 20px 60px rgba(0,0,0,0.08)',
                    border: '1px solid rgba(var(--brand-primary-rgb), 0.1)',
                }}
            >
                <NoiseTexture opacity={0.05} />
                <div className="relative z-10">
                    <Heading level={2} className="mb-2" style={{ fontFamily: CSS_VARS.fontHeading }}>
                        {headline || 'Join our newsletter'}
                    </Heading>
                    {subheadline && (
                        <Body size="small" className="mb-6 opacity-70" style={{ color: CSS_VARS.muted }}>
                            {subheadline}
                        </Body>
                    )}
                    <EmailForm placeholder={placeholder} buttonLabel={buttonLabel} siteId={siteId} layout="stack" />
                </div>
            </div>
        </NewsletterSection>
    )
}

/**
 * minimal: very compact — heading + form on single row, no separate section
 * framing. Blends into page flow. A4 vocab: none (minimal aesthetic).
 */
function MinimalVariant({ block, siteId }: { block: NewsletterConfig; siteId?: string }) {
    const { headline, buttonLabel = 'Subscribe', placeholder = 'your@email.com' } = block
    return (
        <NewsletterSection padding="compact" style={{ color: CSS_VARS.text, background: CSS_VARS.background }}>
            <div className="flex flex-col sm:flex-row items-center gap-4 max-w-2xl mx-auto">
                <Heading level={4} className="flex-shrink-0" style={{ fontFamily: CSS_VARS.fontHeading }}>
                    {headline || 'Stay in the loop'}
                </Heading>
                <div className="flex-1 w-full">
                    <EmailForm placeholder={placeholder} buttonLabel={buttonLabel} siteId={siteId} layout="row" />
                </div>
            </div>
        </NewsletterSection>
    )
}

/**
 * incentive-grid: 2-col — subheadline as bullet-list benefits on left, form
 * on right. Splits `subheadline` on newlines or semicolons as benefit lines;
 * falls back to 3 generic benefits if none. A4 vocab: LayeredShapes.
 */
function IncentiveGridVariant({ block, siteId }: { block: NewsletterConfig; siteId?: string }) {
    const { headline, subheadline, buttonLabel = 'Subscribe', placeholder = 'your@email.com' } = block
    const benefits = subheadline
        ? subheadline.split(/[\n;•]/).map((s) => s.trim()).filter(Boolean).slice(0, 4)
        : ['Weekly tips', 'Early access', 'Exclusive offers']
    return (
        <NewsletterSection
            style={{ color: CSS_VARS.text, background: CSS_VARS.surface }}
            decorative={<LayeredShapes color={CSS_VARS.primary} opacity={0.1} />}
        >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-center max-w-4xl mx-auto">
                <div>
                    <Heading level={2} className="mb-4" style={{ fontFamily: CSS_VARS.fontHeading }}>
                        {headline || 'Get the good stuff'}
                    </Heading>
                    <ul className="flex flex-col gap-3">
                        {benefits.map((b, i) => (
                            <li key={i} className="flex items-start gap-3">
                                <span
                                    className="mt-1 w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold text-white"
                                    style={{ background: CSS_VARS.primary }}
                                    aria-hidden="true"
                                >
                                    ✓
                                </span>
                                <Body size="small" style={{ color: CSS_VARS.text }}>{b}</Body>
                            </li>
                        ))}
                    </ul>
                </div>
                <div>
                    <EmailForm placeholder={placeholder} buttonLabel={buttonLabel} siteId={siteId} layout="stack" />
                </div>
            </div>
        </NewsletterSection>
    )
}

export function NewsletterBlock({ block, site }: BlockProps<NewsletterConfig>) {
    const { variant = 'inline' } = block
    // Plan 260415 Lỗi G — safer String() cast instead of `as string`
    const siteId = site?.id != null ? String(site.id) : undefined

    switch (variant) {
        case 'popup':
            // return <PopupVariant block={block} siteId={siteId} /> // Temporarily disabled: Bug #791
            return <InlineVariant block={block} siteId={siteId} />
        case 'banner':
            return <BannerVariant block={block} siteId={siteId} />
        case 'stacked-card':
            return <StackedCardVariant block={block} siteId={siteId} />
        case 'minimal':
            return <MinimalVariant block={block} siteId={siteId} />
        case 'incentive-grid':
            return <IncentiveGridVariant block={block} siteId={siteId} />
        case 'inline':
        default:
            return <InlineVariant block={block} siteId={siteId} />
    }
}
