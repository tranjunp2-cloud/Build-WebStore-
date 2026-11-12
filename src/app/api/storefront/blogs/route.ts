import { NextResponse } from 'next/server'
import { isTenantIdUnavailable } from '@/lib/storefront/store-availability'
import { getPayload, type Where } from 'payload'
import config from '@payload-config'
import { checkRateLimit } from '@/lib/rateLimit'

const BLOG_CARD_SELECT = {
    title: true, slug: true, content: true, publishedAt: true, createdAt: true, updatedAt: true,
    category: true, thumbnail: true, seo: true,
} as const
const BLOG_CARD_POPULATE = {
    blog_categories: { name: true, slug: true },
    media: { alt: true, url: true, filename: true, mimeType: true, width: true, height: true, sizes: true },
} as const

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
        const includeCategories = url.searchParams.get('includeCategories') === '1'
        const search = url.searchParams.get('search')?.trim()

        if (!Number.isInteger(limit) || limit < 1 || limit > 100 || !Number.isInteger(page) || page < 1 || (tenantId && !/^[1-9]\d*$/.test(tenantId)) || !['createdAt', '-createdAt', 'publishedAt', '-publishedAt', 'title', '-title'].includes(sort)) return NextResponse.json({ error: 'Invalid listing parameters' }, { status: 400 })

        if (!tenantId) {
            return NextResponse.json({ docs: [], totalDocs: 0 })
        }

        const payload = await getPayload({ config })
        // #2179: banned or expired store answers like an unknown one (no reason given)
        if (await isTenantIdUnavailable(payload, tenantId)) return NextResponse.json({ docs: [], totalDocs: 0 })

        const conditions: Where[] = [
            { tenant: { equals: tenantId } },
            { status: { equals: 'published' } },
        ]

        const categories = includeCategories ? (await payload.find({ collection: 'blog_categories', where: { and: [{ tenant: { equals: tenantId } }, { status: { equals: 'active' } }] }, pagination: false, depth: 0, sort: 'name', select: { name: true, slug: true }, overrideAccess: true })).docs.map(cat => ({ id: cat.id, name: cat.name, slug: cat.slug })) : undefined

        if (category) {
            // Payload does not support dot-notation on relationship fields.
            // Two-step lookup: find the category doc by slug, then filter blogs by category ID.
            const catResult = await payload.find({
                collection: 'blog_categories',
                where: {
                    and: [
                        { slug: { equals: category } },
                        { status: { equals: 'active' } },
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
                return NextResponse.json({ docs: [], totalDocs: 0, page: 1, totalPages: 0, categories })
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
            // Public: only what the blog cards render. The default populate handed anyone the whole tenant row
            // (Xendit / EasyParcel / ECH secrets) and the author's user row (otpHash, keyString) (TC-PERF-128).
            select: BLOG_CARD_SELECT,
            depth: 1,
            populate: BLOG_CARD_POPULATE,
            overrideAccess: true,
        })

        return NextResponse.json({
            categories,
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
