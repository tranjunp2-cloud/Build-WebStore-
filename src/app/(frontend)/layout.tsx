import { AppShell } from '@/components/AppShell'
import { I18nProvider } from '@/i18n'
import { Analytics } from '@vercel/analytics/next'
import { Toaster } from 'sonner'

// force-dynamic prevents ISR cache from serving stale marketing page
// when subdomain requests hit middleware rewrite → /sites/{slug}
// Without this, Next.js serves cached "/" for ALL hostnames including subdomains
export const dynamic = 'force-dynamic'

export default function FrontendLayout({ children }: { children: React.ReactNode }) {
    return (
        <AppShell>
            <I18nProvider defaultLocale="en">
                {children}
            </I18nProvider>
            {/* GH-2154: /templates calls toast() — without a Toaster here every message was silent. */}
            <Toaster position="top-right" theme="dark" richColors />
            <Analytics />
        </AppShell>
    )
}
