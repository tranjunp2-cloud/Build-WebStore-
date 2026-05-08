'use client'

import Image from 'next/image'
import { useState, useEffect } from 'react'
import { useI18n } from '@/i18n'
import type { PlatformUser } from '@/types/user'
import { AvatarUpload } from './avatar-upload'

type Props = {
    user: Pick<PlatformUser, 'id' | 'firstName' | 'lastName' | 'email' | 'phone' | 'avatar' | 'roles' | 'tenants'>
    role: 'owner' | 'staff'
    onUserUpdate: (partial: Partial<PlatformUser>) => void
}

function getDisplayName(firstName?: string, lastName?: string, email?: string): string {
    const name = [firstName, lastName].filter(Boolean).join(' ')
    return name || email || 'User'
}

function getAvatarUrl(avatar: PlatformUser['avatar']): string | null {
    if (!avatar) return null
    if (typeof avatar === 'string') return avatar
    return avatar.url ?? null
}

function getInitial(firstName?: string, email?: string): string {
    return (firstName?.[0] ?? email?.[0] ?? '?').toUpperCase()
}

export function ProfileBanner({ user, role, onUserUpdate }: Props) {
    const { t } = useI18n()
    const [imgFailed, setImgFailed] = useState(false)
    const rawUrl = getAvatarUrl(user.avatar)
    useEffect(() => { setImgFailed(false) }, [rawUrl])
    const avatarUrl = imgFailed ? null : rawUrl
    const displayName = getDisplayName(user.firstName, user.lastName, user.email)
    const initial = getInitial(user.firstName, user.email)

    return (
        <div className="bg-[#0b1120] border border-[#1f2937] rounded-[24px] p-[33px] shadow-[0px_25px_50px_-12px_rgba(0,0,0,0.25)] flex gap-8 items-center overflow-hidden w-full">
            {/* Avatar container */}
            <div className="relative flex-shrink-0">
                <div className="relative size-[128px] rounded-full bg-blue-600 overflow-hidden flex items-center justify-center shadow-[0_0_0_4px_rgba(59,130,246,0.3)]">
                    {avatarUrl ? (
                        <Image
                            src={avatarUrl}
                            alt={displayName}
                            fill
                            className="object-cover"
                            unoptimized
                            onError={() => setImgFailed(true)}
                        />
                    ) : (
                        <span className="text-[56px] font-semibold text-white select-none leading-none">{initial}</span>
                    )}
                </div>
                <AvatarUpload currentAvatar={user.avatar} onUserUpdate={onUserUpdate} />
            </div>

            {/* User info */}
            <div className="flex flex-col gap-1 items-start min-w-0">
                {/* Name + role badge */}
                <div className="flex gap-3 items-center flex-wrap">
                    <span className="text-[30px] font-bold text-[#e1e2eb] tracking-[-0.75px] leading-9">
                        {displayName}
                    </span>
                    <div className="bg-[rgba(68,221,193,0.1)] border border-[rgba(68,221,193,0.2)] px-[13px] py-[5px] rounded-[12px] flex-shrink-0">
                        <span className="text-[#44ddc1] text-[10px] font-black uppercase tracking-[1px]">
                            {role === 'owner' ? t.profile.banner.roleOwner : t.profile.banner.roleStaff}
                        </span>
                    </div>
                </div>

                {/* Email */}
                <span className="text-[16px] text-[#c1c6d7]">{user.email}</span>

                {/* Status row — and phone for owner */}
                <div className="flex gap-4 items-center pt-3 flex-wrap">
                    <div className="flex flex-col items-start">
                        <span className="text-[10px] text-[#c1c6d7] uppercase tracking-[-0.5px] leading-[15px]">
                            {t.profile.banner.status}
                        </span>
                        <div className="flex gap-1 items-center">
                            <div className="size-[8px] rounded-full bg-[#44ddc1] flex-shrink-0" />
                            <span className="text-[14px] font-bold text-[#44ddc1] leading-5">
                                {t.profile.banner.activeNow}
                            </span>
                        </div>
                    </div>

                    {role === 'owner' && user.phone && (
                        <>
                            <div className="w-px self-stretch bg-white/10 flex-shrink-0" />
                            <div className="flex flex-col items-start">
                                <span className="text-[10px] text-[#c1c6d7] uppercase tracking-[-0.5px] leading-[15px]">
                                    {t.profile.general.phone}
                                </span>
                                <span className="text-[14px] text-white leading-5">{user.phone}</span>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    )
}
