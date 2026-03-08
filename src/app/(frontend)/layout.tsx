'use client'

import { I18nProvider } from '@/i18n'

export default function FrontendLayout({ children }: { children: React.ReactNode }) {
    return (
        <I18nProvider defaultLocale="en">
            {children}
        </I18nProvider>
    )
}
