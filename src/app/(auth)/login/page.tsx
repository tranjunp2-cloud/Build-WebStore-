'use client'

import { Suspense, useState, useEffect, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Mail, Lock, Eye, EyeOff, Loader2, ArrowRight, Globe } from 'lucide-react'
import { useI18n } from '@/i18n'
import LanguageSwitcher from '@/components/LanguageSwitcher'

function createLoginSchema() {
    return z.object({
        email: z.string().min(1, 'emailRequired').email('invalidEmail'),
        password: z.string().min(8, 'passwordMinLength'),
    })
}

type LoginForm = z.infer<ReturnType<typeof createLoginSchema>>

/** Minimal shape of a populated tenant returned by Payload login at depth=1. */
type TenantLite = { onboardingCompleted?: boolean } | null

/**
 * Determine post-login redirect based on user role (BR-02, AC-5).
 * - Owner without tenant/site → /onboarding
 * - Owner with tenant but onboardingCompleted=false → /onboarding
 * - Owner with tenant → /dashboard (or returnUrl)
 * - Staff → /admin (Payload CMS workspace)
 */
function getRedirectByRole(
    user: { roles?: string[]; tenants?: { tenant: TenantLite | string }[] },
    returnUrl: string,
): string {
    const roles = user.roles || []

    // Staff → always Payload admin
    if (roles.includes('editor') || roles.includes('viewer')) {
        return '/admin'
    }

    // Owner without any tenant or not onboarded → onboarding
    if (roles.includes('tenant-owner')) {
        if (!user.tenants || user.tenants.length === 0) {
            return '/onboarding'
        }
        
        // If Payload login auth returns populated tenant (depth=1), check onboarding status
        const firstTenant = user.tenants[0]?.tenant
        if (firstTenant && typeof firstTenant === 'object' && firstTenant.onboardingCompleted === false) {
            return '/onboarding'
        }
    }

    // Owner with tenant → returnUrl or dashboard
    return returnUrl
}

/* ─── Figma Design Token Constants ─── */
const INPUT_STYLE = {
    background: 'rgba(30, 41, 59, 0.6)',
    border: '1px solid rgba(59, 130, 246, 0.15)',
    boxShadow: '0px 8px 32px rgba(0,0,0,0.3), inset 0px 1px 0px rgba(255,255,255,0.05)',
} as const

const CHECKBOX_STYLE = {
    background: 'rgba(30, 41, 59, 0.4)',
    border: '1px solid rgba(59, 130, 246, 0.07)',
    boxShadow: '0px 1px 2px rgba(0,0,0,0.05)',
} as const

function LoginFormContent() {
    const router = useRouter()
    const searchParams = useSearchParams()
    let returnUrl = searchParams.get('returnUrl') || '/dashboard'
    if (!returnUrl.startsWith('/') || returnUrl.startsWith('//')) {
        returnUrl = '/dashboard'
    }
    const [showPassword, setShowPassword] = useState(false)
    const [checkingReset, setCheckingReset] = useState(false)
    const [rememberMe, setRememberMe] = useState(false)
    const { t } = useI18n()

    useEffect(() => {
        // Reset checking state if user navigates back via bfcache
        const handlePageShow = (event: PageTransitionEvent) => {
            if (event.persisted) {
                setCheckingReset(false)
            }
        }
        window.addEventListener('pageshow', handlePageShow)
        return () => window.removeEventListener('pageshow', handlePageShow)
    }, [])

    useEffect(() => {
        const errorMsg = searchParams.get('error')
        if (!errorMsg) return

        const authErrors = t.auth.errors as Record<string, string | undefined>

        if (errorMsg === 'serviceAccountUI') {
            toast.error(authErrors.serviceAccountUI)
        } else if (errorMsg === 'accountLocked') {
            toast.error(authErrors.accountLocked)
        } else if (errorMsg === 'missingCredentials') {
            toast.error(authErrors.missingCredentials)
        } else if (errorMsg === 'sessionExpired') {
            toast.error(t.auth.errors.sessionExpired)
        } else {
            toast.error(t.auth.errors.connection)
        }
    }, [searchParams, t])

    const {
        register,
        handleSubmit,
        formState: { errors, isSubmitting },
        setError: setFormError,
        resetField,
        getValues,
    } = useForm<LoginForm>({
        resolver: zodResolver(useMemo(() => createLoginSchema(), [])),
        defaultValues: { email: '', password: '' },
    })

    const rootErrorMsg = useMemo(() => {
        if (!errors.root) return null
        const msg = errors.root.message
        const authErrs = t.auth.errors as Record<string, string | undefined>

        switch (msg) {
            case 'serviceAccountUI': return authErrs.serviceAccountUI
            case 'timeout': return authErrs.timeout
            case 'incorrect': return t.auth.errors.incorrect
            case 'missingCredentials': return authErrs.missingCredentials
            case 'accountLocked': return authErrs.accountLocked
            case 'connection': return t.auth.errors.connection
            default: return msg
        }
    }, [errors.root, t])

    const getFieldError = (msg?: string) => {
        if (!msg) return null;
        const authErrs = t.auth.errors as Record<string, string | undefined>;
        return authErrs[msg] || (msg === 'passwordMinLength' ? t.auth.reset.passwordMin : msg);
    }

    // FR-07/FR-08: Smart forgot-password — Owner → SSO direct, Staff → internal
    const handleForgotPassword = async (e: React.MouseEvent) => {
        e.preventDefault()
        const email = getValues('email')?.trim()

        // No email typed → go to forgot-password form as usual
        if (!email) {
            window.location.href = '/forgot-password'
            return
        }

        setCheckingReset(true)
        try {
            const controller = new AbortController()
            const timeoutId = setTimeout(() => controller.abort(), 5000)
            const res = await fetch('/api/auth/check-reset-flow', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email }),
                signal: controller.signal,
            })
            clearTimeout(timeoutId)
            const data = await res.json()

            if (data.flow === 'sso' && data.redirectUrl) {
                // Owner → redirect straight to SSO portal
                window.location.href = data.redirectUrl
                // Return here without resetting state to keep loading active while browser redirects
                return
            }
        } catch (error) {
            console.error('check-reset-flow failed', error)
            // On error, fall through to internal page
        }

        // Staff or unknown → internal forgot-password page
        setCheckingReset(false)
        window.location.href = '/forgot-password'
    }

    const onSubmit = async (data: LoginForm) => {
        if (data.email.trim().toLowerCase() === 'sso-service@primeweb.app') {
            const authErrors = t.auth.errors as Record<string, string | undefined>
            const msg = authErrors.serviceAccountUI
            setFormError('root', { message: 'serviceAccountUI' })
            toast.error(msg)
            return
        }

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
                    credentials: 'omit', // Prevent browser from storing the partial payload-token HTTPOnly cookie
                    signal: controller.signal,
                })
            } catch (err) {
                if (err instanceof DOMException && err.name === 'AbortError') {
                    setFormError('root', { message: 'timeout' })
                    toast.error(t.auth.errors.timeout)
                    return
                }
                throw err
            } finally {
                clearTimeout(timeout)
            }

            if (!res.ok) {
                const errorData = await res.json().catch(() => null)
                let message = errorData?.errors?.[0]?.message || t.auth.errors.incorrect

                // Map known Payload CMS backend English errors to i18n
                const authErrors = t.auth.errors as Record<string, string | undefined>

                let errorCode = 'unknown'
                let localizedMsg = message

                if (message === 'Email and password are required' || message === 'Missing credentials') {
                    errorCode = 'missingCredentials'
                    localizedMsg = authErrors.missingCredentials || message
                } else if (message.includes('locked due to having too many failed login attempts')) {
                    errorCode = 'accountLocked'
                    localizedMsg = authErrors.accountLocked || message
                } else if (message === 'Email or password incorrect' || message === 'Login failed') {
                    errorCode = 'incorrect'
                    localizedMsg = t.auth.errors.incorrect
                }

                setFormError('root', { message: errorCode })
                resetField('password')
                toast.error(localizedMsg)
                return
            }

            // Parse user data
            const responseData = await res.json().catch(() => ({ user: null }))
            const user = responseData?.user
            const userEmail = user?.email || data.email.trim()

            // Get correct post-login destination (e.g. /onboarding for new users)
            const actualReturnUrl = user ? getRedirectByRole(user, returnUrl) : returnUrl

            // Trigger OTP send and check if email was actually delivered
            let otpEmailSent = true
            try {
                const otpRes = await fetch('/api/users/send-otp', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: userEmail }),
                })
                const otpData = await otpRes.json().catch(() => ({}))
                if (otpData.emailSent === false) {
                    otpEmailSent = false
                }
            } catch {
                otpEmailSent = false
            }

            // Clear previous OTP countdowns so verify-otp starts fresh
            sessionStorage.removeItem('otp_resend_end')
            sessionStorage.removeItem('otp_expiry_end')

            if (otpEmailSent) {
                toast.success(t.auth.otpSentTitle, {
                    description: t.auth.otpSentDesc,
                })
            } else {
                toast.warning(t.auth.otpEmailIssue, {
                    description: t.auth.otpEmailIssueDesc,
                    duration: 8000,
                })
            }

            // Redirect to OTP verification page
            const returnParam = actualReturnUrl !== '/dashboard' ? `&returnUrl=${encodeURIComponent(actualReturnUrl)}` : ''
            router.replace(`/verify-otp?email=${encodeURIComponent(userEmail)}${returnParam}`)
        } catch {
            setFormError('root', { message: 'connection' })
            toast.error(t.auth.errors.connection)
        }
    }

    return (
        <div className="animate-in fade-in duration-500 flex flex-col gap-6" style={{ gap: 24 }}>
            {/* ─── Header: "Welcome back" + subtitle ─── */}
            <div className="flex flex-col text-center" style={{ gap: 8 }}>
                <h1
                    className="text-2xl font-semibold text-[#F8FAFC]"
                    style={{ fontFamily: 'Inter, sans-serif', lineHeight: '32px', margin: 0 }}
                >
                    {t.auth.welcomeBack}
                </h1>
                <p
                    className="text-sm text-[#94A3B8]"
                    style={{ fontFamily: 'Inter, sans-serif', lineHeight: '20px', margin: 0 }}
                >
                    {t.auth.signInSubtitle}
                </p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col w-full">
                {/* Root error */}
                {errors.root && (
                    <div className="flex items-center gap-2 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                        <svg className="h-4 w-4 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
                        </svg>
                        {rootErrorMsg}
                    </div>
                )}

                {/* ─── Email Field ─── */}
                <div className="flex flex-col" style={{ gap: 3 }}>
                    <label
                        htmlFor="email"
                        className="text-sm font-medium text-[#94A3B8]"
                        style={{ lineHeight: '1.43' }}
                    >
                        {t.auth.email}
                    </label>
                    <div className="relative">
                        <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
                        <input
                            id="email"
                            type="email"
                            placeholder={t.auth.emailPlaceholder}
                            className={`
                                w-full h-11 rounded-2xl pl-10 pr-4 text-sm text-white
                                placeholder:text-[#94A3B8] outline-none
                                focus:ring-2 focus:ring-blue-500/30 transition-all
                                ${errors.email ? 'ring-2 ring-red-500/50' : ''}
                            `}
                            style={{
                                ...INPUT_STYLE,
                                fontFamily: 'Inter, sans-serif',
                                lineHeight: '1.21',
                            }}
                            {...register('email')}
                        />
                    </div>
                    {errors.email && (
                        <p className="text-xs text-red-400">{getFieldError(errors.email.message)}</p>
                    )}
                </div>

                {/* ─── Password Field ─── */}
                <div className="flex flex-col" style={{ gap: 3, marginTop: 24 }}>
                    <label
                        htmlFor="password"
                        className="text-sm font-medium text-[#94A3B8]"
                        style={{ lineHeight: '1.43' }}
                    >
                        {t.auth.password}
                    </label>
                    <div className="relative">
                        <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
                        <input
                            id="password"
                            type={showPassword ? 'text' : 'password'}
                            placeholder={t.auth.passwordPlaceholder}
                            className={`
                                w-full h-11 rounded-2xl pl-10 pr-10 text-sm text-white
                                placeholder:text-[#94A3B8] outline-none
                                focus:ring-2 focus:ring-blue-500/30 transition-all
                                ${errors.password ? 'ring-2 ring-red-500/50' : ''}
                            `}
                            style={{
                                ...INPUT_STYLE,
                                fontFamily: 'Inter, sans-serif',
                                lineHeight: '1.21',
                            }}
                            {...register('password')}
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-white transition-colors bg-transparent border-none p-0 cursor-pointer"
                            tabIndex={-1}
                        >
                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                    </div>
                    {errors.password && (
                        <p className="text-xs text-red-400">{getFieldError(errors.password.message)}</p>
                    )}
                </div>

                {/* ─── Remember me / Forgot password row ─── */}
                <div className="flex flex-wrap items-center justify-between gap-2" style={{ marginTop: 16 }}>
                    <label className="flex items-center gap-2 cursor-pointer select-none" style={{ background: 'transparent' }}>
                        <input
                            type="checkbox"
                            className="hidden"
                            checked={rememberMe}
                            onChange={(e) => setRememberMe(e.target.checked)}
                        />
                        <div
                            className="flex h-4 w-4 items-center justify-center rounded-[4px] transition-colors border-none p-0 cursor-pointer"
                            style={{
                                ...CHECKBOX_STYLE,
                                background: rememberMe ? '#2DD4BF' : 'rgba(30, 41, 59, 0.4)',
                            }}
                        >
                            {rememberMe && (
                                <svg className="h-3 w-3 text-[#0B1120]" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="2 6 5 9 10 3" />
                                </svg>
                            )}
                        </div>
                        <span className="text-sm font-medium text-[#94A3B8]" style={{ lineHeight: '1.43' }}>
                            {t.auth.rememberMe}
                        </span>
                    </label>
                    <button
                        type="button"
                        onClick={handleForgotPassword}
                        disabled={checkingReset}
                        className="text-sm font-medium text-[#3B82F6] hover:text-blue-400 transition-colors disabled:opacity-50 bg-transparent border-none p-0 cursor-pointer"
                        style={{ lineHeight: '1.43' }}
                    >
                        {checkingReset ? t.auth.checking : t.auth.forgotPassword}
                    </button>
                </div>

                {/* ─── Bottom Actions (Button & Lang) ─── */}
                <div className="flex flex-col w-full" style={{ gap: 16, marginTop: 40 }}>
                    {/* ─── Sign In Button — Figma devmode CSS exact ─── */}
                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="relative w-full transition-all disabled:opacity-50 hover:brightness-110 active:scale-[0.99]"
                        style={{
                            display: 'flex',
                            padding: '14px 0',
                            justifyContent: 'center',
                            alignItems: 'center',
                            gap: 16.313,
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
                        {isSubmitting ? (
                            <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                {t.auth.signingIn}
                            </>
                        ) : (
                            <>
                                {t.auth.signIn}
                                <ArrowRight className="h-4 w-4" />
                            </>
                        )}
                    </button>

                    {/* ─── Language Switcher — Figma: globe + segmented pill ─── */}
                    <LanguageSwitcher variant="segmented" />
                </div>
            </form>
        </div>
    )
}

export default function LoginPage() {
    const { t } = useI18n()
    return (
        <Suspense fallback={<div className="flex min-h-[200px] items-center justify-center text-[#94A3B8]">{t.auth.loading}</div>}>
            <LoginFormContent />
        </Suspense>
    )
}
