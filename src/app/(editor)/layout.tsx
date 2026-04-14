import { AppShell } from '@/components/AppShell'
import { Toaster } from '@/components/ui/sonner'
import { I18nProvider } from '@/i18n'
import { NotificationProvider } from '@/providers/NotificationProvider'

export default function EditorLayout({
    children,
}: {
    children: React.ReactNode
}) {
    // Editor has its own full-screen layout (no dashboard sidebar)
    return (
        <AppShell>
            <I18nProvider defaultLocale="en">
                <NotificationProvider />
                {children}
                <Toaster position="bottom-right" />
            </I18nProvider>
        </AppShell>
    )
}
