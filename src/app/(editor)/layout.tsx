import type { Viewport } from 'next'
import { cookies } from 'next/headers'
import { AppShell } from '@/components/AppShell'
import { Toaster } from '@/components/ui/sonner'
import { I18nProvider } from '@/i18n'
import { NotificationProvider } from '@/providers/NotificationProvider'
import { ThemeProvider } from '@/providers/theme-provider'
import { QueryProvider } from '@/providers/query-provider'
import { AppMascotProvider } from '@/components/mascot/app-mascot-provider'
import { MerchantAccessBanner } from '@/components/auth/merchant-access-banner'
import { getMerchantAccessBanner } from '@/lib/support/merchant-access-banner'

// Editor uses 100dvh — needs viewport-fit=cover so env(safe-area-inset-bottom)
// returns the actual iOS home indicator height instead of 0.
export const viewport: Viewport = {
    viewportFit: 'cover',
}

export default async function EditorLayout({
    children,
}: {
    children: React.ReactNode
}) {
    // Resolve theme from cookie (matches dashboard/auth) so the editor's
    // light/dark toggle stays in sync with the rest of the app on first load.
    const cookieStore = await cookies()
    const initialTheme = cookieStore.get('theme')?.value === 'light' ? 'light' : 'dark'

    const accessBanner = await getMerchantAccessBanner(cookieStore.get('payload-token')?.value)

    // Editor has its own full-screen layout (no dashboard sidebar)
    return (
        <AppShell>
            <ThemeProvider initialTheme={initialTheme}>
                <QueryProvider>
                    <I18nProvider defaultLocale="en">
                        <AppMascotProvider>
                            <NotificationProvider />
                            {children}
                            <Toaster position="bottom-right" />
                            {accessBanner && <MerchantAccessBanner {...accessBanner} />}
                        </AppMascotProvider>
                    </I18nProvider>
                </QueryProvider>
            </ThemeProvider>
        </AppShell>
    )
}
