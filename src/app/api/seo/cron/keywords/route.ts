import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { checkKeywordRank } from '@/lib/seo/rank-tracker'

// This endpoint can be triggered by a Cron service (like Vercel Cron)
// In production, we should secure it with a secret token (e.g. CRON_SECRET)
export async function GET(request: Request) {
    try {
        const authHeader = request.headers.get('authorization')
        const VERCEL_CRON_SECRET = process.env.CRON_SECRET || 'dev-cron-secret'
        
        // Basic security check for cron endpoints
        if (authHeader !== `Bearer ${VERCEL_CRON_SECRET}` && process.env.NODE_ENV === 'production') {
            return new NextResponse('Unauthorized', { status: 401 })
        }

        const payload = await getPayload({ config })
        
        // Fetch all sites. In a massive DB, this should be paginated.
        const sitesResult = await payload.find({
            collection: 'sites',
            limit: 1000,
            depth: 0,
        })

        const sites = sitesResult.docs.filter((s: any) => s.seo?.trackedKeywords && s.seo.trackedKeywords.length > 0)
        let updatedCount = 0

        for (const site of sites) {
            const domain = site.domain || site.name
            let hasChanges = false
            
            const updatedKeywords = await Promise.all(site.seo!.trackedKeywords!.map(async (kw: any) => {
                // Check if it's been updated recently (e.g. within 23 hours to allow daily cron slop)
                const lastChecked = new Date(kw.lastCheckedAt).getTime()
                const now = Date.now()
                if (now - lastChecked < 23 * 60 * 60 * 1000) {
                    return kw // Skip if checked recently
                }

                // Wait 1 second between checks to prevent spamming Google too hard
                await new Promise(r => setTimeout(r, 1000))
                
                const rank = await checkKeywordRank(domain, kw.keyword)
                hasChanges = true
                updatedCount++
                
                return {
                    ...kw,
                    previousRank: kw.currentRank,
                    currentRank: rank,
                    lastCheckedAt: new Date().toISOString()
                }
            }))

            if (hasChanges) {
                await payload.update({
                    collection: 'sites',
                    id: site.id,
                    data: {
                        seo: {
                            ...site.seo,
                            trackedKeywords: updatedKeywords
                        }
                    }
                })
            }
        }

        return NextResponse.json({ 
            success: true, 
            message: `Updated rankings for ${updatedCount} keywords across ${sites.length} sites.`
        })
    } catch (error: any) {
        console.error('[SEO Cron Error]', error)
        return NextResponse.json({ success: false, error: { message: error.message } }, { status: 500 })
    }
}
