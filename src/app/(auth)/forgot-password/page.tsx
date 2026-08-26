'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Mail, Loader2, ArrowLeft, CheckCircle2, RefreshCw } from 'lucide-react'
import { useI18n } from '@/i18n'
import LanguageSwitcher from '@/components/LanguageSwitcher'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

const RESEND_COOLDOWN_SECONDS = 60

const forgotSchema = z.object({
    email: z.string().min(1, 'Email is required').email('Please enter a valid email'),
})

type ForgotForm = z.infer<typeof forgotSchema>

export default function ForgotPasswordPage() {
    const [submitted, setSubmitted] = useState(false)
    const [cooldown, setCooldown] = useState(0)
    const [resending, setResending] = useState(false)

    const {
        register,
        handleSubmit,
        formState: { errors, isSubmitting },
        setError: setFormError,
        getValues,
    } = useForm<ForgotForm>({
        resolver: zodResolver(forgotSchema),
        defaultValues: { email: '' },
    })
    const { t } = useI18n()

    // Cooldown countdown timer
    useEffect(() => {
        if (cooldown <= 0) return
        const timer = setInterval(() => {
            setCooldown((prev) => {
                if (prev <= 1) {
                    clearInterval(timer)
                    return 0
                }
                return prev - 1
            })
        }, 1000)
        return () => clearInterval(timer)
    }, [cooldown])

    const sendResetLink = useCallback(async (email: string) => {
        const res = await fetch('/api/users/forgot-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email }),
        })
        // Always show success — don't reveal if email exists (security)
        return res.ok || res.status === 404
    }, [])

    const onSubmit = async (data: ForgotForm) => {
        try {
            // ── FR-07/FR-08: Check if user is Owner (SSO) or Staff (internal) ──
            const checkRes = await fetch('/api/auth/check-reset-flow', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: data.email }),
            })
            const checkData = await checkRes.json()

            if (checkData.flow === 'sso' && checkData.redirectUrl) {
                // Owner → redirect straight to SSO portal (no intermediate screen)
                window.location.href = checkData.redirectUrl
                return
            }

            // Staff → internal reset flow
            const success = await sendResetLink(data.email)

            if (success) {
                setSubmitted(true)
                setCooldown(RESEND_COOLDOWN_SECONDS)
                toast.success(t.auth.forgot.resetLinkSent, {
                    description: t.auth.forgot.checkInbox,
                })
            } else {
                setFormError('root', { message: t.auth.forgot.somethingWrong })
                toast.error(t.auth.forgot.somethingWrong)
            }
        } catch {
            setFormError('root', { message: t.auth.forgot.connectionError })
            toast.error(t.auth.forgot.connectionError)
        }
    }

    const handleResend = async () => {
        if (cooldown > 0 || resending) return
        const email = getValues('email')
        if (!email) return

        setResending(true)
        try {
            const success = await sendResetLink(email)
            if (success) {
                setCooldown(RESEND_COOLDOWN_SECONDS)
                toast.success(t.auth.forgot.linkResent, {
                    description: t.auth.forgot.checkInboxAgain,
                })
            } else {
                toast.error(t.auth.forgot.resendFailed)
            }
        } catch {
            toast.error(t.auth.forgot.connectionError)
        } finally {
            setResending(false)
        }
    }

    // Success state — Email Sent (Figma node 30726-111)
    if (submitted) {
        return (
            <div className="animate-in fade-in duration-500 w-full flex flex-col items-center">
                {/* Main Content — matches Figma Container gap: 32px */}
                <div
                    className="flex flex-col items-stretch w-full"
                    style={{ gap: '32px' }}
                >
                    {/* Top block: Icon + Title + Description (gap: 16px, align-items: center) */}
                    <div
                        className="flex flex-col items-center w-full"
                        style={{ gap: '16px' }}
                    >
                        {/* Icon Container — 64×64, rounded-full, bg: rgba(0,201,80,0.1), padding: 0 16px */}
                        <div
                            className="flex items-center justify-center rounded-full"
                            style={{
                                width: '64px',
                                height: '64px',
                                background: 'rgba(0, 201, 80, 0.1)',
                                padding: '0 16px',
                            }}
                        >
                            <CheckCircle2
                                style={{
                                    width: '26.67px',
                                    height: '26.67px',
                                    color: '#05DF72',
                                    strokeWidth: 2.67,
                                }}
                            />
                        </div>

                        {/* Text Block — column, gap: 8px, width: 382px */}
                        <div
                            className="flex flex-col items-stretch"
                            style={{ gap: '8px', width: '382px', maxWidth: '100%' }}
                        >
                            {/* Title: "Email Sent" — Inter 600, 20px, 1.4em, center */}
                            <h2
                                style={{
                                    fontFamily: 'Inter, sans-serif',
                                    fontWeight: 600,
                                    fontSize: '20px',
                                    lineHeight: '1.4em',
                                    textAlign: 'center',
                                    color: 'var(--auth-text)',
                                    margin: 0,
                                }}
                            >
                                {t.auth.forgot.emailSentTitle}
                            </h2>

                            {/* Description — Inter 400, 14px, 1.625em, center */}
                            <p
                                style={{
                                    fontFamily: 'Inter, sans-serif',
                                    fontWeight: 400,
                                    fontSize: '14px',
                                    lineHeight: '1.625em',
                                    textAlign: 'center',
                                    color: 'var(--auth-text-muted)',
                                    margin: 0,
                                }}
                            >
                                {t.auth.forgot.emailSentDesc}
                            </p>
                        </div>
                    </div>

                    {/* Bottom text — Inter 400, 12px, 1.333em, center */}
                    <p
                        className="w-full"
                        style={{
                            fontFamily: 'Inter, sans-serif',
                            fontWeight: 400,
                            fontSize: '12px',
                            lineHeight: '1.333em',
                            textAlign: 'center',
                            color: 'var(--auth-text-subtle)',
                            margin: 0,
                        }}
                    >
                        {t.auth.forgot.emailSentBottom}
                    </p>
                </div>

                {/* Language Switcher */}
                <div className="w-full" style={{ marginTop: '24px' }}>
                    <LanguageSwitcher variant="segmented" />
                </div>
            </div>
        )
    }

    return (
        <div className="animate-in fade-in duration-500 flex flex-col items-center w-full">
            {/* Header */}
            <div className="flex flex-col items-center justify-center text-center mx-auto" style={{ gap: 8, maxWidth: 382 }}>
                <h1
                    style={{
                        fontFamily: 'Inter, sans-serif',
                        fontSize: 24,
                        fontWeight: 700,
                        lineHeight: '32px',
                        margin: 0,
                        color: 'var(--auth-text)',
                    }}
                >
                    {t.auth.forgot.title}
                </h1>
                <p
                    className="text-center"
                    style={{
                        color: 'var(--auth-text-muted)',
                        fontFamily: 'Inter, sans-serif',
                        fontSize: 14,
                        fontWeight: 400,
                        lineHeight: '20px',
                        width: '100%',
                        margin: 0,
                    }}
                >
                    {t.auth.forgot.subtitle}
                </p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col w-full mx-auto" style={{ maxWidth: 382 }}>
                {/* Root error */}
                {errors.root && (
                    <div className="flex items-center gap-2 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 mt-6 text-sm text-red-400">
                        <svg className="h-4 w-4 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
                        </svg>
                        {errors.root.message}
                    </div>
                )}

                {/* Email */}
                <div className="flex flex-col w-full" style={{ gap: 8, marginTop: 24 }}>
                    <label
                        htmlFor="email"
                        style={{
                            color: 'var(--auth-text-muted)',
                            fontFamily: 'Inter, sans-serif',
                            fontSize: 14,
                            fontWeight: 500,
                            lineHeight: '20px',
                        }}
                    >
                        {t.auth.forgot.emailLabel}
                    </label>
                    <div className="relative">
                        <Mail className="absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 pointer-events-none text-[hsl(var(--muted-foreground))]" />
                        <Input
                            id="email"
                            type="email"
                            placeholder={t.auth.forgot.emailPlaceholder}
                            className={`h-12 pl-9${errors.email ? ' border-red-500 focus-visible:border-red-500' : ''}`}
                            {...register('email')}
                        />
                    </div>
                    {errors.email && (
                        <p className="text-xs text-red-400">{errors.email.message}</p>
                    )}
                </div>

                <Button type="submit" disabled={isSubmitting} className="mt-5 h-12 w-full">
                    {isSubmitting ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            {t.auth.forgot.submitting}
                        </>
                    ) : (
                        t.auth.forgot.sendButton
                    )}
                </Button>
            </form>

            {/* Bottom Actions */}
            <div className="flex flex-col w-full items-center" style={{ gap: 24, marginTop: 32 }}>
                <Link
                    href="/login"
                    className="inline-flex items-center justify-center gap-[8px] text-primary hover:text-primary/80 transition-colors"
                    style={{
                        fontFamily: 'Inter, sans-serif',
                        fontSize: '14px',
                        fontWeight: 500,
                        lineHeight: '20px',
                        textDecoration: 'none',
                    }}
                >
                    <ArrowLeft className="h-4 w-4 text-primary" />
                    {t.auth.forgot.backLogin}
                </Link>

                <div className="w-full">
                    <LanguageSwitcher variant="segmented" />
                </div>
            </div>
        </div>
    )
}
