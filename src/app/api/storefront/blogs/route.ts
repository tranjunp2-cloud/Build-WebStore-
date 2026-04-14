import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'

/**
 * GET /api/storefront/blogs — Public endpoint for storefront blog listing.
 * Returns only published blogs. No auth required.
 * Query params: tenant, limit, sort, page, category
 */
export async function GET(req: Request) {
    try {
        const url = new URL(req.url)
        const tenantId = url.searchParams.get('tenant')
        const limit = parseInt(url.searchParams.get('limit') || '12')
        const page = parseInt(url.searchParams.get('page') || '1')
        const sort = url.searchParams.get('sort') || '-createdAt'
        const category = url.searchParams.get('category')
        const search = url.searchParams.get('search')?.trim()

        if (!tenantId) {
            return NextResponse.json({ docs: [], totalDocs: 0 })
        }

        const payload = await getPayload({ config })

        const where: Record<string, any> = {
            tenant: { equals: tenantId },
            status: { equals: 'published' },
        }

        if (category) {
            where['category.slug'] = { equals: category }
        }
        if (search) {
            where.title = { contains: search }
        }

        const result = await payload.find({
            collection: 'blogs',
            where,
            limit,
            page,
            sort,
            depth: 2,
            overrideAccess: true,
        })

        return NextResponse.json({
            docs: result.docs,
            totalDocs: result.totalDocs,
            page: result.page,
            totalPages: result.totalPages,
        })
    } catch (error) {
        console.error('[Storefront Blogs API]', error)
        return NextResponse.json({ docs: [], totalDocs: 0 }, { status: 500 })
    }
}
