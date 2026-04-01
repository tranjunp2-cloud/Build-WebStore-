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
    // Middleware already handles auth redirects (token check + MFA verification)
    // Do NOT redirect here — it causes redirect loops with middleware
    const typedUser = user as PlatformUser | null
    const userName = typedUser?.firstName || typedUser?.email?.split('@')[0] || 'User'
    const userEmail = typedUser?.email || ''
    const userInitial = userName.charAt(0).toUpperCase()

    return (
        <AppShell>
            <I18nProvider defaultLocale="en">
                <CMSLayoutClient userName={userName} userInitial={userInitial} userEmail={userEmail}>
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
