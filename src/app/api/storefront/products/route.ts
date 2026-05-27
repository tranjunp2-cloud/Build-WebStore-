import { NextResponse } from 'next/server'
import { getPayload, type Where } from 'payload'
import config from '@payload-config'
import { checkRateLimit } from '@/lib/rateLimit'

const ALLOWED_SORT = new Set(['-createdAt', 'createdAt', '-price', 'price', '-name', 'name'])

/**
 * GET /api/storefront/products — Public endpoint for storefront product listing.
 * Returns only active, non-deleted products. No auth required.
 * Query params: site (required), limit, page, sort
 */
export async function GET(req: Request) {
    try {
        const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
            || req.headers.get('x-real-ip')?.trim()
            || 'unknown'
        const rateCheck = await checkRateLimit(`storefront-products:${ip}`, 60, 60_000)
        if (!rateCheck.allowed) {
            return NextResponse.json({ error: 'Too many requests' }, {
                status: 429,
                headers: { 'Retry-After': String(Math.ceil((rateCheck.resetAt - Date.now()) / 1000)) },
            })
        }

        const url = new URL(req.url)
        const siteId = url.searchParams.get('site')
        const limit = Math.min(Math.max(1, parseInt(url.searchParams.get('limit') || '12') || 12), 100)
        const page = Math.max(1, parseInt(url.searchParams.get('page') || '1') || 1)
        const sortRaw = url.searchParams.get('sort') || '-createdAt'
        const sort = ALLOWED_SORT.has(sortRaw) ? sortRaw : '-createdAt'

        if (!siteId) {
            return NextResponse.json({ docs: [], totalDocs: 0 })
        }

        // Reject non-numeric site IDs to prevent Payload from throwing on integer-cast
        const siteIdNum = parseInt(siteId, 10)
        if (!Number.isInteger(siteIdNum) || siteIdNum <= 0 || String(siteIdNum) !== siteId) {
            return NextResponse.json({ docs: [], totalDocs: 0 })
        }

        const payload = await getPayload({ config })

        const where: Where = {
            and: [
                { site: { equals: siteIdNum } },
                { status: { equals: 'active' } },
                { deletedAt: { exists: false } },
            ],
        }

        const result = await payload.find({
            collection: 'products',
            where,
            limit,
            page,
            sort,
            depth: 2,
            overrideAccess: true,
        })

        // Strip tenant/site relationship data — prevents PII/secrets leak via depth:2 expansion
        const docs = result.docs.map((doc) => ({
            id: doc.id,
            name: doc.name,
            slug: doc.slug,
            shortDescription: doc.shortDescription,
            price: doc.price,
            compareAtPrice: doc.compareAtPrice,
            currency: doc.currency,
            images: doc.images,
            status: doc.status,
            hasVariants: doc.hasVariants ?? false,
            inventory: typeof doc.inventory === 'number' ? doc.inventory : 0,
            variants: Array.isArray(doc.variants)
                ? doc.variants.map((v: Record<string, unknown>) => ({
                      name: v.name,
                      price: v.price,
                      compareAtPrice: v.compareAtPrice ?? null,
                      stock: v.stock ?? 0,
                  }))
                : [],
        }))

        return NextResponse.json({
            docs,
            totalDocs: result.totalDocs,
            page: result.page,
            totalPages: result.totalPages,
        })
    } catch (error) {
        console.error('[Storefront Products API]', error)
        return NextResponse.json({ docs: [], totalDocs: 0 }, { status: 500 })
    }
}
