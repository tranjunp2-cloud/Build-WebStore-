import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { withAuth } from '@/lib/auth'
import { z } from 'zod'
import { parseRequest } from '@/lib/validations/helpers'
import { checkKeywordRank } from '@/lib/seo/rank-tracker'

const getKeywordsSchema = z.object({
    siteId: z.string().min(1)
})

const addKeywordSchema = z.object({
    siteId: z.string().min(1),
    keyword: z.string().min(1).max(100),
})

function hasSiteAccess(user: any, site: any): boolean {
    if (user.roles?.includes('super-admin')) return true
    const tenantIds = user.tenants?.map((t: any) =>
        t.tenant && typeof t.tenant === 'object' ? t.tenant.id : t.tenant
    ).map(String) || []
    const siteTenantId = site.tenant && typeof site.tenant === 'object' ? site.tenant.id : site.tenant
    return tenantIds.includes(String(siteTenantId))
}

/**
 * GET /api/seo/keywords?siteId={id}
 * Retrieves the list of currently tracked keywords and their ranks
 */
export const GET = withAuth(async (_user, request) => {
    try {
        const { searchParams } = new URL(request.url)
        const siteId = searchParams.get('siteId')
        if (!siteId) return NextResponse.json({ success: false, error: { message: 'siteId is required' } }, { status: 400 })

        const payload = await getPayload({ config })
        const site = await payload.findByID({ collection: 'sites', id: siteId })
        if (!site) return NextResponse.json({ success: false, error: { message: 'Site not found' } }, { status: 404 })

        if (!hasSiteAccess(_user, site)) {
            return NextResponse.json({ success: false, error: { message: 'Forbidden' } }, { status: 403 })
        }

        const trackedKeywords = site.seo?.trackedKeywords || []

        // Format for frontend
        const keywords = trackedKeywords.map((kw: any) => {
            const current = kw.currentRank || null
            const previous = kw.previousRank || null
            
            let trend: 'up' | 'down' | 'same' = 'same'
            if (current && previous) {
                if (current < previous) trend = 'up' // Lower number means higher rank -> "up"
                else if (current > previous) trend = 'down'
            }

            return {
                id: kw.id,
                keyword: kw.keyword,
                rank: current,
                trend,
                lastCheckedAt: kw.lastCheckedAt
            }
        })

        return NextResponse.json({ success: true, data: { keywords } })
    } catch (error: any) {
        return NextResponse.json({ success: false, error: { message: 'Keyword operation failed' } }, { status: 500 })
    }
})

/**
 * POST /api/seo/keywords
 * Adds a new keyword to track for the site (Max 5).
 * Immediately checks rank on first addition.
 */
export const POST = withAuth(async (_user, request) => {
    try {
        const { data, errorResponse } = await parseRequest(request, addKeywordSchema)
        if (errorResponse) return errorResponse

        const { siteId, keyword } = data!
        const payload = await getPayload({ config })

        const site = await payload.findByID({ collection: 'sites', id: siteId })
        if (!site) return NextResponse.json({ success: false, error: { message: 'Site not found' } }, { status: 404 })

        if (!hasSiteAccess(_user, site)) {
            return NextResponse.json({ success: false, error: { message: 'Forbidden' } }, { status: 403 })
        }

        const trackedKeywords = site.seo?.trackedKeywords || []

        // Extract tenant ID robustly
        let tenantId = ''
        if (typeof site.tenant === 'string') tenantId = site.tenant
        else if (site.tenant && typeof site.tenant === 'object' && 'id' in site.tenant) tenantId = String(site.tenant.id)

        if (!tenantId) {
            return NextResponse.json({ success: false, error: { message: 'Site has no associated tenant' } }, { status: 400 })
        }

        // Validate max 5 PER TENANT instead of per site
        const allSites = await payload.find({
            collection: 'sites',
            where: { tenant: { equals: tenantId } },
            limit: 200, // Should be enough to cover a tenant's sites
            depth: 0,
        })
        
        let totalTenantKeywords = 0
        allSites.docs.forEach((s: any) => {
            totalTenantKeywords += (s.seo?.trackedKeywords?.length || 0)
        })

        if (totalTenantKeywords >= 5) {
            return NextResponse.json({ success: false, error: { code: 'MAX_KEYWORDS_REACHED', message: 'Maximum keywords limit reached for this tenant.' } }, { status: 400 })
        }

        // Check duplicates
        if (trackedKeywords.some((k: any) => k.keyword.toLowerCase() === keyword.toLowerCase())) {
            return NextResponse.json({ success: false, error: { code: 'KEYWORD_EXISTS', message: 'Keyword already exists.' } }, { status: 400 })
        }

        // Initial check rank
        const domain = site.domain || site.name
        const rank = await checkKeywordRank(domain, keyword)

        const newKeyword = {
            keyword,
            currentRank: rank,
            previousRank: rank, // Start with previous same as current to avoid arbitrary trend
            lastCheckedAt: new Date().toISOString()
        }

        const updatedSite = await payload.update({
            collection: 'sites',
            id: siteId,
            data: {
                seo: {
                    ...site.seo,
                    trackedKeywords: [...trackedKeywords, newKeyword]
                }
            }
        })

        const addedItem = updatedSite.seo?.trackedKeywords?.[updatedSite.seo.trackedKeywords.length - 1]

        return NextResponse.json({
            success: true,
            data: {
                id: addedItem?.id,
                keyword: addedItem?.keyword,
                rank: addedItem?.currentRank,
                trend: 'same',
                lastCheckedAt: addedItem?.lastCheckedAt
            }
        })
    } catch (error: any) {
        console.error('[Add Keyword Error]', error)
        return NextResponse.json({ success: false, error: { message: 'Keyword operation failed' } }, { status: 500 })
    }
})

/**
 * DELETE /api/seo/keywords?siteId={id}&keywordId={kid}
 * Removes a tracked keyword.
 */
export const DELETE = withAuth(async (_user, request) => {
    try {
        const { searchParams } = new URL(request.url)
        const siteId = searchParams.get('siteId')
        const keywordId = searchParams.get('keywordId')

        if (!siteId || !keywordId) {
            return NextResponse.json({ success: false, error: { message: 'siteId and keywordId required' } }, { status: 400 })
        }

        const payload = await getPayload({ config })
        const site = await payload.findByID({ collection: 'sites', id: siteId })
        if (!site) return NextResponse.json({ success: false, error: { message: 'Site not found' } }, { status: 404 })

        if (!hasSiteAccess(_user, site)) {
            return NextResponse.json({ success: false, error: { message: 'Forbidden' } }, { status: 403 })
        }

        const trackedKeywords = site.seo?.trackedKeywords || []
        const newKeywords = trackedKeywords.filter((k: any) => k.id !== keywordId)

        if (newKeywords.length === trackedKeywords.length) {
            return NextResponse.json({ success: false, error: { message: 'Keyword not found' } }, { status: 404 })
        }

        await payload.update({
            collection: 'sites',
            id: siteId,
            data: {
                seo: {
                    ...site.seo,
                    trackedKeywords: newKeywords
                }
            }
        })

        return NextResponse.json({ success: true, data: { deleted: true } })
    } catch (error: any) {
        return NextResponse.json({ success: false, error: { message: 'Keyword operation failed' } }, { status: 500 })
    }
})
