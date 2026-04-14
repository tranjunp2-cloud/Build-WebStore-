import { getPayload } from 'payload'
import config from '@payload-config'

// Force dynamic — requires auth context + getPayload() at runtime
export const dynamic = 'force-dynamic'

import { getCurrentUser, getCurrentTenantId } from '@/lib/auth'
import { SitesPageClient } from './SitesPageClient'

type SiteDoc = {
    id: string
    name?: string
    domain?: string
    status?: string
    generationStatus?: string
    siteType?: string
    updatedAt?: string
    createdAt?: string
    theme?: { primaryColor?: string }
}

export default async function MySitesPage() {
    const user = await getCurrentUser()
    const tenantId = await getCurrentTenantId()
    const payload = await getPayload({ config })

    let sites: SiteDoc[] = []
    let totalSites = 0

    if (tenantId) {
        const result = await payload.find({
            collection: 'sites',
            where: { tenant: { equals: tenantId } },
            sort: '-updatedAt',
            limit: 100,
        })
        totalSites = result.totalDocs
        sites = result.docs as unknown as SiteDoc[]
    }

    const usableSites = sites.filter(
        (s) => !s.generationStatus || s.generationStatus === 'none' || s.generationStatus === 'completed',
    )
    const failedSites = sites.filter((s) => s.generationStatus === 'failed')

    return (
        <SitesPageClient
            usableSites={usableSites}
            failedSites={failedSites}
            totalSites={totalSites}
        />
    )
}
