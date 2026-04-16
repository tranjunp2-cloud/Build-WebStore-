export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'

import { withAuth } from '@/lib/auth'
import { parseRequest } from '@/lib/validations/helpers'
import { revalidateTag } from 'next/cache'
import { z } from 'zod'

const updatePageSchema = z.object({
    isVisible: z.boolean().optional(),
    deletedAt: z.string().nullable().optional(),
    slug: z.string().regex(/^[a-z0-9-\/]+$/, 'Slug must be valid path').optional(),
    seoTitle: z.string().optional(),
    seoDescription: z.string().optional(),
})


type RouteContext = { params: Promise<{ siteId: string; pageId: string }> }

type PageUpdateData = {
    isVisible?: boolean
    deletedAt?: string | null
    slug?: string
    seo?: { title?: string; description?: string }
}

export const PATCH = withAuth<RouteContext>(async (user, request, ctx) => {
    try {
        const payload = await getPayload({ config })
        const resolvedParams = await Promise.resolve(ctx.params)
        const { siteId, pageId } = resolvedParams

        if (!siteId || !/^\d+$/.test(siteId) || !pageId || !/^\d+$/.test(pageId)) {
            return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 })
        }

        const numericSiteId = Number(siteId)
        
        // Extract tenant IDs from the current user
        interface TenantRef {
            tenant: string | number | { id: string | number }
        }
        const tenantIds = user.tenants?.map((t: TenantRef) =>
            typeof t.tenant === 'object' ? String(t.tenant.id) : String(t.tenant)
        ) ?? []

        const { docs: sites } = await payload.find({
            collection: 'sites',
            where: {
                id: {
                    equals: siteId,
                },
                tenant: {
                    in: tenantIds,
                },
            },
        })

        if (!sites || sites.length === 0) {
            return new NextResponse('Unauthorized or Site Not Found', { status: 403 })
        }

        const { data, errorResponse } = await parseRequest(request, updatePageSchema)
        if (errorResponse) return errorResponse

        const { isVisible, deletedAt, slug, seoTitle, seoDescription } = data!

        const updateData: PageUpdateData = {}
        if (isVisible !== undefined) updateData.isVisible = isVisible
        if (deletedAt !== undefined) updateData.deletedAt = deletedAt
        if (slug !== undefined) updateData.slug = slug

        if (seoTitle !== undefined || seoDescription !== undefined) {
            updateData.seo = {}
            if (seoTitle !== undefined) updateData.seo.title = seoTitle.trim()
            if (seoDescription !== undefined) updateData.seo.description = seoDescription.trim()
        }

        const page = await payload.findByID({
            collection: 'pages',
            id: pageId,
        })
        const pageSiteId = typeof page?.site === 'object' ? page.site?.id : page?.site

        if (!page || Number(pageSiteId) !== numericSiteId) {
            return new NextResponse('Page not found on this site', { status: 404 })
        }

        if (slug !== undefined) {
            const currentSlug = String(page.slug || '').replace(/^\//, '')
            const is404Page =
                currentSlug === '404' ||
                String(page.title || '').toLowerCase().includes('404')

            if (is404Page) {
                return NextResponse.json({ error: '404 page slug is read-only.' }, { status: 400 })
            }

            // Lock slug only while site is currently published (allow when unpublished/draft)
            const site = sites[0] as { status?: string; publishedAt?: string }
            if (site.status === 'published') {
                return NextResponse.json({ error: 'Slug cannot be changed while site is published. Unpublish first to edit URLs.' }, { status: 400 })
            }

            let normalizedSlug = String(slug).trim()
            if (!normalizedSlug) {
                return NextResponse.json({ error: 'URL slug is required.' }, { status: 400 })
            }
            normalizedSlug = normalizedSlug.startsWith('/') ? normalizedSlug : `/${normalizedSlug}`
            if (normalizedSlug === '//') normalizedSlug = '/'

            const duplicatePages = await payload.find({
                collection: 'pages',
                where: {
                    and: [
                        { site: { equals: numericSiteId } },
                        { slug: { equals: normalizedSlug } },
                    ],
                },
                limit: 1,
            })

            const duplicate = duplicatePages.docs.find((doc: { id: string | number }) => String(doc.id) !== String(pageId))
            if (duplicate) {
                return NextResponse.json({ error: 'Invalid or duplicate URL slug.' }, { status: 400 })
            }

            updateData.slug = normalizedSlug
        }

        if (Object.keys(updateData).length === 0) {
            return new NextResponse('No fields to update', { status: 400 })
        }

        const updatedPage = await payload.update({
            collection: 'pages',
            id: pageId,
            data: updateData,
        })

        // BUG-F05-11: revalidate site cache when page is deleted/hidden
        // so live site reflects the change immediately
        if (updateData.deletedAt !== undefined || updateData.isVisible !== undefined) {
            try {
                revalidateTag(`site-${siteId}`)
            } catch {
                // revalidateTag requires Next.js request context
            }
        }

        return NextResponse.json({
            page: {
                id: updatedPage.id,
                title: updatedPage.title,
                slug: updatedPage.slug,
                status: updatedPage._status || 'draft',
                isVisible: updatedPage.isVisible ?? true,
                seoTitle: updatedPage.seo?.title ?? null,
                seoDescription: updatedPage.seo?.description ?? null,
                updatedAt: updatedPage.updatedAt,
            }
        })
    } catch (error) {
        console.error('Error updating page:', error)
        return new NextResponse('Internal Error', { status: 500 })
    }
})
