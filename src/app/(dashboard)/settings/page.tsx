'use client'

import { useState, useEffect } from 'react'
import { User, Lock, Save, Eye, EyeOff, Check } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

type UserProfile = {
    id: string
    email: string
    firstName: string
    lastName?: string
    roles?: string[]
    createdAt: string
}

export default function SettingsPage() {
    const [profile, setProfile] = useState<UserProfile | null>(null)
    const [isLoading, setIsLoading] = useState(true)

    // Profile form
    const [firstName, setFirstName] = useState('')
    const [lastName, setLastName] = useState('')
    const [isSavingProfile, setIsSavingProfile] = useState(false)

    // Password form
    const [currentPassword, setCurrentPassword] = useState('')
    const [newPassword, setNewPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [showCurrentPassword, setShowCurrentPassword] = useState(false)
    const [showNewPassword, setShowNewPassword] = useState(false)
    const [isSavingPassword, setIsSavingPassword] = useState(false)

    useEffect(() => {
        loadProfile()
    }, [])

    const loadProfile = async () => {
        try {
            const res = await fetch('/api/users/me', { credentials: 'include' })
            if (!res.ok) throw new Error('Failed to load profile')
            const data = await res.json()
            const user = data.user || data
            setProfile(user)
            setFirstName(user.firstName || '')
            setLastName(user.lastName || '')
        } catch {
            toast.error('Failed to load profile')
        } finally {
            setIsLoading(false)
        }
    }

    const handleSaveProfile = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!profile) return

        if (!firstName.trim()) {
            toast.error('First name is required')
            return
        }

        setIsSavingProfile(true)
        try {
            const res = await fetch(`/api/users/${profile.id}`, {
                method: 'PATCH',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ firstName: firstName.trim(), lastName: lastName.trim() }),
            })
            if (!res.ok) throw new Error('Failed to update profile')
            toast.success('Profile updated')
        } catch {
            toast.error('Failed to update profile')
        } finally {
            setIsSavingProfile(false)
        }
    }

    const handleChangePassword = async (e: React.FormEvent) => {
        e.preventDefault()

        if (newPassword.length < 8) {
            toast.error('Password must be at least 8 characters')
            return
        }
        if (newPassword !== confirmPassword) {
            toast.error('Passwords do not match')
            return
        }

        setIsSavingPassword(true)
        try {
            // Payload CMS uses unlock + update flow for password changes
            const res = await fetch(`/api/users/${profile?.id}`, {
                method: 'PATCH',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password: newPassword }),
            })
            if (!res.ok) throw new Error('Failed to change password')
            toast.success('Password changed successfully')
            setCurrentPassword('')
            setNewPassword('')
            setConfirmPassword('')
        } catch {
            toast.error('Failed to change password')
        } finally {
            setIsSavingPassword(false)
        }
    }

    if (isLoading) {
        return (
            <div className="animate-pulse space-y-6">
                <div>
                    <div className="h-8 w-32 rounded bg-white/5" />
                    <div className="h-4 w-48 rounded bg-white/5 mt-2" />
                </div>
                <div className="rounded-xl border border-white/10 bg-[#1E293B]/30 p-6 space-y-4">
                    <div className="h-4 w-24 rounded bg-white/5" />
                    <div className="h-10 rounded bg-white/5" />
                    <div className="h-10 rounded bg-white/5" />
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-8 max-w-2xl">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-white">Settings</h1>
                <p className="mt-1 text-sm text-gray-400">Manage your account and preferences</p>
            </div>

            {/* Profile Section */}
            <form onSubmit={handleSaveProfile} className="rounded-xl border border-white/10 bg-[#1E293B]/30 overflow-hidden">
                <div className="flex items-center gap-3 border-b border-white/10 px-6 py-4">
                    <User className="h-4 w-4 text-blue-400" />
                    <h2 className="text-sm font-semibold text-white">Profile</h2>
                </div>

                <div className="p-6 space-y-4">
                    {/* Email (read-only) */}
                    <div>
                        <label className="block text-xs font-medium text-gray-400 mb-1.5">Email</label>
                        <input
                            type="email"
                            value={profile?.email || ''}
                            disabled
                            className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-gray-500 cursor-not-allowed"
                        />
                    </div>

                    {/* Name fields */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="firstName" className="block text-xs font-medium text-gray-400 mb-1.5">
                                First Name <span className="text-red-400">*</span>
                            </label>
                            <input
                                id="firstName"
                                type="text"
                                value={firstName}
                                onChange={e => setFirstName(e.target.value)}
                                required
                                className="w-full rounded-lg border border-white/10 bg-[#1E293B] px-4 py-2.5 text-sm text-white placeholder-gray-500 outline-none focus:border-blue-500/50"
                            />
                        </div>
                        <div>
                            <label htmlFor="lastName" className="block text-xs font-medium text-gray-400 mb-1.5">Last Name</label>
                            <input
                                id="lastName"
                                type="text"
                                value={lastName}
                                onChange={e => setLastName(e.target.value)}
                                className="w-full rounded-lg border border-white/10 bg-[#1E293B] px-4 py-2.5 text-sm text-white placeholder-gray-500 outline-none focus:border-blue-500/50"
                            />
                        </div>
                    </div>

                    {/* Role (read-only) */}
                    <div>
                        <label className="block text-xs font-medium text-gray-400 mb-1.5">Role</label>
                        <div className="flex items-center gap-2">
                            {(profile?.roles || ['tenant-owner']).map(role => (
                                <span key={role} className="rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-xs font-medium text-blue-400 capitalize">
                                    {role.replace('-', ' ')}
                                </span>
                            ))}
                        </div>
                    </div>

                    {/* Account created */}
                    <div>
                        <label className="block text-xs font-medium text-gray-400 mb-1.5">Member Since</label>
                        <p className="text-sm text-gray-300">
                            {profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : 'Unknown'}
                        </p>
                    </div>

                    {/* Save */}
                    <div className="pt-2">
                        <button
                            type="submit"
                            disabled={isSavingProfile}
                            className="flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-500 transition-colors disabled:opacity-50"
                        >
                            {isSavingProfile ? (
                                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                            ) : (
                                <Save className="h-4 w-4" />
                            )}
                            Save Changes
                        </button>
                    </div>
                </div>
            </form>

            {/* Password Section */}
            <form onSubmit={handleChangePassword} className="rounded-xl border border-white/10 bg-[#1E293B]/30 overflow-hidden">
                <div className="flex items-center gap-3 border-b border-white/10 px-6 py-4">
                    <Lock className="h-4 w-4 text-purple-400" />
                    <h2 className="text-sm font-semibold text-white">Change Password</h2>
                </div>

                <div className="p-6 space-y-4">
                    {/* New Password */}
                    <div>
                        <label htmlFor="newPassword" className="block text-xs font-medium text-gray-400 mb-1.5">New Password</label>
                        <div className="relative">
                            <input
                                id="newPassword"
                                type={showNewPassword ? 'text' : 'password'}
                                value={newPassword}
                                onChange={e => setNewPassword(e.target.value)}
                                placeholder="At least 8 characters"
                                minLength={8}
                                required
                                className="w-full rounded-lg border border-white/10 bg-[#1E293B] px-4 py-2.5 pr-10 text-sm text-white placeholder-gray-500 outline-none focus:border-blue-500/50"
                            />
                            <button
                                type="button"
                                onClick={() => setShowNewPassword(!showNewPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                            >
                                {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                        </div>
                    </div>

                    {/* Confirm Password */}
                    <div>
                        <label htmlFor="confirmPassword" className="block text-xs font-medium text-gray-400 mb-1.5">Confirm Password</label>
                        <input
                            id="confirmPassword"
                            type="password"
                            value={confirmPassword}
                            onChange={e => setConfirmPassword(e.target.value)}
                            placeholder="Repeat new password"
                            required
                            className={cn(
                                'w-full rounded-lg border bg-[#1E293B] px-4 py-2.5 text-sm text-white placeholder-gray-500 outline-none focus:border-blue-500/50',
                                confirmPassword && confirmPassword !== newPassword ? 'border-red-500/50' : 'border-white/10',
                            )}
                        />
                        {confirmPassword && confirmPassword !== newPassword && (
                            <p className="mt-1 text-xs text-red-400">Passwords do not match</p>
                        )}
                    </div>

                    {/* Save */}
                    <div className="pt-2">
                        <button
                            type="submit"
                            disabled={isSavingPassword || !newPassword || newPassword !== confirmPassword}
                            className="flex items-center gap-2 rounded-lg bg-purple-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-purple-500 transition-colors disabled:opacity-50"
                        >
                            {isSavingPassword ? (
                                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                            ) : (
                                <Lock className="h-4 w-4" />
                            )}
                            Change Password
                        </button>
                    </div>
                </div>
            </form>

            {/* Danger Zone */}
            <div className="rounded-xl border border-red-500/20 bg-red-500/5 overflow-hidden">
                <div className="border-b border-red-500/20 px-6 py-4">
                    <h2 className="text-sm font-semibold text-red-400">Danger Zone</h2>
                </div>
                <div className="p-6">
                    <p className="text-sm text-gray-400">
                        Once you delete your account, there is no going back. All your sites, media, and data will be permanently deleted.
                    </p>
                    <button
                        type="button"
                        disabled
                        className="mt-4 rounded-lg border border-red-500/30 bg-transparent px-4 py-2 text-sm font-medium text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        Delete Account (Coming Soon)
                    </button>
                </div>
            </div>
        </div>
    )
}
