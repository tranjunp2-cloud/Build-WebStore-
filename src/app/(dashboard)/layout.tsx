import { AppShell } from '@/components/AppShell'
import { I18nProvider } from '@/i18n'
import { getCurrentUser } from '@/lib/auth'
import type { PlatformUser } from '@/types/user'
import { CMSLayoutClient } from './_components/CMSLayoutClient'

export default async function DashboardLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const user = await getCurrentUser()
    const typedUser = user as PlatformUser | null
    const userName = typedUser?.firstName || typedUser?.email?.split('@')[0] || 'User'
    const userInitial = userName.charAt(0).toUpperCase()

    return (
        <AppShell>
    <I18nProvider defaultLocale="en">
        <CMSLayoutClient userName={userName} userInitial={userInitial}>
            {children}
        </CMSLayoutClient>
        </I18nProvider>
    </AppShell>
    )
}

