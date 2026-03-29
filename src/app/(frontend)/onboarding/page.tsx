import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@payload-config'
import { getCurrentUser } from '@/lib/auth'
import OnboardingClient from './OnboardingClient'

export const dynamic = 'force-dynamic'

export default async function OnboardingPage() {
    const user = await getCurrentUser()

    if (user) {
        let shouldRedirect = false
        try {
            const rawTenant = (user as any).tenants?.[0]?.tenant
            const tenantId = rawTenant && typeof rawTenant === 'object' ? rawTenant.id : rawTenant

            if (tenantId) {
                const payload = await getPayload({ config })
                const sites = await payload.find({
                    collection: 'sites',
                    where: { tenant: { equals: tenantId } },
                    limit: 1,
                })
                shouldRedirect = sites.docs.length > 0
            }
        } catch {
            // If DB query fails, still show onboarding
        }
        if (shouldRedirect) {
            redirect('/dashboard')
        }
    }

    return <OnboardingClient />
}
