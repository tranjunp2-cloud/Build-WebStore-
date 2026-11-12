import { getPayload } from 'payload'
import config from '@payload-config'

// Force dynamic — requires auth context + getPayload() at runtime
export const dynamic = 'force-dynamic'

import { getCurrentUser, getCurrentTenantId } from '@/lib/auth'
import { SitesPageClient } from './SitesPageClient'
import { isUsableSite } from '@/lib/dashboard/get-tenant-site-state'

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
            // The cards' columns only: a default depth-2 read sent the whole site row with its populated tenant
            // (Xendit / EasyParcel / ECH secrets) to the client component (TC-PERF-126).
            depth: 0,
            select: {
                name: true,
                domain: true,
                status: true,
                generationStatus: true,
                siteType: true,
                theme: { primaryColor: true },
                updatedAt: true,
                createdAt: true,
            },
        })
        totalSites = result.totalDocs
        sites = result.docs as unknown as SiteDoc[]
    }

    const usableSites = sites.filter(isUsableSite)
    const failedSites = sites.filter((s) => s.generationStatus === 'failed')

    return (
        <SitesPageClient
            usableSites={usableSites}
            failedSites={failedSites}
            totalSites={totalSites}
        />
    )
}
