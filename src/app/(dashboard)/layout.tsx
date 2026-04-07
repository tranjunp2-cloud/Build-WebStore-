import { AppShell } from '@/components/AppShell'
import { I18nProvider } from '@/i18n'
import { getCurrentUser } from '@/lib/auth'
import type { PlatformUser } from '@/types/user'
import { CMSLayoutClient } from './_components/CMSLayoutClient'
import { AIDiscoveryWizard } from '@/components/dashboard/AIDiscoveryWizard'

export default async function DashboardLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const user = await getCurrentUser()
    // Extract tenantId from user directly — avoid 2nd getCurrentUser() call
    const typedUser = user as PlatformUser | null
    const tenants = typedUser?.tenants as Array<{ tenant: string | { id: string }, role?: string }> | undefined
    const firstTenant = tenants?.[0]?.tenant
    const tenantId = typeof firstTenant === 'string' ? firstTenant : firstTenant?.id || null
    const userName = typedUser?.firstName || typedUser?.email?.split('@')[0] || 'User'
    const userEmail = typedUser?.email || ''
    const userInitial = userName.charAt(0).toUpperCase()
    
    const currentTenantInfo = typedUser?.tenants?.find((t: { tenant: string | { id: string }, role?: string }) => (typeof t.tenant === 'object' ? t.tenant.id : t.tenant) === tenantId)
    const currentUserRole = currentTenantInfo?.role || 'viewer'

    return (
        <AppShell>
            <I18nProvider defaultLocale="en">
                <CMSLayoutClient userName={userName} userInitial={userInitial} userEmail={userEmail} currentUserRole={currentUserRole}>
                    {children}
                </CMSLayoutClient>
                {/* Only evaluate and render if the user hasn't seen the wizard yet */}
                {!typedUser?.has_seen_ai_wizard && (
                    <AIDiscoveryWizard userId={typedUser?.id} />
                )}
            </I18nProvider>
        </AppShell>
    )
}
