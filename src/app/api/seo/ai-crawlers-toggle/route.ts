import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { withAuth } from '@/lib/auth'
import { withFeatureGuard } from '@/lib/subscriptions/feature-guard'

/**
 * POST /api/seo/ai-crawlers-toggle
 * Toggle AI crawler (GPTBot/ClaudeBot/Google-Extended/PerplexityBot/CCBot) permission for a site.
 * Body: { siteId: string, enabled: boolean }
 */
export const POST = withFeatureGuard('sitemap_robot_configuration')(withAuth(async (user, request) => {
    try {
        const { siteId, enabled } = await request.json()
        if (!siteId) {
            return NextResponse.json({ success: false, error: 'siteId required' }, { status: 400 })
        }
        if (typeof enabled !== 'boolean') {
            return NextResponse.json({ success: false, error: 'enabled must be a boolean' }, { status: 400 })
        }

        const payload = await getPayload({ config })

        // Verify user owns this site's tenant
        const site = await payload.findByID({ collection: 'sites', id: siteId, depth: 0 })
        const tenantIds = (user.tenants as Array<{ tenant: string | { id: string } }>)
            ?.map(t => typeof t.tenant === 'object' ? t.tenant.id : t.tenant)
            .filter(Boolean) ?? []
        const siteTenantId = String(typeof site.tenant === 'object' ? (site.tenant as { id: string }).id : site.tenant)

        if (!tenantIds.map(String).includes(siteTenantId)) {
            return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
        }

        await payload.update({
            collection: 'sites',
            id: siteId,
            data: { aiCrawlersEnabled: enabled },
        })

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('[AI Crawlers Toggle Error]', error)
        return NextResponse.json(
            { success: false, error: 'Failed to update' },
            { status: 500 },
        )
    }
}))
