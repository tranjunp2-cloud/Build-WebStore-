'use client'

import { useState } from 'react'
import { useI18n } from '@/i18n'
import { isOwner } from '@/lib/profile/role-utils'
import type { PlatformUser } from '@/types/user'
import { ProfileBanner } from './profile-banner'
import { GeneralInfoTab } from './general-info-tab'
import { SecurityTab } from './security-tab'

type Props = {
    initialUser: PlatformUser
    ssoUrl: string
}

export function AccountSettingsClient({ initialUser, ssoUrl }: Props) {
    const { t } = useI18n()
    const [user, setUser] = useState<PlatformUser>(initialUser)
    const [activeTab, setActiveTab] = useState('general')

    const role = isOwner(user) ? 'owner' : 'staff'

    function onUserUpdate(partial: Partial<PlatformUser>) {
        setUser(prev => ({ ...prev, ...partial }))
    }

    function handleTabChange(value: string) {
        setActiveTab(value)
    }

    return (
        <div className="flex flex-col gap-8">
            <h1 className="text-[32px] font-black text-[#e1e2eb] tracking-[-0.9px] leading-10">
                {t.profile.accountSettings}
            </h1>

            <ProfileBanner user={user} role={role} onUserUpdate={onUserUpdate} />

            <div className="flex flex-col gap-8">
                {/* Tab navigation */}
                <div className="flex gap-8 border-b border-[rgba(65,71,84,0.1)]">
                    <button
                        type="button"
                        onClick={() => handleTabChange('general')}
                        className={[
                            'text-[14px] tracking-[1.4px] uppercase px-2 transition-colors',
                            activeTab === 'general'
                                ? 'font-black text-[#3b82f6] border-b-2 border-[#3b82f6] pb-[18px]'
                                : 'font-bold text-[#c1c6d7] border-b-2 border-transparent pb-[16px]',
                        ].join(' ')}
                    >
                        {t.profile.tabs.general}
                    </button>
                    <button
                        type="button"
                        onClick={() => handleTabChange('security')}
                        className={[
                            'text-[14px] tracking-[1.4px] uppercase px-2 transition-colors',
                            activeTab === 'security'
                                ? 'font-black text-[#3b82f6] border-b-2 border-[#3b82f6] pb-[18px]'
                                : 'font-bold text-[#c1c6d7] border-b-2 border-transparent pb-[16px]',
                        ].join(' ')}
                    >
                        {t.profile.tabs.security}
                    </button>
                </div>

                {activeTab === 'general' && (
                    <GeneralInfoTab
                        user={user}
                        role={role}
                        ssoUrl={ssoUrl}
                        onUserUpdate={onUserUpdate}
                    />
                )}
                {activeTab === 'security' && (
                    <SecurityTab
                        role={role}
                        ssoUrl={ssoUrl}
                    />
                )}
            </div>
        </div>
    )
}
