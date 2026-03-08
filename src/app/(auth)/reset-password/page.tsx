'use client'

import { Suspense, useState, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Lock, Eye, EyeOff, Loader2, ArrowLeft, Check, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

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
            <div className="animate-in fade-in duration-500 text-center py-4">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10 ring-1 ring-red-500/20">
                    <svg className="h-8 w-8 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
                    </svg>
                </div>
                <h2 className="text-xl font-bold text-white">Invalid reset link</h2>
                <p className="mt-2 text-sm text-gray-400">
                    This password reset link is invalid or has expired.
                </p>
                <div className="mt-6 space-y-3">
                    <Link href="/forgot-password">
                        <Button className="w-full bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-medium h-11">
                            Request new reset link
                        </Button>
                    </Link>
                    <Link
                        href="/login"
                        className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-300 transition-colors"
                    >
                        <ArrowLeft className="h-3.5 w-3.5" />
                        Back to sign in
                    </Link>
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
                    setFormError('root', { message: 'This reset link has expired. Please request a new one.' })
                    toast.error('Reset link expired. Please request a new one.')
                } else {
                    setFormError('root', { message })
                    toast.error(message)
                }
                return
            }

            toast.success('Password reset successful! 🔐', {
                description: 'You can now sign in with your new password.',
            })

            router.push('/login')
        } catch {
            setFormError('root', { message: 'Connection error. Please try again.' })
            toast.error('Connection error. Please try again.')
        }
    }

    const inputClasses = (hasError: boolean) =>
        `pl-10 pr-10 bg-white/[0.06] border-white/[0.08] text-white placeholder:text-gray-500 focus:border-blue-500/50 focus:ring-blue-500/20 transition-colors ${hasError ? 'border-red-500/50' : ''}`

    return (
        <div className="animate-in fade-in duration-500">
            {/* Header */}
            <div className="mb-6 text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-blue-500/10 ring-1 ring-blue-500/20">
                    <ShieldCheck className="h-6 w-6 text-blue-400" />
                </div>
                <h1 className="text-2xl font-bold text-white">Set new password</h1>
                <p className="mt-1.5 text-sm text-gray-400">
                    Your new password must be different from previous ones
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

                {/* New Password */}
                <div>
                    <Label htmlFor="password" className="text-gray-300">New password</Label>
                    <div className="relative mt-1.5">
                        <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
                        <Input
                            id="password"
                            type={showPassword ? 'text' : 'password'}
                            placeholder="Min. 8 characters"
                            className={inputClasses(!!errors.password)}
                            {...register('password')}
                            autoFocus
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                            tabIndex={-1}
                        >
                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                    </div>
                    {errors.password && (
                        <p className="mt-1 text-xs text-red-400">{errors.password.message}</p>
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
                <div>
                    <Label htmlFor="confirmPassword" className="text-gray-300">Confirm new password</Label>
                    <div className="relative mt-1.5">
                        <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
                        <Input
                            id="confirmPassword"
                            type={showConfirm ? 'text' : 'password'}
                            placeholder="••••••••"
                            className={inputClasses(!!errors.confirmPassword)}
                            {...register('confirmPassword')}
                        />
                        <button
                            type="button"
                            onClick={() => setShowConfirm(!showConfirm)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                            tabIndex={-1}
                        >
                            {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                    </div>
                    {errors.confirmPassword && (
                        <p className="mt-1 text-xs text-red-400">{errors.confirmPassword.message}</p>
                    )}
                </div>

                {/* Requirements */}
                <div className="space-y-1">
                    {[
                        { test: watchPassword.length >= 8, label: 'At least 8 characters' },
                        { test: /[A-Z]/.test(watchPassword), label: 'One uppercase letter' },
                        { test: /[0-9]/.test(watchPassword), label: 'One number' },
                    ].map(({ test, label }) => (
                        <div key={label} className="flex items-center gap-2 text-xs">
                            <Check className={`h-3 w-3 transition-colors ${test ? 'text-emerald-400' : 'text-gray-600'}`} />
                            <span className={test ? 'text-gray-300' : 'text-gray-500'}>{label}</span>
                        </div>
                    ))}
                </div>

                {/* Submit */}
                <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-medium h-11 shadow-lg shadow-blue-500/25 transition-all hover:shadow-blue-500/40 disabled:opacity-50"
                >
                    {isSubmitting ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Resetting password...
                        </>
                    ) : (
                        'Reset password'
                    )}
                </Button>
            </form>

            {/* Back to login */}
            <div className="mt-6 text-center">
                <Link
                    href="/login"
                    className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-300 transition-colors"
                >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    Back to sign in
                </Link>
            </div>
        </div>
    )
}

export default function ResetPasswordPage() {
    return (
        <Suspense fallback={<div className="flex min-h-[200px] items-center justify-center text-gray-400">Loading...</div>}>
            <ResetPasswordForm />
        </Suspense>
    )
}
