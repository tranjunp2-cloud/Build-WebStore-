'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { User, Mail, Lock, Eye, EyeOff, Loader2, ArrowRight, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useI18n } from '@/i18n'
import LanguageSwitcher from '@/components/LanguageSwitcher'

const registerSchema = z
    .object({
        firstName: z.string().min(2, 'First name must be at least 2 characters'),
        lastName: z.string().min(2, 'Last name must be at least 2 characters'),
        email: z.string().min(1, 'Email is required').email('Please enter a valid email'),
        password: z.string().min(8, 'Password must be at least 8 characters'),
        confirmPassword: z.string(),
    })
    .refine((d) => d.password === d.confirmPassword, {
        message: 'Passwords don\'t match',
        path: ['confirmPassword'],
    })

type RegisterForm = z.infer<typeof registerSchema>

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

function generateSlug(name: string): string {
    return name
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .substring(0, 30)
}

export default function RegisterPage() {
    const router = useRouter()
    const [showPassword, setShowPassword] = useState(false)
    const [showConfirm, setShowConfirm] = useState(false)
    const { t } = useI18n()

    const {
        register,
        handleSubmit,
        watch,
        formState: { errors, isSubmitting },
        setError: setFormError,
    } = useForm<RegisterForm>({
        resolver: zodResolver(registerSchema),
        defaultValues: { firstName: '', lastName: '', email: '', password: '', confirmPassword: '' },
    })

    const watchPassword = watch('password', '')
    const strength = useMemo(() => getPasswordStrength(watchPassword), [watchPassword])

    const onSubmit = async (data: RegisterForm) => {
        try {
            // Step 1: Register user (with timeout)
            const controller = new AbortController()
            const timeout = setTimeout(() => controller.abort(), 15000)

            let registerRes: Response
            try {
                registerRes = await fetch('/api/users', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        email: data.email,
                        password: data.password,
                        firstName: data.firstName,
                        lastName: data.lastName,
                    }),
                    signal: controller.signal,
                })
            } catch (err) {
                if (err instanceof DOMException && err.name === 'AbortError') {
                    setFormError('root', { message: 'Request timed out. Please try again.' })
                    toast.error('Request timed out. Please try again.')
                    return
                }
                throw err
            } finally {
                clearTimeout(timeout)
            }

            if (!registerRes.ok) {
                const errorData = await registerRes.json().catch(() => null)
                
                // Extract the most specific error message from Payload's ValidationError structure
                let message = errorData?.errors?.[0]?.message || 'Registration failed'
                const subError = errorData?.errors?.[0]?.data?.errors?.[0]
                if (subError?.message) {
                    message = subError.message
                }

                const isDuplicate = message.toLowerCase().includes('unique') || 
                                  message.toLowerCase().includes('exist') || 
                                  message.toLowerCase().includes('already registered')

                if (isDuplicate) {
                    setFormError('email', { message: 'This email is already registered' })
                    toast.error('This email is already registered')
                } else {
                    setFormError('root', { message })
                    toast.error(message)
                }
                return
            }

            // Step 2: Auto-login
            const loginRes = await fetch('/api/users/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: data.email, password: data.password }),
                credentials: 'include',
            })

            if (!loginRes.ok) {
                toast.success('Account created! Please sign in.')
                router.push('/login')
                return
            }

            // Step 3: Create tenant (non-blocking)
            const storeName = `${data.firstName}'s Store`
            fetch('/api/tenants', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: storeName,
                    slug: generateSlug(storeName),
                }),
                credentials: 'include',
            }).catch(() => {
                // Non-blocking — tenant can be created later
            })

            toast.success('Account created!', {
                description: "Let's build your first website!",
            })

            router.push('/onboarding')
            router.refresh()
        } catch {
            setFormError('root', { message: 'Connection error. Please try again.' })
            toast.error('Connection error. Please try again.')
        }
    }

    const inputClasses = (hasError: boolean) =>
        `pl-10 bg-white/[0.06] border-white/[0.08] text-white placeholder:text-gray-500 focus:border-blue-500/50 focus:ring-blue-500/20 transition-colors ${hasError ? 'border-red-500/50' : ''}`

    return (
        <div className="animate-in fade-in duration-500">
            {/* Header */}
            <div className="mb-6 text-center">
                <h1 className="text-2xl font-bold text-white">{t.auth.register.title}</h1>
                <p className="mt-1.5 text-sm text-gray-400">{t.auth.register.subtitle}</p>
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

                {/* Name row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                        <Label htmlFor="firstName" className="text-gray-300">{t.auth.register.firstName}</Label>
                        <div className="relative mt-1.5">
                            <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
                            <Input
                                id="firstName"
                                placeholder="John"
                                className={inputClasses(!!errors.firstName)}
                                {...register('firstName')}
                            />
                        </div>
                        {errors.firstName && (
                            <p className="mt-1 text-xs text-red-400">{errors.firstName.message}</p>
                        )}
                    </div>
                    <div>
                        <Label htmlFor="lastName" className="text-gray-300">{t.auth.register.lastName}</Label>
                        <div className="relative mt-1.5">
                            <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
                            <Input
                                id="lastName"
                                placeholder="Doe"
                                className={inputClasses(!!errors.lastName)}
                                {...register('lastName')}
                            />
                        </div>
                        {errors.lastName && (
                            <p className="mt-1 text-xs text-red-400">{errors.lastName.message}</p>
                        )}
                    </div>
                </div>

                {/* Email */}
                <div>
                    <Label htmlFor="email" className="text-gray-300">{t.auth.email}</Label>
                    <div className="relative mt-1.5">
                        <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
                        <Input
                            id="email"
                            type="email"
                            placeholder="you@example.com"
                            className={inputClasses(!!errors.email)}
                            {...register('email')}
                        />
                    </div>
                    {errors.email && (
                        <p className="mt-1 text-xs text-red-400">{errors.email.message}</p>
                    )}
                </div>

                {/* Password */}
                <div>
                    <Label htmlFor="password" className="text-gray-300">{t.auth.password}</Label>
                    <div className="relative mt-1.5">
                        <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
                        <Input
                            id="password"
                            type={showPassword ? 'text' : 'password'}
                            placeholder="Min. 8 characters"
                            className={`${inputClasses(!!errors.password)} pr-10`}
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

                    {/* Password strength bar */}
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

                {/* Confirm password */}
                <div>
                    <Label htmlFor="confirmPassword" className="text-gray-300">{t.auth.register.confirmPassword}</Label>
                    <div className="relative mt-1.5">
                        <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
                        <Input
                            id="confirmPassword"
                            type={showConfirm ? 'text' : 'password'}
                            placeholder="••••••••"
                            className={`${inputClasses(!!errors.confirmPassword)} pr-10`}
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

                {/* Password requirements */}
                <div className="space-y-1">
                    {[
                        { test: watchPassword.length >= 8, label: t.auth.register.reqLength },
                        { test: /[A-Z]/.test(watchPassword), label: t.auth.register.reqUpper },
                        { test: /[0-9]/.test(watchPassword), label: t.auth.register.reqNumber },
                    ].map(({ test, label }) => (
                        <div key={label} className="flex items-center gap-2 text-xs">
                            <Check className={`h-3 w-3 transition-colors ${test ? 'text-emerald-400' : 'text-gray-600'}`} />
                            <span className={test ? 'text-gray-300' : 'text-gray-500'}>{label}</span>
                        </div>
                    ))}
                </div>

                <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-medium h-11 shadow-lg shadow-blue-500/25 transition-all hover:shadow-blue-500/40 disabled:opacity-50"
                >
                    {isSubmitting ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            {t.auth.register.submitting}
                        </>
                    ) : (
                        <>
                            {t.auth.register.submit}
                            <ArrowRight className="ml-2 h-4 w-4" />
                        </>
                    )}
                </Button>

                {/* Inline Language Switcher */}
                <div className="pt-2">
                    <LanguageSwitcher variant="segmented" />
                </div>

                <p className="text-xs text-center text-gray-500">
                    {t.auth.register.termsPrefix}{' '}
                    <Link href="/terms" className="text-gray-400 underline hover:text-gray-300">{t.auth.register.terms}</Link>{' '}
                    {t.auth.register.and}{' '}
                    <Link href="/privacy" className="text-gray-400 underline hover:text-gray-300">{t.auth.register.privacy}</Link>
                </p>
            </form>

            {/* Divider */}
            <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-white/[0.06]" />
                </div>
                <div className="relative flex justify-center text-xs">
                    <span className="bg-[#101726] px-3 text-gray-400">{t.auth.or}</span>
                </div>
            </div>

            {/* Login link */}
            <p className="text-center text-sm text-gray-400">
                {t.auth.register.alreadyAccount}{' '}
                <Link
                    href="/login"
                    className="font-medium text-blue-400 hover:text-blue-300 transition-colors"
                >
                    {t.auth.register.signInLink}
                </Link>
            </p>
        </div>
    )
}
