'use client'

/**
 * TeamAccountTabs — F18 phase-04 (#1138)
 *
 * Merged "Team & Account" page: Profile tab (all roles, default) + Staff tab (owner only).
 * Access is decided SERVER-SIDE in page.tsx — `staffProps` is only passed for owners, so a
 * non-owner never receives staff data and never mounts the Staff tab (no client-side gating).
 * Parent tabs use the shared underline style (blue accent) — synced with the Email Templates
 * buyer/seller tabs for consistency across the dashboard.
 */

import { User, Users } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { useI18n } from '@/i18n'
import type { PlatformUser } from '@/types/user'
import { AccountSettingsClient } from '../../profile/_components/account-settings-client'
import { StaffDirectoryClient, type StaffMember } from '../StaffDirectoryClient'

export type StaffTabProps = {
    tenantId: string
    initialStaff: StaffMember[]
    currentUserId: string
    currentUserRole: string
}

type Props = {
    initialUser: PlatformUser
    /** Present only when the viewer is the tenant owner (gated in page.tsx, never here). */
    staffProps?: StaffTabProps
}

const TRIGGER_CLASS =
    'dash-tab-trigger flex items-center gap-2 px-4 pb-2.5 rounded-none text-sm font-medium transition-colors -mb-px cursor-pointer ' +
    'text-slate-400 hover:text-white data-[state=active]:text-white'

export function TeamAccountTabs({ initialUser, staffProps }: Props) {
    const { t } = useI18n()

    // Non-owner: plain Profile page, no tab chrome at all (spec: hide the Staff trigger entirely)
    if (!staffProps) {
        return <AccountSettingsClient initialUser={initialUser} />
    }

    return (
        <Tabs defaultValue="profile" className="flex flex-col gap-6">
            {/* Page-level title above the tabs — synced with the Email Templates layout. */}
            <div>
                <h1 className="text-[24px] font-bold text-white mb-1">{t.profile.teamTabs.pageTitle}</h1>
                <p className="text-sm text-slate-400">{t.profile.teamTabs.pageSubtitle}</p>
            </div>
            <TabsList className="flex w-full justify-start h-auto gap-0 rounded-none border-0 bg-transparent p-0" style={{ borderBottom: '1px solid var(--dash-divider)' }}>
                <TabsTrigger value="profile" className={TRIGGER_CLASS}>
                    <User className="h-4 w-4" />
                    {t.profile.teamTabs.profile}
                </TabsTrigger>
                {/* e2e TC-F19.29 locates this tab by its EN name "Staff" — keep the en.json value stable */}
                <TabsTrigger value="staff" className={TRIGGER_CLASS}>
                    <Users className="h-4 w-4" />
                    {t.profile.teamTabs.staff}
                </TabsTrigger>
            </TabsList>
            <TabsContent value="profile" className="mt-0">
                {/* hideHeading: page title above already names this view — avoid a duplicate h1. */}
                <AccountSettingsClient initialUser={initialUser} hideHeading />
            </TabsContent>
            <TabsContent value="staff" className="mt-0">
                <StaffDirectoryClient {...staffProps} />
            </TabsContent>
        </Tabs>
    )
}
