'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Mail, Loader2, ArrowLeft, CheckCircle2, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useI18n } from '@/i18n'
import LanguageSwitcher from '@/components/LanguageSwitcher'

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
            const success = await sendResetLink(data.email)

            if (success) {
                setSubmitted(true)
                setCooldown(RESEND_COOLDOWN_SECONDS)
                toast.success('Reset link sent!', {
                    description: 'Check your email inbox.',
                })
            } else {
                setFormError('root', { message: 'Something went wrong. Please try again.' })
                toast.error('Something went wrong. Please try again.')
            }
        } catch {
            setFormError('root', { message: 'Connection error. Please try again.' })
            toast.error('Connection error. Please try again.')
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
                toast.success('Reset link resent!', {
                    description: 'Check your email inbox again.',
                })
            } else {
                toast.error('Failed to resend. Please try again later.')
            }
        } catch {
            toast.error('Connection error. Please try again.')
        } finally {
            setResending(false)
        }
    }

    // Success state
    if (submitted) {
        return (
            <div className="animate-in fade-in duration-500 text-center py-4">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10 ring-1 ring-emerald-500/20">
                    <CheckCircle2 className="h-8 w-8 text-emerald-400" />
                </div>
                <h2 className="text-xl font-bold text-white">{t.auth.forgot.checkEmail}</h2>
                <p className="mt-2 text-sm text-gray-400">
                    {t.auth.forgot.sentTo}{' '}
                    <span className="text-gray-300 font-medium">{getValues('email')}</span>
                </p>
                <div className="mt-6 space-y-3">
                    {/* Resend button with cooldown */}
                    <div className="flex flex-col items-center gap-2">
                        <p className="text-xs text-gray-500">
                            {t.auth.forgot.notReceive}
                        </p>
                        <button
                            type="button"
                            onClick={handleResend}
                            disabled={cooldown > 0 || resending}
                            className={`inline-flex items-center gap-1.5 text-sm font-medium transition-colors ${cooldown > 0 || resending
                                    ? 'text-gray-600 cursor-not-allowed'
                                    : 'text-blue-400 hover:text-blue-300'
                                }`}
                        >
                            {resending ? (
                                <>
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    Sending...
                                </>
                            ) : cooldown > 0 ? (
                                <>
                                    <RefreshCw className="h-3.5 w-3.5" />
                                    Resend email ({cooldown}s)
                                </>
                            ) : (
                                <>
                                    <RefreshCw className="h-3.5 w-3.5" />
                                    Resend email
                                </>
                            )}
                        </button>
                    </div>

                    <Link
                        href="/login"
                        className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-400 hover:text-blue-300 transition-colors"
                    >
                        <ArrowLeft className="h-3.5 w-3.5" />
                        {t.auth.forgot.backLogin}
                    </Link>
                </div>
            </div>
        )
    }

    return (
        <div className="animate-in fade-in duration-500">
            {/* Header */}
            <div className="mb-6 text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-blue-500/10 ring-1 ring-blue-500/20">
                    <Mail className="h-6 w-6 text-blue-400" />
                </div>
                <h1 className="text-2xl font-bold text-white">{t.auth.forgot.title}</h1>
                <p className="mt-1.5 text-sm text-gray-400">
                    {t.auth.forgot.subtitle}
                </p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                {/* Root error */}
                {errors.root && (
                    <div className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                        <svg className="h-4 w-4 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
                        </svg>
                        {errors.root.message}
                    </div>
                )}

                {/* Email */}
                <div>
                    <Label htmlFor="email" className="text-gray-300">{t.auth.email}</Label>
                    <div className="relative mt-1.5">
                        <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
                        <Input
                            id="email"
                            type="email"
                            placeholder="you@example.com"
                            className={`pl-10 bg-white/[0.06] border-white/[0.08] text-white placeholder:text-gray-500 focus:border-blue-500/50 focus:ring-blue-500/20 transition-colors ${errors.email ? 'border-red-500/50' : ''}`}
                            {...register('email')}
                            autoFocus
                        />
                    </div>
                    {errors.email && (
                        <p className="mt-1 text-xs text-red-400">{errors.email.message}</p>
                    )}
                </div>

                <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-medium h-11 shadow-lg shadow-blue-500/25 transition-all hover:shadow-blue-500/40 disabled:opacity-50"
                >
                    {isSubmitting ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            {t.auth.forgot.submitting}
                        </>
                    ) : (
                        t.auth.forgot.submit
                    )}
                </Button>

                {/* Inline Language Switcher */}
                <div className="pt-2">
                    <LanguageSwitcher variant="segmented" />
                </div>
            </form>

            {/* Back to login */}
            <div className="mt-6 text-center">
                <Link
                    href="/login"
                    className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-300 transition-colors"
                >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    {t.auth.forgot.backLogin}
                </Link>
            </div>
        </div>
    )
}
