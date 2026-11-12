'use client'

import { Suspense, useState, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Lock, Eye, EyeOff, Loader2, ArrowLeft, Check, ShieldCheck } from 'lucide-react'
import LanguageSwitcher from '@/components/LanguageSwitcher'
import { useI18n } from '@/i18n'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { PASSWORD_MIN_LENGTH, getPasswordStrength } from '@/lib/auth/password-rules'

function createResetSchema(t: ReturnType<typeof useI18n>['t']) {
    return z
        .object({
            password: z.string().min(PASSWORD_MIN_LENGTH, t.auth.reset.passwordMin),
            confirmPassword: z.string(),
        })
        .refine((d) => d.password === d.confirmPassword, {
            message: t.auth.reset.passwordMismatch,
            path: ['confirmPassword'],
        })
}

type ResetForm = z.infer<ReturnType<typeof createResetSchema>>

const STRENGTH_COLORS = ['bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-emerald-400', 'bg-emerald-500']

function ResetPasswordForm() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const token = searchParams.get('token')
    const [showPassword, setShowPassword] = useState(false)
    const [showConfirm, setShowConfirm] = useState(false)
    const { t } = useI18n()
    const resetSchema = useMemo(() => createResetSchema(t), [t])

    const {
        register,
        handleSubmit,
        watch,
        formState: { errors, isSubmitting },
        setError: setFormError,
    } = useForm<ResetForm>({
        resolver: zodResolver(resetSchema),
        defaultValues: { password: '', confirmPassword: '' },
    })

    const watchPassword = watch('password', '')
    const strength = useMemo(() => {
        const score = getPasswordStrength(watchPassword)
        return { score, color: STRENGTH_COLORS[score] }
    }, [watchPassword])
    const strengthLabels = useMemo(() => [
        t.auth.reset.strengthTooWeak,
        t.auth.reset.strengthWeak,
        t.auth.reset.strengthFair,
        t.auth.reset.strengthGood,
        t.auth.reset.strengthStrong,
    ], [t])

    // No token → error state
    if (!token) {
        return (
            <div className="animate-in fade-in duration-500 w-full flex flex-col justify-center items-center text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10 ring-1 ring-red-500/20">
                    <svg className="h-8 w-8 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
                    </svg>
                </div>
                <h2 className="text-xl font-bold" style={{ fontFamily: 'Inter, sans-serif', color: 'var(--auth-text)' }}>{t.auth.reset.invalidLink}</h2>
                <p className="mt-2 text-sm" style={{ color: 'var(--auth-text-muted)', fontFamily: 'Inter, sans-serif' }}>
                    {t.auth.reset.invalidLinkDesc}
                </p>
                <div className="mt-8 space-y-4 w-full">
                    <Button asChild className="h-12 w-full">
                        <Link href="/forgot-password" style={{ textDecoration: 'none' }}>
                            {t.auth.reset.requestNewLink}
                        </Link>
                    </Button>

                    <div className="flex flex-col w-full items-center" style={{ gap: 24, marginTop: 24 }}>
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
                            {t.auth.reset.backToSignIn}
                        </Link>

                        <div className="w-full">
                            <LanguageSwitcher variant="segmented" />
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    const onSubmit = async (data: ResetForm) => {
        try {
            const res = await fetch('/api/users/reset-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    token,
                    password: data.password,
                }),
            })

            if (!res.ok) {
                const errorData = await res.json().catch(() => null)
                const message = errorData?.errors?.[0]?.message || t.auth.reset.linkExpired

                if (message.toLowerCase().includes('token') || message.toLowerCase().includes('expired')) {
                    setFormError('root', { message: t.auth.reset.linkExpired })
                    toast.error(t.auth.reset.linkExpired)
                } else {
                    setFormError('root', { message })
                    toast.error(message)
                }
                return
            }

            toast.success(t.auth.reset.successTitle, {
                description: t.auth.reset.successDesc,
            })

            router.push('/login')
        } catch {
            setFormError('root', { message: t.auth.reset.connectionError })
            toast.error(t.auth.reset.connectionError)
        }
    }

    return (
        <div className="animate-in fade-in duration-500 w-full flex flex-col items-center">
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
                    {t.auth.reset.title}
                </h1>
                <p
                    className="text-center"
                    style={{
                        color: 'var(--auth-text-muted)',
                        fontFamily: 'Inter, sans-serif',
                        fontSize: 14,
                        fontWeight: 400,
                        lineHeight: '22px',
                        width: '100%',
                        margin: 0,
                    }}
                >
                    {t.auth.reset.subtitle}
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

                {/* New Password */}
                <div className="flex flex-col w-full" style={{ gap: 4, marginTop: 24 }}>
                    <label
                        htmlFor="password"
                        style={{
                            color: 'var(--auth-text-muted)',
                            fontFamily: 'Inter, sans-serif',
                            fontSize: 14,
                            fontWeight: 500,
                            lineHeight: '20px',
                        }}
                    >
                        {t.auth.reset.newPassword}
                    </label>
                    <div className="relative mt-1">
                        <Lock className="absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 pointer-events-none text-[hsl(var(--muted-foreground))]" />
                        <Input
                            id="password"
                            type={showPassword ? 'text' : 'password'}
                            placeholder={t.auth.reset.newPasswordPlaceholder}
                            className={`h-12 pl-9 pr-9${errors.password ? ' border-red-500 focus-visible:border-red-500' : ''}`}
                            {...register('password')}
                            autoFocus
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 z-10 -translate-y-1/2 cursor-pointer border-none bg-transparent text-[hsl(var(--muted-foreground))] transition-colors"
                            tabIndex={-1}
                        >
                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                    </div>
                    {errors.password && (
                        <p className="text-xs text-red-400 mt-1">{errors.password.message}</p>
                    )}

                    {/* Password strength */}
                    {watchPassword && (
                        <div className="mt-2">
                            <div className="flex gap-1">
                                {[0, 1, 2, 3].map((i) => (
                                    <div
                                        key={i}
                                        className={`h-1 flex-1 rounded-full transition-all duration-300 ${i <= strength.score - 1 ? strength.color : 'bg-white/10'
                                            }`}
                                    />
                                ))}
                            </div>
                            <p className="mt-1 text-xs text-gray-500">{strengthLabels[strength.score]}</p>
                        </div>
                    )}
                </div>

                {/* Confirm Password */}
                <div className="flex flex-col w-full" style={{ gap: 4, marginTop: 20 }}>
                    <label
                        htmlFor="confirmPassword"
                        style={{
                            color: 'var(--auth-text-muted)',
                            fontFamily: 'Inter, sans-serif',
                            fontSize: 14,
                            fontWeight: 500,
                            lineHeight: '20px',
                        }}
                    >
                        {t.auth.reset.confirmPassword}
                    </label>
                    <div className="relative mt-1">
                        <Lock className="absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 pointer-events-none text-[hsl(var(--muted-foreground))]" />
                        <Input
                            id="confirmPassword"
                            type={showConfirm ? 'text' : 'password'}
                            placeholder={t.auth.passwordPlaceholder}
                            className={`h-12 pl-9 pr-9${errors.confirmPassword ? ' border-red-500 focus-visible:border-red-500' : ''}`}
                            {...register('confirmPassword')}
                        />
                        <button
                            type="button"
                            onClick={() => setShowConfirm(!showConfirm)}
                            className="absolute right-3 top-1/2 z-10 -translate-y-1/2 cursor-pointer border-none bg-transparent text-[hsl(var(--muted-foreground))] transition-colors"
                            tabIndex={-1}
                        >
                            {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                    </div>
                    {errors.confirmPassword && (
                        <p className="text-xs text-red-400 mt-1">{errors.confirmPassword.message}</p>
                    )}
                </div>

                {/* Requirements */}
                <div className="space-y-1.5" style={{ marginTop: 20 }}>
                    {[
                        { test: watchPassword.length >= PASSWORD_MIN_LENGTH, label: t.auth.reset.reqLength },
                        { test: /[A-Z]/.test(watchPassword), label: t.auth.reset.reqUpper },
                        { test: /[0-9]/.test(watchPassword), label: t.auth.reset.reqNumber },
                    ].map(({ test, label }) => (
                        <div key={label} className="flex items-center gap-2 text-xs">
                            <Check className={`h-3 w-3 transition-colors ${test ? 'text-emerald-400' : 'text-gray-600'}`} />
                            <span className={test ? 'text-gray-300' : 'text-gray-500'} style={{ fontFamily: 'Inter, sans-serif' }}>{label}</span>
                        </div>
                    ))}
                </div>

                {/* Submit */}
                <Button type="submit" disabled={isSubmitting} className="mt-5 h-12 w-full">
                    {isSubmitting ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            {t.auth.reset.submitting}
                        </>
                    ) : (
                        t.auth.reset.submit
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
                    {t.auth.reset.backLogin}
                </Link>

                <div className="w-full">
                    <LanguageSwitcher variant="segmented" />
                </div>
            </div>
        </div>
    )
}

export default function ResetPasswordPage() {
    return (
        <Suspense fallback={
            <div className="w-full min-h-[300px] flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        }>
            <ResetPasswordForm />
        </Suspense>
    )
}
