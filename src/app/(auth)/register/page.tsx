'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { User, Mail, Lock, Eye, EyeOff, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function RegisterPage() {
    const router = useRouter()

    const [firstName, setFirstName] = useState('')
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState('')

    const passwordStrength = getPasswordStrength(password)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')
        setIsLoading(true)

        try {
            // Step 1: Create user
            const userRes = await fetch('/api/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email,
                    password,
                    firstName,
                    lastName: '',
                }),
            })

            if (!userRes.ok) {
                const data = await userRes.json()
                const msg = data?.errors?.[0]?.message || 'Đăng ký thất bại'
                setError(msg.includes('duplicate') ? 'Email đã được sử dụng' : msg)
                return
            }

            // Step 2: Auto-login
            const loginRes = await fetch('/api/users/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
                credentials: 'include',
            })

            if (!loginRes.ok) {
                setError('Tạo tài khoản thành công nhưng đăng nhập thất bại. Vui lòng login thủ công.')
                router.push('/login')
                return
            }

            const loginData = await loginRes.json()
            const userId = loginData.user?.id

            // Step 3: Create tenant
            const tenantRes = await fetch('/api/tenants', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: `${firstName}'s Store`,
                    slug: generateSlug(firstName),
                }),
                credentials: 'include',
            })

            if (tenantRes.ok) {
                const tenantData = await tenantRes.json()
                const tenantId = tenantData.doc?.id

                // Step 4: Link user to tenant
                if (userId && tenantId) {
                    await fetch(`/api/users/${userId}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            tenants: [{ tenant: tenantId, role: 'owner' }],
                        }),
                        credentials: 'include',
                    })
                }
            }

            router.push('/onboarding')
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
                <h1 className="text-2xl font-bold text-white">Create your account</h1>
                <p className="mt-1 text-sm text-gray-400">Get started with PrimeWeb — free</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                    <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                        {error}
                    </div>
                )}

                {/* First Name */}
                <div>
                    <Label htmlFor="firstName">Your Name</Label>
                    <div className="relative mt-1.5">
                        <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
                        <Input
                            id="firstName"
                            type="text"
                            value={firstName}
                            onChange={(e) => setFirstName(e.target.value)}
                            required
                            placeholder="e.g. Nhan"
                            className="pl-10"
                        />
                    </div>
                </div>

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
                            minLength={6}
                            placeholder="Min 6 characters"
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
                    {/* Password Strength */}
                    {password.length > 0 && (
                        <div className="mt-2 flex items-center gap-2">
                            <div className="flex flex-1 gap-1">
                                {[1, 2, 3].map((level) => (
                                    <div
                                        key={level}
                                        className={`h-1 flex-1 rounded-full transition-colors ${passwordStrength >= level
                                                ? level === 1
                                                    ? 'bg-red-500'
                                                    : level === 2
                                                        ? 'bg-yellow-500'
                                                        : 'bg-green-500'
                                                : 'bg-gray-700'
                                            }`}
                                    />
                                ))}
                            </div>
                            <span className="text-[10px] text-gray-500">
                                {passwordStrength === 1 ? 'Weak' : passwordStrength === 2 ? 'Medium' : 'Strong'}
                            </span>
                        </div>
                    )}
                </div>

                {/* Submit */}
                <Button type="submit" disabled={isLoading} className="w-full">
                    {isLoading ? (
                        <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Creating account...
                        </>
                    ) : (
                        'Create Account'
                    )}
                </Button>
            </form>

            <p className="mt-6 text-center text-sm text-gray-400">
                Already have an account?{' '}
                <Link href="/login" className="font-medium text-blue-400 hover:text-blue-300">
                    Sign in
                </Link>
            </p>
        </>
    )
}

function getPasswordStrength(password: string): number {
    if (password.length === 0) return 0
    let score = 0
    if (password.length >= 6) score++
    if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++
    if (/[0-9]/.test(password) || /[^A-Za-z0-9]/.test(password)) score++
    return score
}

function generateSlug(name: string): string {
    return name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '')
        + '-' + Math.random().toString(36).slice(2, 6)
}
