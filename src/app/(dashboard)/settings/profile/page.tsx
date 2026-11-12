export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { SAFE_RELATION_POPULATE } from '@/lib/payload/safe-populate'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import type { PlatformUser } from '@/types/user'
import { AccountSettingsClient } from './_components/account-settings-client'

export default async function AccountSettingsPage() {
    const rawUser = await getCurrentUser()
    if (!rawUser) redirect('/login')

    const payload = await getPayload({ config: configPromise })
    const full = await payload.findByID({
        collection: 'users',
        id: rawUser.id,
        depth: 1,
        // Local API skips field read access: keep the populated tenant to display fields (TC-PERF-126).
        populate: SAFE_RELATION_POPULATE,
    })

    const u = full as unknown as Record<string, unknown>
    const initialUser: PlatformUser = {
        id: String(u.id ?? ''),
        email: String(u.email ?? ''),
        firstName: u.firstName as string | undefined,
        lastName: u.lastName as string | undefined,
        phone: u.phone as string | undefined,
        avatar: u.avatar as PlatformUser['avatar'],
        roles: u.roles as PlatformUser['roles'],
        tenants: u.tenants as PlatformUser['tenants'],
        lastLoginAt: u.lastLoginAt as string | undefined,
        createdAt: String(u.createdAt ?? ''),
        updatedAt: String(u.updatedAt ?? ''),
    }

    return <AccountSettingsClient initialUser={initialUser} />
}
