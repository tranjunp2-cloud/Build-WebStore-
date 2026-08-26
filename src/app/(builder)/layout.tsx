import { AppShell } from '@/components/AppShell'
import { I18nProvider } from '@/i18n'

// Force dynamic rendering — builder pages require auth and import heavy
// dependencies (block registry → jsdom chain) that fail during static prerender
// in Docker standalone builds.
export const dynamic = 'force-dynamic'

export default function BuilderLayout({
    children,
}: {
    children: React.ReactNode
}) {
    // Builder has its own full-screen layout (no dashboard sidebar)
    return (
        <I18nProvider defaultLocale="en">
            <AppShell>{children}</AppShell>
        </I18nProvider>
    )
}
