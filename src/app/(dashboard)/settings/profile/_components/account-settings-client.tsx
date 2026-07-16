'use client'

import { useState } from 'react'
import { useI18n } from '@/i18n'
import { isOwner } from '@/lib/profile/role-utils'
import { isStaging } from '@/lib/env'
import type { PlatformUser } from '@/types/user'
import { ProfileBanner } from './profile-banner'
import { GeneralInfoTab } from './general-info-tab'
import { SecurityTab } from './security-tab'
import { OwnerProfileView } from './owner-profile-view'
import { ResetAccountCard } from '@/app/(dashboard)/dashboard/settings/ResetAccountCard'

type Props = {
    initialUser: PlatformUser
    /** Hide the "Account Settings" h1 when embedded under a page-level title (e.g. Team & Account tabs). */
    hideHeading?: boolean
}


export function AccountSettingsClient({ initialUser, hideHeading = false }: Props) {
    const { t } = useI18n()
    const [user, setUser] = useState<PlatformUser>(initialUser)

    // SSO portal URL for the Owner SSO widget CTA — same route the old `SsoGuardBox` used.
    const ssoBase = (process.env.NEXT_PUBLIC_SSO_BASE_URL ?? '').replace(/\/$/, '')
    const ssoUrl = ssoBase ? `${ssoBase}/setting` : ''

    const role = isOwner(user) ? 'owner' : 'staff'

    function onUserUpdate(partial: Partial<PlatformUser>) {
        setUser(prev => ({ ...prev, ...partial }))
    }

    return (
        <div className="flex flex-col gap-8">
            {!hideHeading && (
                <h1 className="text-[32px] font-black text-[hsl(var(--foreground))] tracking-[-0.9px] leading-10">
                    {t.profile.accountSettings}
                </h1>
            )}

            {role === 'owner' ? (
                <OwnerProfileView user={user} ssoUrl={ssoUrl} />
            ) : (
                <>
                    <ProfileBanner user={user} role={role} onUserUpdate={onUserUpdate} />
                    <GeneralInfoTab user={user} onUserUpdate={onUserUpdate} />
                    <SecurityTab />
                </>
            )}

            {isStaging() && <ResetAccountCard />}
        </div>
    )
}
