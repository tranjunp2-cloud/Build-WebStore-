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

const resetSchema = z
    .object({
        password: z.string().min(8, 'Password must be at least 8 characters'),
        confirmPassword: z.string(),
    })
    .refine((d) => d.password === d.confirmPassword, {
        message: 'Passwords don\'t match',
        path: ['confirmPassword'],
    })

type ResetForm = z.infer<typeof resetSchema>

function getPasswordStrength(password: string): { score: number; label: string; color: string } {
    let score = 0
    if (password.length >= 8) score++
    if (/[A-Z]/.test(password)) score++
    if (/[0-9]/.test(password)) score++
    if (/[^A-Za-z0-9]/.test(password)) score++

    const levels: { label: string; color: string }[] = [
        { label: 'Too weak', color: 'bg-red-500' },
        { label: 'Weak', color: 'bg-orange-500' },
        { label: 'Fair', color: 'bg-yellow-500' },
        { label: 'Good', color: 'bg-emerald-400' },
        { label: 'Strong', color: 'bg-emerald-500' },
    ]
    return { score, ...levels[score] }
}

function ResetPasswordForm() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const token = searchParams.get('token')
    const [showPassword, setShowPassword] = useState(false)
    const [showConfirm, setShowConfirm] = useState(false)
    const { t } = useI18n()

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
    const strength = useMemo(() => getPasswordStrength(watchPassword), [watchPassword])

    // No token → error state
    if (!token) {
        return (
            <div className="animate-in fade-in duration-500 w-full flex flex-col justify-center items-center text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10 ring-1 ring-red-500/20">
                    <svg className="h-8 w-8 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
                    </svg>
                </div>
                <h2 className="text-xl font-bold text-white" style={{ fontFamily: 'Inter, sans-serif' }}>{t.auth.reset.invalidLink}</h2>
                <p className="mt-2 text-sm" style={{ color: 'rgba(248, 250, 252, 0.70)', fontFamily: 'Inter, sans-serif' }}>
                    {t.auth.reset.invalidLinkDesc}
                </p>
                <div className="mt-8 space-y-4 w-full">
                    <Link href="/forgot-password" style={{ textDecoration: 'none' }}>
                        <button
                            type="button"
                            className="relative w-full transition-all hover:brightness-110 active:scale-[0.99]"
                            style={{
                                display: 'flex',
                                padding: '14px 0',
                                justifyContent: 'center',
                                alignItems: 'center',
                                borderRadius: 16,
                                border: 'none',
                                cursor: 'pointer',
                                background: 'linear-gradient(90deg, #3B82F6 0%, #3989F3 7.14%, #378FEF 14.29%, #3596EC 21.43%, #339CE9 28.57%, #32A2E5 35.71%, #30A8E1 42.86%, #2FAEDE 50%, #2EB3DA 57.14%, #2DB9D6 64.29%, #2DBFD1 71.43%, #2CC4CD 78.57%, #2CC9C9 85.71%, #2DCFC4 92.86%, #2DD4BF 100%)',
                                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.10), 0 4px 6px -4px rgba(0, 0, 0, 0.10)',
                                fontFamily: 'Inter, sans-serif',
                                fontSize: 14,
                                fontWeight: 600,
                                lineHeight: '20px',
                                color: '#FFFFFF',
                            }}
                        >
                            {t.auth.reset.requestNewLink}
                        </button>
                    </Link>

                    <div className="flex flex-col w-full items-center" style={{ gap: 24, marginTop: 24 }}>
                        <Link
                            href="/login"
                            className="inline-flex items-center justify-center gap-[8px] text-[#3B82F6] hover:text-blue-400 transition-colors"
                            style={{
                                fontFamily: 'Inter, sans-serif',
                                fontSize: '14px',
                                fontWeight: 500,
                                lineHeight: '20px',
                                textDecoration: 'none',
                            }}
                        >
                            <ArrowLeft className="h-4 w-4 text-[#3B82F6]" />
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
                const message = errorData?.errors?.[0]?.message || 'Reset link has expired'

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

    const inputClasses = (hasError: boolean) =>
        `w-full h-12 rounded-xl pl-10 pr-10 text-sm text-white placeholder:text-[rgba(248,250,252,0.40)] outline-none focus:ring-2 focus:ring-blue-500/30 transition-all ${hasError ? 'ring-2 ring-red-500/50 border-transparent' : ''}`

    return (
        <div className="animate-in fade-in duration-500 w-full flex flex-col items-center">
            {/* Header */}
            <div className="flex flex-col items-center justify-center text-center mx-auto" style={{ gap: 8, maxWidth: 382 }}>
                <h1
                    className="text-[#F8FAFC]"
                    style={{
                        fontFamily: 'Inter, sans-serif',
                        fontSize: 24,
                        fontWeight: 700,
                        lineHeight: '32px',
                        margin: 0,
                    }}
                >
                    {t.auth.reset.title}
                </h1>
                <p
                    className="text-center"
                    style={{
                        color: 'rgba(248, 250, 252, 0.70)',
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
                            color: 'rgba(248, 250, 252, 0.8)',
                            fontFamily: 'Inter, sans-serif',
                            fontSize: 14,
                            fontWeight: 500,
                            lineHeight: '20px',
                        }}
                    >
                        {t.auth.reset.newPassword}
                    </label>
                    <div className="relative" style={{ marginTop: 4 }}>
                        <Lock className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-[#94A3B8]" />
                        <input
                            id="password"
                            type={showPassword ? 'text' : 'password'}
                            placeholder={t.auth.reset.newPasswordPlaceholder}
                            className={inputClasses(!!errors.password)}
                            style={{
                                background: '#1E293B',
                                border: '1px solid rgba(255, 255, 255, 0.08)',
                                boxShadow: '0px 0px 0px 0.057px rgba(59, 130, 246, 0)',
                                fontFamily: 'Inter, sans-serif',
                                lineHeight: '1.21em',
                            }}
                            {...register('password')}
                            autoFocus
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer border-none bg-transparent hover:text-white transition-colors"
                            style={{ color: 'rgba(248, 250, 252, 0.40)' }}
                            tabIndex={-1}
                        >
                            {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
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
                            <p className="mt-1 text-xs text-gray-500">{strength.label}</p>
                        </div>
                    )}
                </div>

                {/* Confirm Password */}
                <div className="flex flex-col w-full" style={{ gap: 4, marginTop: 20 }}>
                    <label
                        htmlFor="confirmPassword"
                        style={{
                            color: 'rgba(248, 250, 252, 0.8)',
                            fontFamily: 'Inter, sans-serif',
                            fontSize: 14,
                            fontWeight: 500,
                            lineHeight: '20px',
                        }}
                    >
                        {t.auth.reset.confirmPassword}
                    </label>
                    <div className="relative" style={{ marginTop: 4 }}>
                        <Lock className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-[#94A3B8]" />
                        <input
                            id="confirmPassword"
                            type={showConfirm ? 'text' : 'password'}
                            placeholder="••••••••"
                            className={inputClasses(!!errors.confirmPassword)}
                            style={{
                                background: '#1E293B',
                                border: '1px solid rgba(255, 255, 255, 0.08)',
                                boxShadow: '0px 0px 0px 0.057px rgba(59, 130, 246, 0)',
                                fontFamily: 'Inter, sans-serif',
                                lineHeight: '1.21em',
                            }}
                            {...register('confirmPassword')}
                        />
                        <button
                            type="button"
                            onClick={() => setShowConfirm(!showConfirm)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer border-none bg-transparent hover:text-white transition-colors"
                            style={{ color: 'rgba(248, 250, 252, 0.40)' }}
                            tabIndex={-1}
                        >
                            {showConfirm ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                        </button>
                    </div>
                    {errors.confirmPassword && (
                        <p className="text-xs text-red-400 mt-1">{errors.confirmPassword.message}</p>
                    )}
                </div>

                {/* Requirements */}
                <div className="space-y-1.5" style={{ marginTop: 20 }}>
                    {[
                        { test: watchPassword.length >= 8, label: t.auth.reset.reqLength },
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
                <button
                    type="submit"
                    disabled={isSubmitting}
                    className="relative w-full transition-all disabled:opacity-50 hover:brightness-110 active:scale-[0.99]"
                    style={{
                        display: 'flex',
                        padding: '14px 0',
                        justifyContent: 'center',
                        alignItems: 'center',
                        borderRadius: 16,
                        marginTop: 20,
                        border: 'none',
                        cursor: 'pointer',
                        background: 'linear-gradient(90deg, #3B82F6 0%, #3989F3 7.14%, #378FEF 14.29%, #3596EC 21.43%, #339CE9 28.57%, #32A2E5 35.71%, #30A8E1 42.86%, #2FAEDE 50%, #2EB3DA 57.14%, #2DB9D6 64.29%, #2DBFD1 71.43%, #2CC4CD 78.57%, #2CC9C9 85.71%, #2DCFC4 92.86%, #2DD4BF 100%)',
                        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.10), 0 4px 6px -4px rgba(0, 0, 0, 0.10)',
                        fontFamily: 'Inter, sans-serif',
                        fontSize: 14,
                        fontWeight: 600,
                        lineHeight: '20px',
                        color: '#FFFFFF',
                    }}
                >
                    {isSubmitting ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            {t.auth.reset.submitting}
                        </>
                    ) : (
                        t.auth.reset.submit
                    )}
                </button>
            </form>

            {/* Bottom Actions */}
            <div className="flex flex-col w-full items-center" style={{ gap: 24, marginTop: 32 }}>
                <Link
                    href="/login"
                    className="inline-flex items-center justify-center gap-[8px] text-[#3B82F6] hover:text-blue-400 transition-colors"
                    style={{
                        fontFamily: 'Inter, sans-serif',
                        fontSize: '14px',
                        fontWeight: 500,
                        lineHeight: '20px',
                        textDecoration: 'none',
                    }}
                >
                    <ArrowLeft className="h-4 w-4 text-[#3B82F6]" />
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
                <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
            </div>
        }>
            <ResetPasswordForm />
        </Suspense>
    )
}
