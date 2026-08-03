export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { getCurrentUser } from '@/lib/auth'
import { checkRateLimit } from '@/lib/rateLimit'
import { calculateBusinessDataScore, calculateLocalSeoScore } from '@/lib/seo/local-seo-score'
import { hasMeaningfulLocalBusinessData, type LocalBusinessSiteData } from '@/lib/seo/json-ld'
import { schemaTypeForLocalBusiness } from '@/lib/seo/schema-helpers'

/**
 * GET /api/sites/[siteId]/local-seo-score
 * Returns the legacy { score, breakdown } plus the additive US-F37-01
 * `minimalBusinessData` 7/8/5 result calculated from persisted site fields.
 * The top-level total intentionally remains on the legacy formula; US-F37-04
 * owns the atomic 20/40/20/20 cutover and dashboard/checklist UI.
 *
 * Signal sourcing notes (see calculateLocalSeoScore's Tech Health bucket):
 * `mobileResponsive`/`httpsEnabled`/`coreWebVitals` have no real measurement
 * infra in this codebase yet (no Lighthouse/CWV integration) — defaulted
 * true/true/80 (assume-passing) rather than penalizing every site for an
 * unmeasured signal. This is a documented Phase 05 stopgap — flag to PM
 * before US-F37-04's dashboard surfaces this score to sellers; the PRD's
 * own §13.8 "earned/applicable" normalization pattern (used for GBP/Phase-2
 * buckets) may be the right fix if these stay unmeasured by then.
 * `allowsSearchBots` reflects the real current robots.txt state (AI
 * crawlers blocked by default until US-F37-03 ships).
 */
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ siteId: string }> }
) {
    try {
        const user = await getCurrentUser(req)
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const rateLimit = await checkRateLimit(`local-seo-score:${user.id}`, 30, 60_000)
        if (!rateLimit.allowed) {
            return NextResponse.json({ error: 'Too many requests. Try again shortly.' }, { status: 429 })
        }

        const { siteId } = await params
        const payload = await getPayload({ config })

        const site = await payload.findByID({ collection: 'sites', id: siteId, disableErrors: true })
        if (!site) {
            return NextResponse.json({ error: 'Site not found' }, { status: 404 })
        }

        type TenantRef = string | number | { id: string | number } | null | undefined
        const resolveTenantId = (t: TenantRef): string | null =>
            t == null ? null : String(typeof t === 'object' ? t.id : t)
        const userTenants = (user as unknown as { tenants?: Array<{ tenant: TenantRef }> }).tenants ?? []
        const siteTenantId = resolveTenantId(site.tenant as TenantRef)
        if (!siteTenantId || !userTenants.some(t => resolveTenantId(t.tenant) === siteTenantId)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        const localBusiness = site.localBusiness as LocalBusinessSiteData | undefined
        const contactInfo = site.contactInfo as { phone?: string; address?: string } | undefined

        // FAQ schema signal: check every page (generatePageSchemas emits FAQPage
        // per-page for any page with a faq block), not homepage-only — a seller
        // with a dedicated /faq page and no homepage FAQ content still earns this.
        const pagesRes = await payload.find({
            collection: 'pages',
            where: { site: { equals: Number(siteId) } },
            limit: 200,
            depth: 0,
        })
        const hasFaqBlock = pagesRes.docs.some(page => {
            const layout = (page as { layout?: Array<{ blockType?: string; items?: unknown[] }> }).layout
            return Array.isArray(layout) && layout.some(b => b.blockType === 'faq' && Array.isArray(b.items) && b.items.length > 0)
        })

        const result = calculateLocalSeoScore({
            businessName: Boolean(site.name),
            address: Boolean(localBusiness?.streetAddress || contactInfo?.address),
            phone: Boolean(contactInfo?.phone),
            hours: (localBusiness?.openingHours ?? []).some(h => !h.isClosed && h.opens && h.closes), // matches hasMeaningfulLocalBusinessData's predicate — an all-closed/empty array must not earn credit
            category: Boolean(localBusiness?.businessCategory),
            website: Boolean(site.domain),
            description: Boolean((site.seo as { metaDescription?: string } | undefined)?.metaDescription),

            localBusinessSchema: hasMeaningfulLocalBusinessData(localBusiness),
            industrySubtype: schemaTypeForLocalBusiness(localBusiness?.businessCategory) !== 'LocalBusiness',
            faqSchema: hasFaqBlock,
            orgSchema: true, // generateOrganizationSchema() always emits for any real site

            allowsSearchBots: false, // real current state — AI crawlers blocked by default until US-F37-03 ships
            sitemapPresent: site.status === 'published', // sitemap.xml route 404s for unpublished sites — real signal, not assumed

            coreWebVitals: 80, // no CWV/Lighthouse measurement infra yet — assume passing (no deduction)
            mobileResponsive: true, // page-builder templates are mobile-first by construction
            httpsEnabled: true, // Vercel hosting always serves HTTPS
        })

        const minimalBusinessData = calculateBusinessDataScore({
            businessName: site.name,
            streetAddress: localBusiness?.streetAddress,
            city: localBusiness?.city,
            postcode: localBusiness?.postcode,
            country: localBusiness?.country,
            phone: contactInfo?.phone,
        })

        return NextResponse.json({
            success: true,
            ...result,
            minimalBusinessData: {
                ...minimalBusinessData,
                maxScore: 20,
            },
        })
    } catch (error: unknown) {
        const errMsg = error instanceof Error ? error.message : String(error)
        console.error('[Local SEO Score Error]', errMsg.slice(0, 500))
        return NextResponse.json({ error: 'Failed to calculate score. Please try again in a moment.' }, { status: 500 })
    }
}
