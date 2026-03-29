import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@payload-config'
import { getCurrentUser } from '@/lib/auth'
import OnboardingClient from './OnboardingClient'

export const dynamic = 'force-dynamic'

export default async function OnboardingPage() {
    const user = await getCurrentUser()

    if (user) {
        try {
            const payload = await getPayload({ config })
            const sites = await payload.find({
                collection: 'sites',
                where: { tenant: { equals: (user as any).tenants?.[0]?.tenant } },
                limit: 1,
            })

            if (sites.docs.length > 0) {
                redirect('/dashboard')
            }
        } catch {
            // If DB query fails, still show onboarding
        }
    }

    return <OnboardingClient />
}
