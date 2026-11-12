import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { isSuperAdmin } from '@/lib/admin/studio-roles'
import { MerchantAccessClient } from '@/components/support/merchant-access-client'
import type { PlatformUser } from '@/types/user'

export const metadata = { title: 'Merchant CMS access' }

export default async function MerchantAccessSupportPage() {
    // Super-admins use the Studio page (menu, breadcrumb, recent access); this page is for the `support` role.
    const user = (await getCurrentUser()) as unknown as PlatformUser | null
    if (user && isSuperAdmin(user.roles)) redirect('/studio/merchant-access')
    return <MerchantAccessClient />
}
