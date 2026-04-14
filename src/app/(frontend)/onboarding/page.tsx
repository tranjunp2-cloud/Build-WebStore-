import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@payload-config'
import { getCurrentUser } from '@/lib/auth'
import type { PlatformUser } from '@/types/user'
import { WelcomeScreenClient } from './_components/WelcomeScreenClient'

export const dynamic = 'force-dynamic'

export default async function OnboardingPage() {
    const user = await getCurrentUser() as PlatformUser | null

    if (!user) {
        redirect('/login')
    }

    // If user already completed the wizard, redirect to dashboard
    if (user.has_seen_ai_wizard) {
        redirect('/dashboard')
    }

    // Extract tenantIds from user directly — no extra getCurrentUser call needed
    const tenantIds = (user.tenants || [])
        .map((t: { tenant: string | { id: string } }) => typeof t.tenant === 'object' ? t.tenant?.id : t.tenant)
        .filter(Boolean) as string[]

    let shouldRedirect = false
    if (tenantIds.length > 0) {
        try {
            const payload = await getPayload({ config })
            const sites = await payload.find({
                collection: 'sites',
                where: { tenant: { in: tenantIds } },
                limit: 1,
            })
            shouldRedirect = sites.docs.length > 0
        } catch (error) {
            console.error('[Onboarding] Failed to check user sites:', error)
        }
    }

    if (shouldRedirect) {
        redirect('/dashboard')
    }

    return (
        <div className="flex min-h-[100dvh] w-full flex-col items-center justify-center bg-[#0B1120] m-0 p-0 relative">
            <WelcomeScreenClient />
        </div>
    )
}
