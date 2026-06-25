import { AppShell } from '@/components/AppShell'
import { I18nProvider } from '@/i18n'
import { getCurrentUser } from '@/lib/auth'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import type { PlatformUser } from '@/types/user'
import type { SidebarBadgeKey } from '@/components/dashboard/Sidebar'
import { getCachedSidebarBadgeCounts } from '@/lib/dashboard/sidebar-badge-counts-cached'
import { getTenantSiteState } from '@/lib/dashboard/get-tenant-site-state'
import { CMSLayoutClient } from './_components/CMSLayoutClient'
import { AIDiscoveryWizard } from '@/components/dashboard/AIDiscoveryWizard'
import { NotificationProvider } from '@/providers/NotificationProvider'
import { ToastContainer } from '@/components/notifications/ToastContainer'
import { PushOptInPrompt } from '@/components/notifications/PushOptInPrompt'
import { TooltipProvider } from '@/components/ui/tooltip'
import { ThemeProvider } from '@/providers/theme-provider'
import { cookies } from 'next/headers'

export default async function DashboardLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const user = await getCurrentUser()
    // Extract tenantId from user directly — avoid 2nd getCurrentUser() call
    const typedUser = user as PlatformUser | null
    const tenants = typedUser?.tenants as Array<{ tenant: string | number | { id: string | number }, role?: string }> | undefined
    const firstTenant = tenants?.[0]?.tenant
    // Normalize to string: handles depth=0 (number ID), depth=1 (object), or string
    const tenantId = typeof firstTenant === 'string' ? firstTenant
        : typeof firstTenant === 'number' ? String(firstTenant)
        : firstTenant?.id != null ? String(firstTenant.id)
        : null
    const userName = typedUser?.firstName || typedUser?.email?.split('@')[0] || 'User'
    const userEmail = typedUser?.email || ''
    const userInitial = userName.charAt(0).toUpperCase()

    // Fetch avatar URL (depth=1 to expand media relationship) + dynamic sidebar badge
    // counts (F18 #1138) in one payload session, in parallel.
    let userAvatarUrl: string | null = null
    let badgeCounts: Partial<Record<SidebarBadgeKey, number>> = {}
    // Fail-open: default true so a transient DB error never hides a real site (GH-1392).
    let hasWebsite = true
    if (user) {
        try {
            const payload = await getPayload({ config: configPromise })
            // allSettled so one failure never blanks the others. Site-state piggybacks
            // on this session — no extra getPayload()/query session (GH-1392).
            const [avatarRes, countsRes, siteStateRes] = await Promise.allSettled([
                payload.findByID({ collection: 'users', id: user.id, depth: 1 }) as Promise<Record<string, unknown>>,
                getCachedSidebarBadgeCounts(tenantId),
                getTenantSiteState(payload, tenantId),
            ])
            if (avatarRes.status === 'fulfilled') {
                const av = avatarRes.value?.avatar as { url?: string } | null | undefined
                if (av && typeof av === 'object' && av.url) userAvatarUrl = av.url
            }
            if (countsRes.status === 'fulfilled') badgeCounts = countsRes.value
            // Only override the fail-open default on a successful read.
            if (siteStateRes.status === 'fulfilled') hasWebsite = siteStateRes.value.hasUsableSite
        } catch (err) { console.warn('[layout] payload session failed:', err) }
    }

    const currentTenantInfo = typedUser?.tenants?.find((t: { tenant: string | number | { id: string | number }, role?: string }) => {
        const tId = typeof t.tenant === 'object' && t.tenant !== null ? String(t.tenant.id) : String(t.tenant)
        return tId === tenantId
    })
    const currentUserRole = currentTenantInfo?.role || 'viewer'
    const userPermissions = (currentTenantInfo as { permissions?: string[] } | undefined)?.permissions ?? []
    const isSuperAdmin = Boolean(typedUser?.roles?.includes('super-admin'))

    // Env gate for dev-only nav (Templates Health, #1138 P03): hidden ONLY on the Production
    // deploy. VERCEL_ENV distinguishes production from staging/preview (both are NODE_ENV
    // 'production' builds); local fallback to NODE_ENV. Resolved server-side — no NEXT_PUBLIC var.
    const isProduction = (process.env.VERCEL_ENV ?? process.env.NODE_ENV) === 'production'

    const cookieStore = await cookies()
    const themeCookie = cookieStore.get('theme')?.value
    const initialTheme = themeCookie === 'light' ? 'light' : 'dark'

    return (
        <AppShell>
            <ThemeProvider initialTheme={initialTheme}>
                <I18nProvider defaultLocale="en">
                    <TooltipProvider delayDuration={300}>
                        <CMSLayoutClient userName={userName} userInitial={userInitial} userEmail={userEmail} userAvatarUrl={userAvatarUrl} currentUserRole={currentUserRole} userPermissions={userPermissions} isSuperAdmin={isSuperAdmin} isProduction={isProduction} badgeCounts={badgeCounts} hasWebsite={hasWebsite}>
                            {children}
                        </CMSLayoutClient>
                        {typedUser && (
                            <>
                                <NotificationProvider />
                                <ToastContainer />
                                <PushOptInPrompt />
                            </>
                        )}
                        {/* Only evaluate and render if the user hasn't seen the wizard yet */}
                        {!typedUser?.has_seen_ai_wizard && (
                            <AIDiscoveryWizard userId={typedUser?.id} />
                        )}
                    </TooltipProvider>
                </I18nProvider>
            </ThemeProvider>
        </AppShell>
    )
}
