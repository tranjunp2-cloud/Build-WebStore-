import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { createHash } from 'crypto'

import { analyticsTrackSchema } from '@/lib/validations/analytics'
import { parseRequest } from '@/lib/validations/helpers'

/**
 * POST /api/analytics/track
 * Public lightweight endpoint for tracking page views and events.
 *
 * Body: { siteId, event?, pageUrl, referrer?, sessionId?, metadata? }
 */
export async function POST(request: NextRequest) {
    try {
        const { data, errorResponse } = await parseRequest(request, analyticsTrackSchema)
        if (errorResponse) return errorResponse
        
        const { siteId, event = 'pageview', pageUrl, referrer, sessionId, metadata } = data!

        const payload = await getPayload({ config })

        // Get site to find tenant
        const site = await payload.findByID({ collection: 'sites', id: siteId, depth: 0 })
        if (!site) {
            return NextResponse.json({ success: false }, { status: 404 })
        }

        const tenantId = typeof site.tenant === 'object' ? (site.tenant as any).id : site.tenant

        // Hash IP for anonymization
        const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
        const hashedIp = createHash('sha256').update(ip + siteId).digest('hex').slice(0, 16)

        // User agent
        const userAgent = request.headers.get('user-agent') || ''

        await payload.create({
            collection: 'analytics',
            data: {
                tenant: tenantId,
                site: siteId,
                event,
                pageUrl,
                referrer: referrer || '',
                userAgent: userAgent.slice(0, 200), // Truncate
                ip: hashedIp,
                sessionId: sessionId || '',
                metadata: metadata || {},
            } as any,
        })

        return NextResponse.json({ success: true })
    } catch (error: any) {
        // Silently fail — analytics should never break the page
        console.error('[Analytics Track Error]', error.message)
        return NextResponse.json({ success: true })
    }
}
