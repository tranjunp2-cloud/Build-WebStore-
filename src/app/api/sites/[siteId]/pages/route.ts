import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'

import { withAuth } from '@/lib/auth'
import { parseRequest } from '@/lib/validations/helpers'
import { z } from 'zod'

const newPageSchema = z.object({
    title: z.string().min(1, 'Title is required'),
    slug: z.string().regex(/^[a-z0-9-\/]+$/, 'Slug must be kebab-case or valid path').min(1, 'Slug is required'),
})
type RouteContext = { params: Promise<{ siteId: string }> }

export interface TenantRef {
    tenant: string | number | { id: string | number }
}

export const GET = withAuth<RouteContext>(async (user, request, ctx) => {
    try {
        const payload = await getPayload({ config })
        const resolvedParams = await Promise.resolve(ctx.params)
        const siteId = resolvedParams.siteId

        // Extract tenant IDs from the current user
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

        const { docs: pages } = await payload.find({
            collection: 'pages',
            where: {
                site: {
                    equals: siteId,
                },
                deletedAt: {
                    exists: false,
                }
            },
            sort: 'createdAt',
        })

        type PageDoc = {
            id: string | number
            title: string
            slug: string
            _status?: string
            isHomepage?: boolean | null
            isVisible?: boolean | null
            seo?: { title?: string; description?: string }
            updatedAt: string
        }

        const formattedPages = (pages as unknown as PageDoc[]).map((p: PageDoc) => ({
            id: p.id,
            title: p.title,
            slug: p.slug,
            status: p._status || 'draft',
            isHomepage: Boolean(p.isHomepage),
            isVisible: p.isVisible ?? true,
            seoTitle: p.seo?.title ?? null,
            seoDescription: p.seo?.description ?? null,
            updatedAt: p.updatedAt,
        }))

        return NextResponse.json({ pages: formattedPages })
    } catch (error) {
        console.error('Error fetching pages:', error)
        return new NextResponse('Internal Error', { status: 500 })
    }
})

export const POST = withAuth<RouteContext>(async (user, request, ctx) => {
    try {
        const payload = await getPayload({ config })
        const resolvedParams = await Promise.resolve(ctx.params)
        const siteId = resolvedParams.siteId
        
        // Extract tenant IDs from the current user
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

        const { data, errorResponse } = await parseRequest(request, newPageSchema)
        if (errorResponse) return errorResponse

        const { title, slug } = data!

        let normalizedSlug = slug.startsWith('/') ? slug : `/${slug}`
        if (normalizedSlug === '//') normalizedSlug = '/'

        const existingPages = await payload.find({
            collection: 'pages',
            where: {
                and: [
                    { site: { equals: siteId } },
                    { slug: { equals: normalizedSlug } }
                ]
            },
            limit: 1
        })

        if (existingPages.docs.length > 0) {
            return new NextResponse('Page slug already exists in this site', { status: 409 })
        }

        const newPage = await payload.create({
            collection: 'pages',
            data: {
                title,
                slug: normalizedSlug,
                site: siteId,
                isVisible: true,
                layout: [],
                _status: 'draft',
            },
        })

        return NextResponse.json({
            page: {
                id: newPage.id,
                title: newPage.title,
                slug: newPage.slug,
                status: newPage._status || 'draft',
                isHomepage: Boolean(newPage.isHomepage),
                isVisible: newPage.isVisible ?? true,
                seoTitle: newPage.seo?.title ?? null,
                seoDescription: newPage.seo?.description ?? null,
                updatedAt: newPage.updatedAt,
            }
        })
    } catch (error) {
        console.error('Error creating page:', error)
        return new NextResponse('Internal Error', { status: 500 })
    }
})
