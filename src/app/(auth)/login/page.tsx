'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Mail, Lock, Eye, EyeOff, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function LoginPage() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const redirectUrl = searchParams.get('redirect') || '/dashboard'

    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState('')

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')
        setIsLoading(true)

        try {
            const res = await fetch('/api/users/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
                credentials: 'include',
            })

            if (!res.ok) {
                setError('Email hoặc mật khẩu không đúng')
                setPassword('')
                return
            }

            router.push(redirectUrl)
            router.refresh()
        } catch {
            setError('Đã xảy ra lỗi. Vui lòng thử lại.')
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <>
            <div className="mb-6 text-center">
                <h1 className="text-2xl font-bold text-white">Welcome back</h1>
                <p className="mt-1 text-sm text-gray-400">Sign in to your account</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                    <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                        {error}
                    </div>
                )}

                {/* Email */}
                <div>
                    <Label htmlFor="email">Email</Label>
                    <div className="relative mt-1.5">
                        <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
                        <Input
                            id="email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            placeholder="you@example.com"
                            className="pl-10"
                        />
                    </div>
                </div>

                {/* Password */}
                <div>
                    <Label htmlFor="password">Password</Label>
                    <div className="relative mt-1.5">
                        <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
                        <Input
                            id="password"
                            type={showPassword ? 'text' : 'password'}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            placeholder="••••••••"
                            className="pl-10 pr-10"
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                        >
                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                    </div>
                </div>

                {/* Submit */}
                <Button type="submit" disabled={isLoading} className="w-full">
                    {isLoading ? (
                        <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Signing in...
                        </>
                    ) : (
                        'Sign in'
                    )}
                </Button>
            </form>

            <p className="mt-6 text-center text-sm text-gray-400">
                Don&apos;t have an account?{' '}
                <Link href="/register" className="font-medium text-blue-400 hover:text-blue-300">
                    Create one
                </Link>
            </p>
        </>
    )
}
