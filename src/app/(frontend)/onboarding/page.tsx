import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@payload-config'
import { getCurrentUser } from '@/lib/auth'
import type { PlatformUser } from '@/types/user'
import OnboardingClient from './OnboardingClient'

export const dynamic = 'force-dynamic'

export default async function OnboardingPage() {
    const user = await getCurrentUser() as PlatformUser | null

    if (user) {
        let shouldRedirect = false
        try {
            const tenantIds = (user.tenants || [])
                .map(t => t.tenant && typeof t.tenant === 'object' ? t.tenant.id : t.tenant)
                .filter(Boolean) as string[]

            if (tenantIds.length > 0) {
                const payload = await getPayload({ config })
                const sites = await payload.find({
                    collection: 'sites',
                    where: { tenant: { in: tenantIds } },
                    limit: 1,
                })
                shouldRedirect = sites.docs.length > 0
            }
        } catch (error) {
            console.error('[Onboarding] Failed to check user sites:', error)
        }
        if (shouldRedirect) {
            redirect('/dashboard')
        }
    }

    return <OnboardingClient />
}
