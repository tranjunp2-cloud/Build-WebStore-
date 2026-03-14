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

const loginSchema = z.object({
    email: z.string().min(1, 'Email is required').email('Please enter a valid email'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
})

type LoginForm = z.infer<typeof loginSchema>

function LoginFormContent() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const redirectUrl = searchParams.get('returnUrl') || '/dashboard'
    const [showPassword, setShowPassword] = useState(false)

    const {
        register,
        handleSubmit,
        formState: { errors, isSubmitting },
        setError: setFormError,
        resetField,
    } = useForm<LoginForm>({
        resolver: zodResolver(loginSchema),
        defaultValues: { email: '', password: '' },
    })

    const onSubmit = async (data: LoginForm) => {
        try {
            const res = await fetch('/api/users/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
                credentials: 'include',
            })

            if (!res.ok) {
                const errorData = await res.json().catch(() => null)
                const message = errorData?.errors?.[0]?.message || 'Incorrect email or password'

                setFormError('root', { message })
                resetField('password')
                toast.error(message)
                return
            }

            toast.success('Welcome back! 🎉', {
                description: 'Redirecting to your dashboard...',
            })

            router.push(redirectUrl)
            router.refresh()
        } catch {
            setFormError('root', { message: 'Connection error. Please try again.' })
            toast.error('Connection error. Please try again.')
        }
    }

    return (
        <div className="animate-in fade-in duration-500">
            {/* Header */}
            <div className="mb-6 text-center">
                <h1 className="text-2xl font-bold text-white">Welcome back</h1>
                <p className="mt-1.5 text-sm text-gray-400">Sign in to continue building</p>
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
                    <Label htmlFor="email" className="text-gray-300">Email</Label>
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
                        <Label htmlFor="password" className="text-gray-300">Password</Label>
                        <Link
                            href="/forgot-password"
                            className="text-xs font-medium text-blue-400 hover:text-blue-300 transition-colors"
                        >
                            Forgot password?
                        </Link>
                    </div>
                    <div className="relative mt-1.5">
                        <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
                        <Input
                            id="password"
                            type={showPassword ? 'text' : 'password'}
                            placeholder="••••••••"
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
                            Signing in...
                        </>
                    ) : (
                        <>
                            Sign in
                            <ArrowRight className="ml-2 h-4 w-4" />
                        </>
                    )}
                </Button>
            </form>

            {/* Divider */}
            <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-white/[0.06]" />
                </div>
                <div className="relative flex justify-center text-xs">
                    <span className="bg-transparent px-3 text-gray-500">or</span>
                </div>
            </div>

            {/* Register link */}
            <p className="text-center text-sm text-gray-400">
                Don&apos;t have an account?{' '}
                <Link
                    href="/register"
                    className="font-medium text-blue-400 hover:text-blue-300 transition-colors"
                >
                    Create one free →
                </Link>
            </p>
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
