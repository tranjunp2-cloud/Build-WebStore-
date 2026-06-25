/**
 * SEO health + automation data for the revamp dashboard.
 * Extracted from SEOView — same scan, score formula (Meta 40% / Content 35% / Technical 25%),
 * and missing-item collection. Derives the aggregate issue list + top issue from real counts.
 */
import { getPayload } from 'payload'
import { sql } from 'drizzle-orm'
import config from '@payload-config'
import { getCurrentTenantId } from '@/lib/auth'
import { calculateTechnicalSeoScore } from '@/lib/seo/technical-score'
import { calculateContentQualityScore } from '@/lib/seo/content-score'
import type { MissingSeoItem } from '@/components/dashboard/views/SEOView'
import type { SeoData, SeoIssue } from './dashboard-types'

interface ProductWithSEO {
    id: string | number
    name?: string
    shortDescription?: string
    seo?: { title?: string; description?: string }
    images?: Array<{ alt?: string }>
}
interface PageWithSEO {
    id: string | number
    title?: string
    seo?: { title?: string; description?: string }
    layout?: Array<{ headline?: string; sectionLabel?: string }>
}
interface BlogWithSEO {
    id: string | number
    title?: string
    excerpt?: string
    seo?: { metaTitle?: string; metaDescription?: string }
}

const sevByCount = (count: number): SeoIssue['sev'] => (count >= 5 ? 'high' : count >= 3 ? 'med' : 'low')

export async function getSeoData(): Promise<SeoData> {
    const tenantId = await getCurrentTenantId()
    let score = 100
    let metaTagsScore = 100
    let contentQualityScore = 100
    let technicalSeoScore = 100
    let autoMetaEnabled = true
    let siteId: string | number | null = null
    const missingSeoItems: MissingSeoItem[] = []
    let missingTitleCount = 0
    let missingDescCount = 0
    let missingAltCount = 0
    let invalidPageTitleCount = 0
    let invalidBlogTitleCount = 0

    if (tenantId) {
        const payload = await getPayload({ config })
        try {
            const sitesRes = await payload.find({ collection: 'sites', where: { tenant: { equals: tenantId } }, limit: 1 })
            const site = sitesRes.docs[0]
            if (site) {
                siteId = site.id
                autoMetaEnabled = site.seo?.autoMetaEnabled !== false

                const pageDbRows = await (payload.db.drizzle.execute(sql`
                    SELECT id, title, slug, seo_title, seo_description, seo_no_index
                    FROM pages WHERE site_id = ${site.id} AND deleted_at IS NULL LIMIT 1000
                `) as Promise<{ rows: Array<{ id: number; title: string; slug: string; seo_title: string | null; seo_description: string | null; seo_no_index: boolean | null }> }>)
                const pagesRes = {
                    docs: pageDbRows.rows.map(r => ({
                        id: r.id, title: r.title, slug: r.slug,
                        seo: { title: r.seo_title, description: r.seo_description, noIndex: r.seo_no_index },
                    })),
                }
                const [productsRes, blogsRes] = await Promise.all([
                    payload.find({ collection: 'products', where: { tenant: { equals: tenantId }, status: { equals: 'active' } }, limit: 1000, depth: 0 }),
                    payload.find({ collection: 'blogs', where: { tenant: { equals: tenantId }, status: { equals: 'published' } }, limit: 1000, depth: 0 }),
                ])

                productsRes.docs.forEach((product: unknown) => {
                    const p = product as ProductWithSEO
                    if (!p.seo?.title) missingTitleCount++
                    if (!p.seo?.description) missingDescCount++
                    let hasMissingAlt = false
                    if (p.images && p.images.length > 0) {
                        p.images.forEach(img => { if (!img.alt || img.alt.trim() === '') hasMissingAlt = true })
                    }
                    if (hasMissingAlt) missingAltCount++

                    const missing: string[] = []
                    if (!p.seo?.title) missing.push('title')
                    if (!p.seo?.description) missing.push('description')
                    if (missing.length > 0) {
                        missingSeoItems.push({
                            collection: 'products', id: p.id, title: p.name || 'Untitled Product',
                            context: (p.shortDescription || '').slice(0, 150), missingFields: missing,
                            currentTitle: p.seo?.title || undefined, currentDescription: p.seo?.description || undefined,
                        })
                    }
                })

                pagesRes.docs.forEach((page: unknown) => {
                    const p = page as PageWithSEO
                    if (!p.seo?.title) invalidPageTitleCount++
                    if (!p.seo?.description) missingDescCount++
                    const missing: string[] = []
                    if (!p.seo?.title) missing.push('title')
                    if (!p.seo?.description) missing.push('description')
                    if (missing.length > 0) {
                        const textContext = Array.isArray(p.layout)
                            ? p.layout.map(b => b.headline || b.sectionLabel || '').filter(Boolean).join('. ').slice(0, 150) : ''
                        missingSeoItems.push({
                            collection: 'pages', id: p.id, title: p.title || 'Untitled Page',
                            context: textContext, missingFields: missing,
                            currentTitle: p.seo?.title || undefined, currentDescription: p.seo?.description || undefined,
                        })
                    }
                })

                blogsRes.docs.forEach((blog: unknown) => {
                    const b = blog as BlogWithSEO
                    if (!b.seo?.metaTitle) invalidBlogTitleCount++
                    if (!b.seo?.metaDescription) missingDescCount++
                    const missing: string[] = []
                    if (!b.seo?.metaTitle) missing.push('title')
                    if (!b.seo?.metaDescription) missing.push('description')
                    if (missing.length > 0) {
                        missingSeoItems.push({
                            collection: 'blogs', id: b.id, title: b.title || 'Untitled Blog',
                            context: (b.excerpt || '').slice(0, 150), missingFields: missing,
                            currentTitle: b.seo?.metaTitle || undefined, currentDescription: b.seo?.metaDescription || undefined,
                        })
                    }
                })

                const metaTitleDeduction = Math.min(20, missingTitleCount * 5) + Math.min(20, invalidPageTitleCount * 5) + Math.min(10, invalidBlogTitleCount * 5)
                const metaDescDeduction = Math.min(30, missingDescCount * 5)
                metaTagsScore = Math.max(0, 100 - metaTitleDeduction - metaDescDeduction)

                const hasContactSection = pagesRes.docs.some((p: unknown) => {
                    const layout = (p as { layout?: Array<{ blockType?: string }> }).layout
                    return Array.isArray(layout) && layout.some(b => b.blockType === 'contact')
                })
                contentQualityScore = calculateContentQualityScore({
                    pages: pagesRes.docs.map((p: unknown) => ({ layout: (p as { layout?: Array<{ blockType?: string; headline?: string; description?: string; content?: string; sectionLabel?: string; subheadline?: string; body?: string }> }).layout })),
                    productMissingAltCount: missingAltCount,
                    hasContactSection,
                })

                const noIndexCount = pagesRes.docs.filter((p: unknown) => (p as { seo?: { noIndex?: boolean } }).seo?.noIndex === true).length
                technicalSeoScore = calculateTechnicalSeoScore({
                    siteHasOgImage: Boolean(site.seo?.ogImage),
                    siteHasGoogleVerification: Boolean(site.seo?.googleVerificationToken),
                    pageSlugs: pagesRes.docs.map((p: unknown) => ((p as { slug?: string }).slug || '')),
                    noIndexCount,
                })

                score = Math.floor((metaTagsScore * 0.4) + (contentQualityScore * 0.35) + (technicalSeoScore * 0.25))
            }
        } catch (e) {
            console.error('Error computing SEO metrics', e)
        }
    }

    const totalMissingTitle = missingTitleCount + invalidPageTitleCount + invalidBlogTitleCount
    const allIssues: SeoIssue[] = [
        { sev: sevByCount(missingAltCount), text: 'products missing image Alt text', count: missingAltCount, fixType: 'alt' },
        { sev: sevByCount(missingDescCount), text: 'pages without a meta description', count: missingDescCount, fixType: 'description' },
        { sev: sevByCount(totalMissingTitle), text: 'items missing a meta title', count: totalMissingTitle, fixType: 'title' },
    ]
    const issues = allIssues.filter(i => i.count > 0)

    const topIssue = issues.length > 0
        ? [...issues].sort((a, b) => b.count - a.count)[0]
        : null

    return {
        score,
        breakdown: [
            { name: 'Meta Tags', pct: metaTagsScore },
            { name: 'Content Quality', pct: contentQualityScore },
            { name: 'Technical SEO', pct: technicalSeoScore },
        ],
        issues,
        topIssue: topIssue ? { count: topIssue.count, text: topIssue.text } : null,
        missingSeoItems,
        siteId,
        autoMetaEnabled,
    }
}
