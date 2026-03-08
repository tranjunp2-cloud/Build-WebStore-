'use client'

import { AppShell } from '@/components/AppShell'
import { I18nProvider } from '@/i18n'

export default function FrontendLayout({ children }: { children: React.ReactNode }) {
    return (
        <AppShell>
            <I18nProvider defaultLocale="en">
                {children}
            </I18nProvider>
        </AppShell>
    )
}
