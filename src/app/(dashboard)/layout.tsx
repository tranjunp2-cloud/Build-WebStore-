import { AppShell } from '@/components/AppShell'
import { I18nProvider } from '@/i18n'
import { getCurrentUser, isAuthUnavailableError } from '@/lib/auth'
import { LoadRetryState } from '@/components/dashboard/LoadRetryState'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import type { PlatformUser } from '@/types/user'
import type { SidebarBadgeKey } from '@/components/dashboard/Sidebar'
import { getCachedSidebarBadgeCounts } from '@/lib/dashboard/sidebar-badge-counts-cached'
import { getTenantSiteState } from '@/lib/dashboard/get-tenant-site-state'
import { extractTenantId } from '@/lib/auth/tenant-id'
import { getDashboardSites } from '@/lib/dashboard/dashboard-request-data'
import { CMSLayoutClient } from './_components/CMSLayoutClient'
import { AIDiscoveryWizard } from '@/components/dashboard/AIDiscoveryWizard'
import { NotificationProvider } from '@/providers/NotificationProvider'
import { ToastContainer } from '@/components/notifications/ToastContainer'
import { PushOptInPrompt } from '@/components/notifications/PushOptInPrompt'
import { TooltipProvider } from '@/components/ui/tooltip'
import { ThemeProvider } from '@/providers/theme-provider'
import { QueryProvider } from '@/providers/query-provider'
import { cookies } from 'next/headers'
import { DashboardAgentDockLoader } from '@/components/agent/DashboardAgentDockLoader'
import { isAiAgentEnabled } from '@/lib/ai-platform/config'
import { AppMascotProvider } from '@/components/mascot/app-mascot-provider'
import { AgentQueryInvalidator } from '@/lib/agent-changes/agent-query-invalidator'
import { MerchantAccessBanner } from '@/components/auth/merchant-access-banner'
import { getMerchantAccessBanner } from '@/lib/support/merchant-access-banner'

async function initialThemeFromCookie(): Promise<'light' | 'dark'> {
    const cookieStore = await cookies()
    return cookieStore.get('theme')?.value === 'light' ? 'light' : 'dark'
}

export default async function DashboardLayout({
    children,
}: {
    children: React.ReactNode
}) {
    let user: Awaited<ReturnType<typeof getCurrentUser>> = null
    try {
        user = await getCurrentUser()
    } catch (error) {
        // The session could not be checked (DB incident): a retry state, not a login redirect (TC-PERF-012).
        if (!isAuthUnavailableError(error)) throw error
        console.error('[layout] session check unavailable:', error)
        return (
            <AppShell>
                <ThemeProvider initialTheme={await initialThemeFromCookie()}>
                    <I18nProvider defaultLocale="en">
                        <LoadRetryState />
                    </I18nProvider>
                </ThemeProvider>
            </AppShell>
        )
    }
    // Use the same primary workspace as Orders APIs without a second session read.
    const typedUser = user as PlatformUser | null
    const tenantId = extractTenantId(typedUser)
    const userName = typedUser?.firstName || typedUser?.email?.split('@')[0] || 'User'
    const userEmail = typedUser?.email || ''
    const userInitial = userName.charAt(0).toUpperCase()

    // getCurrentUser populates the avatar (url only), so no second users read for it.
    const avatar = (user as { avatar?: unknown } | null)?.avatar as { url?: string } | string | null | undefined
    const userAvatarUrl: string | null = avatar && typeof avatar === 'object' && avatar.url ? avatar.url : null
    // Dynamic sidebar badge counts (F18 #1138) + site state in one payload session, in parallel.
    let badgeCounts: Partial<Record<SidebarBadgeKey, number>> = {}
    // Fail-open: default true so a transient DB error never hides a real site (GH-1392).
    let hasWebsite = true
    let storeName: string | undefined
    if (user) {
        try {
            const payload = await getPayload({ config: configPromise })
            // allSettled so one failure never blanks the others. Site-state piggybacks
            // on this session — no extra getPayload()/query session (GH-1392).
            const [countsRes, siteStateRes, tenantRes] = await Promise.allSettled([
                getCachedSidebarBadgeCounts(tenantId),
                // the page reads the same rows in this request (React cache, TC-PERF-055)
                getTenantSiteState(payload, tenantId, tenantId ? getDashboardSites(tenantId) : undefined),
                // Store name for the header feedback report context (name only → light query).
                tenantId != null
                    ? payload.findByID({ collection: 'tenants', id: tenantId, depth: 0, select: { name: true } }) as Promise<{ name?: string }>
                    : Promise.resolve(null),
            ])
            if (tenantRes.status === 'fulfilled' && tenantRes.value?.name) storeName = tenantRes.value.name
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

    const initialTheme = await initialThemeFromCookie()
    // A Prime team member signed in as this merchant: show the bar and skip the push opt-in (it would bind the browser to them).
    const accessBanner = await getMerchantAccessBanner((await cookies()).get('payload-token')?.value)

    return (
        <AppShell>
            <ThemeProvider initialTheme={initialTheme}>
                <I18nProvider defaultLocale="en">
                    <QueryProvider workspace={tenantId} user={typedUser?.id}>
                        {/* assistant changes → the cached lists they touch refetch (inside QueryProvider: scoped keys) */}
                        <AgentQueryInvalidator />
                        <AppMascotProvider>
                            <TooltipProvider delayDuration={300}>
                                <CMSLayoutClient userName={userName} userInitial={userInitial} userEmail={userEmail} userAvatarUrl={userAvatarUrl} currentUserRole={currentUserRole} userPermissions={userPermissions} isSuperAdmin={isSuperAdmin} isProduction={isProduction} badgeCounts={badgeCounts} hasWebsite={hasWebsite} storeName={storeName}>
                                    {children}
                                </CMSLayoutClient>
                                {typedUser && (
                                    <>
                                        <NotificationProvider />
                                        <ToastContainer />
                                        {!accessBanner && <PushOptInPrompt />}
                                        {/* AI copilot mascot — only where the AI platform is configured (and enabled on production). */}
                                        {isAiAgentEnabled() && <DashboardAgentDockLoader />}
                                    </>
                                )}
                                {accessBanner && <MerchantAccessBanner {...accessBanner} />}
                                {/* Only evaluate and render if the user hasn't seen the wizard yet */}
                                {!typedUser?.has_seen_ai_wizard && (
                                    <AIDiscoveryWizard userId={typedUser?.id} />
                                )}
                            </TooltipProvider>
                        </AppMascotProvider>
                    </QueryProvider>
                </I18nProvider>
            </ThemeProvider>
        </AppShell>
    )
}
