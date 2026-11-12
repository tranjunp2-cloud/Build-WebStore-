import { cookies } from 'next/headers'
import { AppShell } from '@/components/AppShell'
import { I18nProvider } from '@/i18n'
import { MerchantAccessBanner } from '@/components/auth/merchant-access-banner'
import { getMerchantAccessBanner } from '@/lib/support/merchant-access-banner'

// Force dynamic rendering — builder pages require auth and import heavy
// dependencies (block registry → jsdom chain) that fail during static prerender
// in Docker standalone builds.
export const dynamic = 'force-dynamic'

export default async function BuilderLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const accessBanner = await getMerchantAccessBanner((await cookies()).get('payload-token')?.value)

    // Builder has its own full-screen layout (no dashboard sidebar)
    return (
        <I18nProvider defaultLocale="en">
            <AppShell>{children}</AppShell>
            {accessBanner && <MerchantAccessBanner {...accessBanner} />}
        </I18nProvider>
    )
}
