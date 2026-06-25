'use client'

import { useState } from 'react'
import { useI18n } from '@/i18n'
import { isOwner } from '@/lib/profile/role-utils'
import { isStaging } from '@/lib/env'
import type { PlatformUser } from '@/types/user'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { ProfileBanner } from './profile-banner'
import { GeneralInfoTab } from './general-info-tab'
import { SecurityTab } from './security-tab'
import { ResetAccountCard } from '@/app/(dashboard)/dashboard/settings/ResetAccountCard'

type Props = {
    initialUser: PlatformUser
    /** Hide the "Account Settings" h1 when embedded under a page-level title (e.g. Team & Account tabs). */
    hideHeading?: boolean
}

const TRIGGER_CLASS =
    'dash-tab-trigger flex items-center gap-2 px-4 pb-2.5 rounded-none text-sm font-medium transition-colors -mb-px cursor-pointer ' +
    'text-[var(--dash-text-muted)] hover:text-[var(--dash-text)] data-[state=active]:text-[var(--dash-text)]'

export function AccountSettingsClient({ initialUser, hideHeading = false }: Props) {
    const { t } = useI18n()
    const [user, setUser] = useState<PlatformUser>(initialUser)

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

            <ProfileBanner user={user} role={role} onUserUpdate={onUserUpdate} />

            <Tabs defaultValue="general" className="flex flex-col gap-8">
                <TabsList className="flex w-full justify-start h-auto gap-0 rounded-none border-0 bg-transparent p-0" style={{ borderBottom: '1px solid var(--dash-divider)' }}>
                    <TabsTrigger value="general" className={TRIGGER_CLASS}>
                        {t.profile.tabs.general}
                    </TabsTrigger>
                    <TabsTrigger value="security" className={TRIGGER_CLASS}>
                        {t.profile.tabs.security}
                    </TabsTrigger>
                </TabsList>
                <TabsContent value="general" className="mt-0">
                    <GeneralInfoTab
                        user={user}
                        role={role}
                        ssoUrl={ssoUrl}
                        onUserUpdate={onUserUpdate}
                    />
                </TabsContent>
                <TabsContent value="security" className="mt-0">
                    <SecurityTab
                        role={role}
                        ssoUrl={ssoUrl}
                    />
                </TabsContent>
            </Tabs>

            {isStaging() && <ResetAccountCard />}
        </div>
    )
}
