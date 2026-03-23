'use client'

import { Suspense, useState, useRef, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { ShieldCheck, Loader2, RefreshCw, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'

const OTP_LENGTH = 6
const RESEND_COOLDOWN_S = 60
const COUNTDOWN_INITIAL_S = 300 // 5 minutes

function VerifyOTPContent() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const email = searchParams.get('email') || ''

    const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(''))
    const [isVerifying, setIsVerifying] = useState(false)
    const [isResending, setIsResending] = useState(false)
    const [error, setError] = useState('')
    const [resendCooldown, setResendCooldown] = useState(0)
    const [countdown, setCountdown] = useState(COUNTDOWN_INITIAL_S)
    const inputRefs = useRef<(HTMLInputElement | null)[]>([])

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
        // Only allow digits
        const digit = value.replace(/\D/g, '').slice(-1)
        const newOtp = [...otp]
        newOtp[index] = digit
        setOtp(newOtp)
        setError('')

        // Auto-advance to next input
        if (digit && index < OTP_LENGTH - 1) {
            inputRefs.current[index + 1]?.focus()
        }

        // Auto-submit when all 6 digits filled
        if (digit && index === OTP_LENGTH - 1) {
            const fullOtp = newOtp.join('')
            if (fullOtp.length === OTP_LENGTH) {
                handleVerify(fullOtp)
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
        const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH)
        if (!pasted) return

        const newOtp = [...otp]
        for (let i = 0; i < pasted.length; i++) {
            newOtp[i] = pasted[i]
        }
        setOtp(newOtp)
        setError('')

        // Focus last filled or next empty
        const focusIdx = Math.min(pasted.length, OTP_LENGTH - 1)
        inputRefs.current[focusIdx]?.focus()

        // Auto-submit if all digits pasted
        if (pasted.length === OTP_LENGTH) {
            handleVerify(pasted)
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
                const message = data?.errors?.[0]?.message || 'Verification failed'
                setError(message)
                toast.error(message)

                // Clear OTP fields on error
                setOtp(Array(OTP_LENGTH).fill(''))
                inputRefs.current[0]?.focus()
                return
            }

            const data = await res.json()
            toast.success('Verification successful!', {
                description: 'Redirecting to dashboard...',
            })

            // Set token cookie if returned
            if (data.token) {
                document.cookie = `payload-token=${data.token}; path=/; max-age=${60 * 60 * 24}; samesite=lax`
            }

            router.push('/dashboard')
            router.refresh()
        } catch {
            setError('Connection error. Please try again.')
            toast.error('Connection error. Please try again.')
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
                const message = data?.errors?.[0]?.message || 'Failed to resend code'
                toast.error(message)
                return
            }

            toast.success('New code sent!', { description: 'Check your email inbox.' })
            setResendCooldown(RESEND_COOLDOWN_S)
            setCountdown(COUNTDOWN_INITIAL_S)
            setOtp(Array(OTP_LENGTH).fill(''))
            setError('')
            inputRefs.current[0]?.focus()
        } catch {
            toast.error('Failed to resend. Please try again.')
        } finally {
            setIsResending(false)
        }
    }

    // No email in params → redirect to login
    if (!email) {
        return (
            <div className="animate-in fade-in duration-500 text-center">
                <ShieldCheck className="mx-auto h-12 w-12 text-gray-500 mb-4" />
                <h1 className="text-xl font-bold text-white mb-2">No email provided</h1>
                <p className="text-sm text-gray-400 mb-6">Please log in first to verify your identity.</p>
                <Link href="/login">
                    <Button className="bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back to Login
                    </Button>
                </Link>
            </div>
        )
    }

    const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`

    return (
        <div className="animate-in fade-in duration-500">
            {/* Header */}
            <div className="mb-6 text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 ring-1 ring-blue-500/30">
                    <ShieldCheck className="h-7 w-7 text-blue-400" />
                </div>
                <h1 className="text-2xl font-bold text-white">Verify your identity</h1>
                <p className="mt-1.5 text-sm text-gray-400">
                    We sent a 6-digit code to{' '}
                    <span className="font-medium text-gray-300">{email}</span>
                </p>
            </div>

            {/* Error */}
            {error && (
                <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                    <svg className="h-4 w-4 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
                    </svg>
                    {error}
                </div>
            )}

            {/* OTP Input */}
            <div className="flex justify-center gap-3 mb-6" onPaste={handlePaste}>
                {otp.map((digit, i) => (
                    <input
                        key={i}
                        ref={(el) => { inputRefs.current[i] = el }}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        value={digit}
                        onChange={(e) => handleInputChange(i, e.target.value)}
                        onKeyDown={(e) => handleKeyDown(i, e)}
                        disabled={isVerifying}
                        className={`w-12 h-14 text-center text-xl font-bold rounded-xl border transition-all duration-200 outline-none
                            ${digit
                                ? 'border-blue-500/50 bg-blue-500/10 text-white shadow-sm shadow-blue-500/10'
                                : 'border-white/[0.08] bg-white/[0.04] text-white'
                            }
                            ${error ? 'border-red-500/40 bg-red-500/5' : ''}
                            focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20
                            disabled:opacity-50 disabled:cursor-not-allowed`}
                    />
                ))}
            </div>

            {/* Countdown */}
            <div className="text-center mb-6">
                {countdown > 0 ? (
                    <p className="text-xs text-gray-500">
                        Code expires in <span className="font-medium text-gray-400">{formatTime(countdown)}</span>
                    </p>
                ) : (
                    <p className="text-xs text-amber-400">Code has expired. Please request a new one.</p>
                )}
            </div>

            {/* Verify Button */}
            <Button
                onClick={() => handleVerify(otp.join(''))}
                disabled={isVerifying || otp.join('').length < OTP_LENGTH}
                className="w-full bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-medium h-11 shadow-lg shadow-blue-500/25 transition-all hover:shadow-blue-500/40 disabled:opacity-50 mb-4"
            >
                {isVerifying ? (
                    <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Verifying...
                    </>
                ) : (
                    <>
                        <ShieldCheck className="mr-2 h-4 w-4" />
                        Verify Code
                    </>
                )}
            </Button>

            {/* Resend */}
            <div className="text-center">
                <button
                    onClick={handleResend}
                    disabled={resendCooldown > 0 || isResending}
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-400 hover:text-blue-300 transition-colors disabled:text-gray-600 disabled:cursor-not-allowed"
                >
                    {isResending ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                        <RefreshCw className="h-3.5 w-3.5" />
                    )}
                    {resendCooldown > 0
                        ? `Resend code (${resendCooldown}s)`
                        : 'Resend code'
                    }
                </button>
            </div>

            {/* Back to login */}
            <div className="mt-6 text-center">
                <Link
                    href="/login"
                    className="text-xs text-gray-500 hover:text-gray-400 transition-colors"
                >
                    ← Back to login
                </Link>
            </div>
        </div>
    )
}

export default function VerifyOTPPage() {
    return (
        <Suspense fallback={<div className="flex min-h-[200px] items-center justify-center text-gray-400">Loading...</div>}>
            <VerifyOTPContent />
        </Suspense>
    )
}
