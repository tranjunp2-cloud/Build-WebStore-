'use client'

import Image from 'next/image'
import { useState, useEffect } from 'react'
import { useI18n } from '@/i18n'
import type { PlatformUser } from '@/types/user'
import { getDisplayName, getAvatarUrl, getInitial } from './profile-utils'
import { AvatarUpload } from './avatar-upload'

type Props = {
    user: Pick<PlatformUser, 'id' | 'firstName' | 'lastName' | 'email' | 'phone' | 'avatar' | 'roles' | 'tenants'>
    role: 'owner' | 'staff'
    onUserUpdate: (partial: Partial<PlatformUser>) => void
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
        <div className="bg-[hsl(var(--background))] border border-solid border-[hsl(var(--border))] rounded-[16px] p-4 sm:px-5 sm:py-4 flex flex-col sm:flex-row items-center gap-5 sm:gap-8 overflow-hidden w-full">
            {/* Avatar container */}
            <div className="relative flex-shrink-0">
                <div className="relative size-[72px] rounded-full overflow-hidden flex items-center justify-center shadow-[0_0_0_3px_hsl(var(--info)/0.3)]" style={{ backgroundColor: 'hsl(var(--info))' }}>
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
                        <span className="text-[30px] font-semibold !text-white select-none leading-none">{initial}</span>
                    )}
                </div>
                <AvatarUpload currentAvatar={user.avatar} onUserUpdate={onUserUpdate} />
            </div>

            {/* User info */}
            <div className="flex flex-col gap-1 items-center sm:items-start text-center sm:text-left min-w-0">
                {/* Name + role badge */}
                <div className="flex gap-3 items-center flex-wrap justify-center sm:justify-start">
                    <span className="text-[22px] font-bold text-[hsl(var(--foreground))] tracking-[-0.4px] leading-7">
                        {displayName}
                    </span>
                    <div className="bg-[hsl(var(--primary)/0.1)] border border-solid border-[hsl(var(--primary)/0.2)] px-[13px] py-[5px] rounded-[12px] flex-shrink-0">
                        <span className="text-[hsl(var(--primary))] text-[10px] font-black uppercase tracking-[1px]">
                            {role === 'owner' ? t.profile.banner.roleOwner : t.profile.banner.roleStaff}
                        </span>
                    </div>
                </div>

                {/* Email */}
                <span className="text-[16px] text-[hsl(var(--muted-foreground))]">{user.email}</span>
            </div>
        </div>
    )
}
