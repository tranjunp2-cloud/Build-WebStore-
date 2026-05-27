import { NextResponse } from 'next/server'
import { getPayload, type Where } from 'payload'
import config from '@payload-config'
import { checkRateLimit } from '@/lib/rateLimit'

/**
 * GET /api/storefront/blogs — Public endpoint for storefront blog listing.
 * Returns only published blogs. No auth required.
 * Query params: tenant, limit, sort, page, category
 */
export async function GET(req: Request) {
    try {
        const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
            || req.headers.get('x-real-ip')?.trim()
            || 'unknown'
        const rateCheck = await checkRateLimit(`storefront-blogs:${ip}`, 60, 60_000)
        if (!rateCheck.allowed) {
            return NextResponse.json({ error: 'Too many requests' }, {
                status: 429,
                headers: { 'Retry-After': String(Math.ceil((rateCheck.resetAt - Date.now()) / 1000)) },
            })
        }

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

        const conditions: Where[] = [
            { tenant: { equals: tenantId } },
            { status: { equals: 'published' } },
        ]

        if (category) {
            // Payload does not support dot-notation on relationship fields.
            // Two-step lookup: find the category doc by slug, then filter blogs by category ID.
            const catResult = await payload.find({
                collection: 'blog_categories',
                where: {
                    and: [
                        { slug: { equals: category } },
                        { tenant: { equals: tenantId } },
                    ],
                },
                limit: 1,
                overrideAccess: true,
            })
            const catId = catResult.docs[0]?.id
            if (catId) {
                conditions.push({ category: { equals: catId } })
            } else {
                // Category slug not found — return empty (no match)
                return NextResponse.json({ docs: [], totalDocs: 0, page: 1, totalPages: 0 })
            }
        }
        if (search) {
            conditions.push({ title: { contains: search } })
        }
        const where: Where = { and: conditions }

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
