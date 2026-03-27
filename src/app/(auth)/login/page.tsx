'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Mail, Lock, Eye, EyeOff, Loader2, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useI18n, syncLocaleFromDB } from '@/i18n'
import LanguageSwitcher from '@/components/LanguageSwitcher'

const loginSchema = z.object({
    email: z.string().min(1, 'Email is required').email('Please enter a valid email'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
})

type LoginForm = z.infer<typeof loginSchema>

/**
 * Determine post-login redirect based on user role (BR-02, AC-5).
 * - Owner without tenant/site → /onboarding
 * - Owner with tenant → /dashboard (or returnUrl)
 * - Staff → /admin (Payload CMS workspace)
 */
function getRedirectByRole(
    user: { roles?: string[]; tenants?: { tenant: unknown }[] },
    returnUrl: string,
): string {
    const roles = user.roles || []

    // Staff → always Payload admin
    if (roles.includes('editor') || roles.includes('viewer')) {
        return '/admin'
    }

    // Owner without any tenant → onboarding
    if (roles.includes('tenant-owner') && (!user.tenants || user.tenants.length === 0)) {
        return '/onboarding'
    }

    // Owner with tenant → returnUrl or dashboard
    return returnUrl
}

function LoginFormContent() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const returnUrl = searchParams.get('returnUrl') || '/dashboard'
    const [showPassword, setShowPassword] = useState(false)
    const [checkingReset, setCheckingReset] = useState(false)
    const { t, setLocale } = useI18n()

    const {
        register,
        handleSubmit,
        formState: { errors, isSubmitting },
        setError: setFormError,
        resetField,
        getValues,
    } = useForm<LoginForm>({
        resolver: zodResolver(loginSchema),
        defaultValues: { email: '', password: '' },
    })

    // FR-07/FR-08: Smart forgot-password — Owner → SSO direct, Staff → internal
    const handleForgotPassword = async (e: React.MouseEvent) => {
        e.preventDefault()
        const email = getValues('email')?.trim()

        // No email typed → go to forgot-password form as usual
        if (!email) {
            router.push('/forgot-password')
            return
        }

        setCheckingReset(true)
        try {
            const res = await fetch('/api/auth/check-reset-flow', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email }),
            })
            const data = await res.json()

            if (data.flow === 'sso' && data.redirectUrl) {
                // Owner → redirect straight to SSO portal
                window.location.href = data.redirectUrl
                return
            }
        } catch {
            // On error, fall through to internal page
        } finally {
            setCheckingReset(false)
        }

        // Staff or unknown → internal forgot-password page
        router.push('/forgot-password')
    }

    const onSubmit = async (data: LoginForm) => {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 45000)

        try {
            let res: Response
            try {
                res = await fetch('/api/users/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        email: data.email.trim(),
                        password: data.password.trim(),
                    }),
                    credentials: 'include',
                    signal: controller.signal,
                })
            } catch (err) {
                if (err instanceof DOMException && err.name === 'AbortError') {
                    setFormError('root', { message: t.auth.errors.timeout })
                    toast.error(t.auth.errors.timeout)
                    return
                }
                throw err
            } finally {
                clearTimeout(timeout)
            }

            if (!res.ok) {
                const errorData = await res.json().catch(() => null)
                const message = errorData?.errors?.[0]?.message || t.auth.errors.incorrect

                setFormError('root', { message })
                resetField('password')
                toast.error(message)
                return
            }

            // Parse user data — but DON'T set cookie yet (need OTP)
            const responseData = await res.json().catch(() => ({ user: null }))
            const user = responseData?.user
            const userEmail = user?.email || data.email.trim()

            // Trigger OTP send
            try {
                await fetch('/api/users/send-otp', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: userEmail }),
                })
            } catch {
                // Non-blocking — OTP may still arrive
            }

            toast.success('Verification code sent!', {
                description: 'Check your email for the 6-digit code.',
            })

            // Redirect to OTP verification page
            const returnParam = returnUrl !== '/dashboard' ? `&returnUrl=${encodeURIComponent(returnUrl)}` : ''
            router.push(`/verify-otp?email=${encodeURIComponent(userEmail)}${returnParam}`)
        } catch {
            setFormError('root', { message: t.auth.errors.connection })
            toast.error(t.auth.errors.connection)
        }
    }

    return (
        <div className="animate-in fade-in duration-500">
            {/* Header */}
            <div className="mb-6 text-center">
                <h1 className="text-2xl font-bold text-white">{t.auth.welcomeBack}</h1>
                <p className="mt-1.5 text-sm text-gray-400">{t.auth.signInSubtitle}</p>
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
                        />
                    </div>
                    {errors.email && (
                        <p className="mt-1 text-xs text-red-400">{errors.email.message}</p>
                    )}
                </div>

                {/* Password */}
                <div>
                    <div className="flex items-center justify-between">
                        <Label htmlFor="password" className="text-gray-300">{t.auth.password}</Label>
                        <button
                            type="button"
                            onClick={handleForgotPassword}
                            disabled={checkingReset}
                            className="text-xs font-medium text-blue-400 hover:text-blue-300 transition-colors disabled:opacity-50"
                        >
                            {checkingReset ? 'Checking...' : t.auth.forgotPassword}
                        </button>
                    </div>
                    <div className="relative mt-1.5">
                        <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
                        <Input
                            id="password"
                            type={showPassword ? 'text' : 'password'}
                            placeholder="\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022"
                            className={`pl-10 pr-10 bg-white/[0.06] border-white/[0.08] text-white placeholder:text-gray-500 focus:border-blue-500/50 focus:ring-blue-500/20 transition-colors ${errors.password ? 'border-red-500/50' : ''}`}
                            {...register('password')}
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
                            {t.auth.signingIn}
                        </>
                    ) : (
                        <>
                            {t.auth.signIn}
                            <ArrowRight className="ml-2 h-4 w-4" />
                        </>
                    )}
                </Button>

                {/* Inline Language Switcher */}
                <div className="pt-2">
                    <LanguageSwitcher variant="segmented" />
                </div>
            </form>
        </div>
    )
}

export default function LoginPage() {
    return (
        <Suspense fallback={<div className="flex min-h-[200px] items-center justify-center text-gray-400">Loading...</div>}>
            <LoginFormContent />
        </Suspense>
    )
}
