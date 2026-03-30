import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { seoAnalyzeSchema } from '@/lib/validations/seo'
import { parseRequest } from '@/lib/validations/helpers'
import { withAuth } from '@/lib/auth'
/**
 * POST /api/seo/analyze
 * Analyses all pages of a site and returns an SEO score with issues.
 *
 * Body: { siteId: string }
 * Response: { score, pages: [{ pageId, title, score, issues }] }
 */

interface SEOIssue {
    type: 'error' | 'warning' | 'info'
    field: string
    message: string
    autoFixable: boolean
}

interface PageAnalysis {
    pageId: string | number
    title: string
    slug: string
    score: number
    issues: SEOIssue[]
}

function analysePage(page: any, siteSEO: any): PageAnalysis {
    const issues: SEOIssue[] = []

    // Check meta title
    const metaTitle = page.seo?.title || siteSEO?.metaTitle
    if (!metaTitle) {
        issues.push({ type: 'error', field: 'metaTitle', message: 'Missing meta title', autoFixable: true })
    } else if (metaTitle.length > 60) {
        issues.push({ type: 'warning', field: 'metaTitle', message: `Meta title too long (${metaTitle.length}/60 chars)`, autoFixable: true })
    } else if (metaTitle.length < 20) {
        issues.push({ type: 'warning', field: 'metaTitle', message: `Meta title too short (${metaTitle.length}/20 chars min)`, autoFixable: true })
    }

    // Check meta description
    const metaDesc = page.seo?.description || siteSEO?.metaDescription
    if (!metaDesc) {
        issues.push({ type: 'error', field: 'metaDescription', message: 'Missing meta description', autoFixable: true })
    } else if (metaDesc.length > 160) {
        issues.push({ type: 'warning', field: 'metaDescription', message: `Meta description too long (${metaDesc.length}/160 chars)`, autoFixable: true })
    } else if (metaDesc.length < 50) {
        issues.push({ type: 'warning', field: 'metaDescription', message: `Meta description too short (${metaDesc.length}/50 chars min)`, autoFixable: true })
    }

    // Check heading structure
    const blocks = page.layout || []
    const heroBlocks = blocks.filter((b: any) => b.blockType === 'hero')
    if (heroBlocks.length === 0) {
        issues.push({ type: 'warning', field: 'content', message: 'No hero section with H1 heading', autoFixable: false })
    }

    // Check for images without alt text
    const galleryBlocks = blocks.filter((b: any) => b.blockType === 'gallery')
    for (const gb of galleryBlocks) {
        const images = gb.images || []
        const noAlt = images.filter((img: any) => !img.alt && !img.image?.alt).length
        if (noAlt > 0) {
            issues.push({ type: 'warning', field: 'images', message: `${noAlt} image(s) missing alt text`, autoFixable: true })
        }
    }

    // Check content length (estimate word count from blocks)
    let wordCount = 0
    for (const block of blocks) {
        const text = [block.headline, block.subheadline, block.body, block.description].filter(Boolean).join(' ')
        wordCount += text.split(/\s+/).filter(Boolean).length
    }
    if (wordCount < 100) {
        issues.push({ type: 'info', field: 'content', message: `Low content: ~${wordCount} words (recommend 300+)`, autoFixable: false })
    }

    // Check contact info
    const contactBlocks = blocks.filter((b: any) => b.blockType === 'contact')
    if (contactBlocks.length === 0) {
        issues.push({ type: 'info', field: 'content', message: 'No contact section for local SEO', autoFixable: false })
    }

    // Calculate score (100 - deductions)
    const errorDeduction = issues.filter(i => i.type === 'error').length * 20
    const warningDeduction = issues.filter(i => i.type === 'warning').length * 10
    const infoDeduction = issues.filter(i => i.type === 'info').length * 3
    const score = Math.max(0, Math.min(100, 100 - errorDeduction - warningDeduction - infoDeduction))

    return {
        pageId: page.id,
        title: page.title || 'Untitled',
        slug: page.slug || '/',
        score,
        issues,
    }
}

export const POST = withAuth(async (_user, request) => {
    try {
        const { data, errorResponse } = await parseRequest(request, seoAnalyzeSchema)
        if (errorResponse) return errorResponse
        
        const { siteId } = data!

        const payload = await getPayload({ config })

        // Get site
        const site = await payload.findByID({ collection: 'sites', id: siteId })
        if (!site) {
            return NextResponse.json(
                { success: false, error: { code: 'NOT_FOUND', message: 'Site not found' } },
                { status: 404 }
            )
        }

        // IDOR Protection: local API bypasses access control, so we must manually check tenant ownership
        const userTenantIds = _user.tenants?.map((t: any) =>
            t.tenant && typeof t.tenant === 'object' ? t.tenant.id : t.tenant
        ).map(String) || []
        const siteTenantId = site.tenant && typeof site.tenant === 'object' ? site.tenant.id : site.tenant

        if (!_user.roles?.includes('super-admin') && !userTenantIds.includes(String(siteTenantId))) {
            return NextResponse.json(
                { success: false, error: { code: 'FORBIDDEN', message: 'Forbidden' } },
                { status: 403 }
            )
        }

        // Get all pages for this site
        const pagesResult = await payload.find({
            collection: 'pages',
            where: { site: { equals: siteId } },
            limit: 50,
            depth: 2,
        })

        // Analyse each page
        const pageAnalyses: PageAnalysis[] = pagesResult.docs.map(page =>
            analysePage(page, site.seo)
        )

        // Calculate overall score (average of all pages)
        const overallScore = pageAnalyses.length > 0
            ? Math.round(pageAnalyses.reduce((sum, p) => sum + p.score, 0) / pageAnalyses.length)
            : 0

        const totalIssues = pageAnalyses.reduce((sum, p) => sum + p.issues.length, 0)
        const fixableIssues = pageAnalyses.reduce((sum, p) => sum + p.issues.filter(i => i.autoFixable).length, 0)

        return NextResponse.json({
            success: true,
            data: {
                siteId,
                siteName: site.name,
                score: overallScore,
                totalIssues,
                fixableIssues,
                pages: pageAnalyses,
            },
        })
    } catch (error: any) {
        console.error('[SEO Analyze Error]', error)
        return NextResponse.json(
            { success: false, error: { code: 'INTERNAL_ERROR', message: 'SEO analysis failed' } },
            { status: 500 }
        )
    }
})
