import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { withAuth } from '@/lib/auth'
import { parseRequest } from '@/lib/validations/helpers'
import { createBlogSchema } from '@/lib/validations/blog'

function toSlug(text: string): string {
    return text
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
}

/**
 * GET /api/blogs — List blogs for current tenant
 * Query params: search, status, category, sort, page, limit
 */
export const GET = withAuth(async (user, req) => {
    try {
        const tenantId = user.tenants?.[0]?.tenant
        const resolvedTenantId = typeof tenantId === 'object' ? tenantId.id : tenantId
        if (!resolvedTenantId) {
            return NextResponse.json(
                { success: false, error: { code: 'NO_TENANT', details: 'No tenant found' } },
                { status: 400 }
            )
        }

        const url = new URL(req.url)
        const search = url.searchParams.get('search') || ''
        const status = url.searchParams.get('status') || ''
        const category = url.searchParams.get('category') || ''
        const sort = url.searchParams.get('sort') || '-createdAt'
        const page = parseInt(url.searchParams.get('page') || '1')
        const limit = parseInt(url.searchParams.get('limit') || '20')

        const where: any = {
            tenant: { equals: resolvedTenantId },
            status: { not_equals: 'deleted' },
        }

        if (search) {
            where.title = { contains: search }
        }
        if (status && (status === 'draft' || status === 'published')) {
            where.status = { equals: status }
        }
        if (category) {
            where.category = { equals: category }
        }

        const payload = await getPayload({ config })

        const result = await payload.find({
            collection: 'blogs',
            where,
            sort,
            page,
            limit,
            depth: 1, // Populate category and author
        })

        return NextResponse.json({
            success: true,
            data: result.docs,
            meta: {
                totalDocs: result.totalDocs,
                totalPages: result.totalPages,
                page: result.page,
                limit: result.limit,
                hasPrevPage: result.hasPrevPage,
                hasNextPage: result.hasNextPage,
            },
        })
    } catch (error) {
        console.error('GET /api/blogs error:', error)
        return NextResponse.json(
            { success: false, error: { code: 'SERVER_ERROR', details: 'Failed to fetch blogs' } },
            { status: 500 }
        )
    }
})

/**
 * POST /api/blogs — Create a new blog post
 */
export const POST = withAuth(async (user, req) => {
    try {
        const { data, errorResponse } = await parseRequest(req, createBlogSchema)
        if (errorResponse) return errorResponse

        const tenantId = user.tenants?.[0]?.tenant
        const resolvedTenantId = typeof tenantId === 'object' ? tenantId.id : tenantId
        if (!resolvedTenantId) {
            return NextResponse.json(
                { success: false, error: { code: 'NO_TENANT', details: 'No tenant found' } },
                { status: 400 }
            )
        }

        const payload = await getPayload({ config })

        // Get the user's first site
        const sites = await payload.find({
            collection: 'sites',
            where: { tenant: { equals: resolvedTenantId } },
            limit: 1,
        })
        const siteId = sites.docs[0]?.id
        if (!siteId) {
            return NextResponse.json(
                { success: false, error: { code: 'NO_SITE', details: 'No site found for this tenant' } },
                { status: 400 }
            )
        }

        // Generate unique slug
        let slug = toSlug(data!.title)
        const existingSlugs = await payload.find({
            collection: 'blogs',
            where: { slug: { contains: slug } },
            limit: 100,
        })
        if (existingSlugs.docs.length > 0) {
            slug = `${slug}-${Date.now()}`
        }

        const blog = await payload.create({
            collection: 'blogs',
            data: {
                tenant: resolvedTenantId,
                site: siteId,
                title: data!.title,
                slug,
                content: data!.content,
                status: data!.status || 'draft',
                category: data!.category ? Number(data!.category) : undefined,
                thumbnail: data!.thumbnail ? Number(data!.thumbnail) : undefined,
                author: user.id,
                seo: data!.seo,
            },
        })

        return NextResponse.json({ success: true, data: blog }, { status: 201 })
    } catch (error) {
        console.error('POST /api/blogs error:', error)
        return NextResponse.json(
            { success: false, error: { code: 'SERVER_ERROR', details: 'Failed to create blog post' } },
            { status: 500 }
        )
    }
})
