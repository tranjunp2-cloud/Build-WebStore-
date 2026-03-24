import { NextRequest, NextResponse } from 'next/server'
import { getPayloadHMR } from '@payloadcms/next/utilities'
import configPromise from '@payload-config'

/**
 * REQ-F19-06: Primary domain check API
 * Called by middleware to determine if a custom domain is the primary domain for its tenant.
 * Returns { isPrimary: boolean, primaryDomain: string | null }
 */
export async function GET(req: NextRequest) {
    const host = req.nextUrl.searchParams.get('host')
    if (!host) {
        return NextResponse.json({ isPrimary: false, primaryDomain: null }, { status: 400 })
    }

    try {
        const payload = await getPayloadHMR({ config: configPromise })

        // Find the tenant that has this custom domain
        const result = await payload.find({
            collection: 'tenants',
            limit: 1,
            where: {},
        })

        // Search through all tenants for the domain
        for (const tenant of result.docs) {
            const domains = Array.isArray(tenant.customDomains) ? (tenant.customDomains as Array<{ domain: string; status: string; isPrimary?: boolean }>) : []
            const match = domains.find(d => d.domain === host && d.status === 'active')
            if (!match) continue

            // Found the tenant — check if this domain is primary
            const isPrimary = match.isPrimary === true
            // Find primary domain: the one with isPrimary:true
            const primaryEntry = domains.find(d => d.status === 'active' && d.isPrimary)
            const primaryDomain = primaryEntry?.domain ?? null

            return NextResponse.json({ isPrimary, primaryDomain })
        }

        // Domain not found in any tenant — serve normally
        return NextResponse.json({ isPrimary: true, primaryDomain: null })
    } catch {
        // On error, don't block traffic
        return NextResponse.json({ isPrimary: true, primaryDomain: null })
    }
}
