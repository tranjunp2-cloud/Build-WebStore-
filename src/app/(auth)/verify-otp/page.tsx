'use client'

import { Suspense, useState, useRef, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import LanguageSwitcher from '@/components/LanguageSwitcher'
import { useI18n } from '@/i18n'
import { Button } from '@/components/ui/button'

const OTP_LENGTH = 6
const RESEND_COOLDOWN_S = 60
const COUNTDOWN_INITIAL_S = 300 // 5 minutes

function VerifyOTPContent() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const email = searchParams.get('email') || ''
    const { t } = useI18n()

    const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(''))
    const [isVerifying, setIsVerifying] = useState(false)
    const [isResending, setIsResending] = useState(false)
    const [error, setError] = useState('')
    const [resendCooldown, setResendCooldown] = useState(RESEND_COOLDOWN_S)
    const [countdown, setCountdown] = useState(COUNTDOWN_INITIAL_S)
    const [isMounted, setIsMounted] = useState(false)
    const inputRefs = useRef<(HTMLInputElement | null)[]>([])

    // Hydrate timers from sessionStorage on mount (survives F5)
    useEffect(() => {
        setIsMounted(true)
        const resendEnd = sessionStorage.getItem('otp_resend_end')
        if (resendEnd) {
            const remaining = Math.ceil((Number(resendEnd) - Date.now()) / 1000)
            setResendCooldown(remaining > 0 ? remaining : 0)
        } else {
            sessionStorage.setItem('otp_resend_end', String(Date.now() + RESEND_COOLDOWN_S * 1000))
        }

        const expiryEnd = sessionStorage.getItem('otp_expiry_end')
        if (expiryEnd) {
            const remaining = Math.ceil((Number(expiryEnd) - Date.now()) / 1000)
            setCountdown(remaining > 0 ? remaining : 0)
        } else {
            sessionStorage.setItem('otp_expiry_end', String(Date.now() + COUNTDOWN_INITIAL_S * 1000))
        }
    }, [])

    // Countdown timer for OTP expiry
    useEffect(() => {
        if (countdown <= 0) return
        const timer = setInterval(() => setCountdown((c) => c - 1), 1000)
        return () => clearInterval(timer)
    }, [countdown])

    // Resend cooldown timer
    useEffect(() => {
        if (resendCooldown <= 0) return
        const timer = setInterval(() => setResendCooldown((c) => c - 1), 1000)
        return () => clearInterval(timer)
    }, [resendCooldown])

    // Auto-focus first input
    useEffect(() => {
        inputRefs.current[0]?.focus()
    }, [])

    const handleInputChange = (index: number, value: string) => {
        const digit = value.replace(/\D/g, '').slice(-1)
        const newOtp = [...otp]
        newOtp[index] = digit
        setOtp(newOtp)
        setError('')

        if (digit && index < OTP_LENGTH - 1) {
            inputRefs.current[index + 1]?.focus()
        }

        if (digit && index === OTP_LENGTH - 1) {
            const fullOtp = newOtp.join('')
            if (fullOtp.length === OTP_LENGTH) {
                // Allow the UI to render the last digit before freezing the inputs
                setTimeout(() => handleVerify(fullOtp), 50)
            }
        }
    }

    const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Backspace' && !otp[index] && index > 0) {
            inputRefs.current[index - 1]?.focus()
        }
    }

    const handlePaste = (e: React.ClipboardEvent) => {
        e.preventDefault()
        const clipData = e.clipboardData.getData('text/plain') || e.clipboardData.getData('text')
        const pasted = clipData.replace(/\D/g, '').slice(0, OTP_LENGTH)
        if (!pasted) return

        const newOtp = [...otp]
        // If they paste "123456" in the first box, it fills all boxes
        for (let i = 0; i < pasted.length; i++) {
            newOtp[i] = pasted[i]
        }
        setOtp(newOtp)
        setError('')

        const focusIdx = Math.min(pasted.length, OTP_LENGTH - 1)
        inputRefs.current[focusIdx]?.focus()

        if (pasted.length === OTP_LENGTH) {
            // Allow the UI to render the pasted digits before freezing the inputs
            setTimeout(() => handleVerify(pasted), 50)
        }
    }

    const handleVerify = useCallback(async (code: string) => {
        if (isVerifying) return
        setIsVerifying(true)
        setError('')

        try {
            const res = await fetch('/api/users/verify-otp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, otp: code }),
                credentials: 'include',
            })

            if (!res.ok) {
                const data = await res.json().catch(() => null)
                const rawMsg = data?.errors?.[0]?.message

                let message = t.auth.otp.verificationFailed
                if (rawMsg?.includes('Invalid')) message = t.auth.otp.invalidCode
                else if (rawMsg?.includes('expired')) message = t.auth.otp.codeExpired
                else if (rawMsg?.includes('Too many')) message = t.auth.otp.tooManyAttempts
                else if (rawMsg?.includes('No verification')) message = t.auth.otp.noCodeFound
                else if (rawMsg) message = rawMsg

                setError(message)
                toast.error(message)

                setOtp(Array(OTP_LENGTH).fill(''))
                inputRefs.current[0]?.focus()
                return
            }

            const data = await res.json()
            toast.success(t.auth.otp.successTitle, {
                description: t.auth.otp.successDesc,
            })

            if (data.token) {
                document.cookie = `payload-token=${data.token}; path=/; max-age=${60 * 60 * 24}; samesite=lax`
            }

            let returnUrl = searchParams.get('returnUrl') || '/dashboard'
            // Prevent Open Redirect (URL must start with / and not //)
            if (!returnUrl.startsWith('/') || returnUrl.startsWith('//')) {
                returnUrl = '/dashboard'
            }
            window.location.replace(returnUrl)
        } catch {
            setError(t.auth.otp.connectionError)
            toast.error(t.auth.otp.connectionError)
        } finally {
            setIsVerifying(false)
        }
    }, [email, isVerifying, router])

    const handleResend = async () => {
        if (resendCooldown > 0 || isResending) return
        setIsResending(true)

        try {
            const res = await fetch('/api/users/send-otp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email }),
            })

            if (!res.ok) {
                const data = await res.json().catch(() => null)
                const message = data?.errors?.[0]?.message || t.auth.otp.resendFailed
                toast.error(message)
                return
            }

            toast.success(t.auth.otp.newCodeSent, { description: t.auth.otp.newCodeDesc })
            sessionStorage.setItem('otp_resend_end', String(Date.now() + RESEND_COOLDOWN_S * 1000))
            sessionStorage.setItem('otp_expiry_end', String(Date.now() + COUNTDOWN_INITIAL_S * 1000))
            setResendCooldown(RESEND_COOLDOWN_S)
            setCountdown(COUNTDOWN_INITIAL_S)
            setOtp(Array(OTP_LENGTH).fill(''))
            setError('')
            inputRefs.current[0]?.focus()
        } catch {
            toast.error(t.auth.otp.resendFailedRetry)
        } finally {
            setIsResending(false)
        }
    }

    // No email → error state
    if (!email) {
        return (
            <div className="animate-in fade-in duration-500 w-full flex flex-col items-center text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10 ring-1 ring-red-500/20">
                    <svg className="h-8 w-8 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
                    </svg>
                </div>
                <h2 className="text-xl font-bold" style={{ fontFamily: 'Inter, sans-serif', color: 'var(--auth-text)' }}>{t.auth.otp.noEmail}</h2>
                <p className="mt-2 text-sm" style={{ color: 'var(--auth-text-muted)', fontFamily: 'Inter, sans-serif' }}>
                    {t.auth.otp.noEmailDesc}
                </p>
                <div className="mt-8 w-full flex flex-col items-center" style={{ gap: 24 }}>
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
                        <svg className="h-4 w-4 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5" /><path d="M12 19l-7-7 7-7" /></svg>
                        {t.auth.otp.backLogin}
                    </Link>
                    <div className="w-full">
                        <LanguageSwitcher variant="segmented" />
                    </div>
                </div>
            </div>
        )
    }

    const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`
    const isOtpComplete = otp.join('').length === OTP_LENGTH

    // Mask email: "yangtest@yopmail.com" → "y***@yopmail.com"
    const maskEmail = (e: string) => {
        const [local, domain] = e.split('@')
        if (!local || !domain) return e
        return `${local[0]}***@${domain}`
    }

    return (
        <div className="animate-in fade-in duration-500 w-full flex flex-col items-center">
            {/* Header: Icon + Title + Description */}
            {/* Figma: x:33, y:33, width:382 */}
            <div className="flex flex-col items-center w-full" style={{ gap: '12px', maxWidth: 382 }}>
                {/* Icon — exact SVG from Figma node 30726:135 */}
                <svg width="64" height="64" viewBox="12 2 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <defs>
                        <filter id="otp_icon_shadow" x="0" y="0" width="88" height="88" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
                            <feFlood floodOpacity="0" result="BackgroundImageFix" />
                            <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha" />
                            <feMorphology radius="4" operator="erode" in="SourceAlpha" result="effect1" />
                            <feOffset dy="4" />
                            <feGaussianBlur stdDeviation="3" />
                            <feComposite in2="hardAlpha" operator="out" />
                            <feColorMatrix type="matrix" values="0 0 0 0 0.231373 0 0 0 0 0.509804 0 0 0 0 0.964706 0 0 0 0.3 0" />
                            <feBlend mode="normal" in2="BackgroundImageFix" result="effect1" />
                            <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha" />
                            <feMorphology radius="3" operator="erode" in="SourceAlpha" result="effect2" />
                            <feOffset dy="10" />
                            <feGaussianBlur stdDeviation="7.5" />
                            <feComposite in2="hardAlpha" operator="out" />
                            <feColorMatrix type="matrix" values="0 0 0 0 0.231373 0 0 0 0 0.509804 0 0 0 0 0.964706 0 0 0 0.3 0" />
                            <feBlend mode="normal" in2="effect1" result="effect2" />
                            <feBlend mode="normal" in="SourceGraphic" in2="effect2" result="shape" />
                        </filter>
                        <linearGradient id="otp_icon_grad" x1="12" y1="2" x2="76" y2="66" gradientUnits="userSpaceOnUse">
                            <stop stopColor="#3B82F6" />
                            <stop offset="0.0714" stopColor="#3989F3" />
                            <stop offset="0.1429" stopColor="#378FEF" />
                            <stop offset="0.2143" stopColor="#3596EC" />
                            <stop offset="0.2857" stopColor="#339CE9" />
                            <stop offset="0.3571" stopColor="#32A2E5" />
                            <stop offset="0.4286" stopColor="#30A8E1" />
                            <stop offset="0.5" stopColor="#2FAEDE" />
                            <stop offset="0.5714" stopColor="#2EB3DA" />
                            <stop offset="0.6429" stopColor="#2DB9D6" />
                            <stop offset="0.7143" stopColor="#2DBFD1" />
                            <stop offset="0.7857" stopColor="#2CC4CD" />
                            <stop offset="0.8571" stopColor="#2CC9C9" />
                            <stop offset="0.9286" stopColor="#2DCFC4" />
                            <stop offset="1" stopColor="#2DD4BF" />
                        </linearGradient>
                    </defs>
                    <g filter="url(#otp_icon_shadow)">
                        <path d="M12 18C12 9.16344 19.1634 2 28 2H60C68.8366 2 76 9.16344 76 18V50C76 58.8366 68.8366 66 60 66H28C19.1634 66 12 58.8366 12 50V18Z" fill="url(#otp_icon_grad)" shapeRendering="crispEdges" />
                        <path d="M54.6666 35.3333C54.6666 41.9999 49.9999 45.3333 44.4533 47.2666C44.1628 47.365 43.8473 47.3603 43.5599 47.2533C37.9999 45.3333 33.3333 41.9999 33.3333 35.3333V25.9999C33.3333 25.6463 33.4737 25.3072 33.7238 25.0571C33.9738 24.8071 34.313 24.6666 34.6666 24.6666C37.3333 24.6666 40.6666 23.0666 42.9866 21.0399C43.2691 20.7986 43.6284 20.666 43.9999 20.666C44.3714 20.666 44.7308 20.7986 45.0133 21.0399C47.3466 23.0799 50.6666 24.6666 53.3333 24.6666C53.6869 24.6666 54.026 24.8071 54.2761 25.0571C54.5261 25.3072 54.6666 25.6463 54.6666 25.9999V35.3333Z" stroke="white" strokeWidth="2.66667" strokeLinecap="round" strokeLinejoin="round" />
                    </g>
                </svg>

                {/* Text block — gap: 8px */}
                <div className="flex flex-col items-center w-full" style={{ gap: '8px' }}>
                    {/* Title: "Two-Step Verification" — Inter 700, 24px, 1.333em, center */}
                    <h1
                        style={{
                            fontFamily: 'Inter, sans-serif',
                            fontWeight: 700,
                            fontSize: '24px',
                            lineHeight: '1.333em',
                            textAlign: 'center',
                            color: 'var(--auth-text)',
                            margin: 0,
                        }}
                    >
                        {t.auth.otp.title}
                    </h1>

                    {/* Description — Inter 400, 14px, 1.4286em, center */}
                    <p
                        style={{
                            fontFamily: 'Inter, sans-serif',
                            fontWeight: 400,
                            fontSize: '14px',
                            lineHeight: '1.4286em',
                            textAlign: 'center',
                            color: 'var(--auth-text-muted)',
                            margin: 0,
                        }}
                    >
                        {t.auth.otp.description}{' '}
                        <span style={{ fontWeight: 500, color: 'var(--auth-text)' }}>{maskEmail(email)}</span>
                    </p>
                </div>
            </div>

            {/* Error */}
            {error && (
                <div
                    className="flex items-center gap-2 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400 w-full"
                    style={{ marginTop: '16px', maxWidth: 382 }}
                >
                    <svg className="h-4 w-4 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
                    </svg>
                    {error}
                </div>
            )}

            {/* Form: OTP Inputs + Button — Figma: gap: 24px, width: 382 */}
            <div
                className="flex flex-col items-stretch w-full"
                style={{ gap: '24px', marginTop: '24px', maxWidth: 382 }}
            >
                {/* OTP Input Row — responsive: flex with clamp for gap/padding */}
                <div
                    className="flex justify-center w-full"
                    style={{ gap: 'clamp(6px, 2vw, 12px)', padding: '0 clamp(4px, 2vw, 17px)' }}
                    onPaste={handlePaste}
                >
                    {otp.map((digit, i) => (
                        <input
                            key={i}
                            ref={(el) => { inputRefs.current[i] = el }}
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            maxLength={1}
                            value={digit}
                            onChange={(e) => handleInputChange(i, e.target.value)}
                            onKeyDown={(e) => handleKeyDown(i, e)}
                            disabled={isVerifying}
                            className="outline-none transition-all duration-200 focus:ring-2 focus:ring-ring/30 disabled:opacity-50 disabled:cursor-not-allowed"
                            style={{
                                flex: '1 1 0',
                                maxWidth: '48px',
                                minWidth: '36px',
                                height: '56px',
                                borderRadius: '16px',
                                background: 'var(--auth-input-bg)',
                                border: digit
                                    ? '2px solid rgba(59, 130, 246, 0.5)'
                                    : error
                                        ? '2px solid rgba(239, 68, 68, 0.4)'
                                        : '2px solid var(--auth-input-border)',
                                textAlign: 'center',
                                fontSize: '20px',
                                fontWeight: 700,
                                fontFamily: 'Inter, sans-serif',
                                color: 'var(--auth-text)',
                                caretColor: '#3B82F6',
                            }}
                        />
                    ))}
                </div>

                {/* Confirm OTP Button — shared DS Button (default), full-width */}
                <Button
                    type="button"
                    onClick={() => handleVerify(otp.join(''))}
                    disabled={isVerifying || !isOtpComplete}
                    className="h-9 w-full"
                >
                    {isVerifying ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            {t.auth.otp.verifying}
                        </>
                    ) : (
                        t.auth.otp.confirmButton
                    )}
                </Button>
            </div>

            {/* Bottom: Resend text + Language Switcher */}
            <div className="flex flex-col w-full items-center" style={{ gap: '16px', marginTop: '24px' }}>
                {/* Resend code — Figma: Inter 400, 14px, 1.4286em, center */}
                <p
                    onClick={resendCooldown <= 0 && !isResending ? handleResend : undefined}
                    style={{
                        fontFamily: 'Inter, sans-serif',
                        fontWeight: 400,
                        fontSize: '14px',
                        lineHeight: '1.4286em',
                        textAlign: 'center',
                        color: 'var(--auth-text-subtle)',
                        margin: 0,
                        cursor: resendCooldown <= 0 && !isResending ? 'pointer' : 'default',
                    }}
                >
                    {isResending
                        ? t.auth.otp.resending
                        : isMounted && resendCooldown > 0
                            ? `${t.auth.otp.resendCode} (${t.auth.otp.after} ${resendCooldown}s)`
                            : t.auth.otp.resendCode
                    }
                </p>

                {/* Language Switcher */}
                <div className="w-full">
                    <LanguageSwitcher variant="segmented" />
                </div>
            </div>
        </div>
    )
}

export default function VerifyOTPPage() {
    return (
        <Suspense fallback={
            <div className="w-full min-h-[300px] flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        }>
            <VerifyOTPContent />
        </Suspense>
    )
}
