import type { Metadata } from 'next'
import { AppShell } from '@/components/AppShell'
import { I18nProvider } from '@/i18n'

// Override root app favicon.ico for all /sites/* routes.
// Per-site favicon is injected by each page's generateMetadata.
export const metadata: Metadata = {
    icons: { icon: '/favicon.ico' },
}

export default function SitesLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <AppShell>
            <I18nProvider defaultLocale="en">{children}</I18nProvider>
        </AppShell>
    )
}
