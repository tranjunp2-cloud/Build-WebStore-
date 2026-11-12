import { ListingSelectionSchema } from '@/lib/products/listing-selection'
import { isCachedSiteUnavailable } from '@/lib/storefront/cached-store-availability'
import { getCategoryDescendantIds } from '@/lib/products/category-descendants'
import { NextResponse } from 'next/server'
import { getPayload, type Where } from 'payload'
import config from '@payload-config'
import { checkRateLimit } from '@/lib/rateLimit'
import { findAllPayloadDocs } from '@/lib/payload/find-all-pages'

interface AttributeRow {
    key?: string
    value?: string
}

export const maxDuration = 60

/**
 * GET /api/storefront/products/bounds — Public endpoint for storefront filter UI schema.
 * Returns global price range + distinct attribute value map over active products. No auth required.
 * Query params: site (required)
 */
export async function GET(req: Request) {
    try {
        const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
            || req.headers.get('x-real-ip')?.trim()
            || 'unknown'
        const rateCheck = await checkRateLimit(`storefront-bounds:${ip}`, 60, 60_000)
        if (!rateCheck.allowed) {
            return NextResponse.json({ error: 'Too many requests' }, {
                status: 429,
                headers: { 'Retry-After': String(Math.ceil((rateCheck.resetAt - Date.now()) / 1000)) },
            })
        }

        const url = new URL(req.url)
        const siteId = url.searchParams.get('site')

        if (!siteId) {
            return NextResponse.json({ minPrice: 0, maxPrice: 0, attributes: [] })
        }

        const siteIdNum = parseInt(siteId, 10)
        if (!Number.isInteger(siteIdNum) || siteIdNum <= 0 || String(siteIdNum) !== siteId) {
            return NextResponse.json({ minPrice: 0, maxPrice: 0, attributes: [] })
        }

        const parsed = ListingSelectionSchema.safeParse({
            mode: url.searchParams.get('selectionMode') ?? undefined,
            ids: url.searchParams.getAll('productId'),
            category: url.searchParams.get('fixedCategoryId') ?? undefined,
            includeOutOfStock: url.searchParams.get('includeOutOfStock') ?? undefined,
        })
        if (!parsed.success) return NextResponse.json({ error: 'Invalid product scope' }, { status: 400 })
        const selection = parsed.data
        const payload = await getPayload({ config })
        // #2179: banned or expired store answers like an unknown one (no reason given)
        if (await isCachedSiteUnavailable(siteIdNum)) return NextResponse.json({ minPrice: 0, maxPrice: 0, attributes: [] })

        const where: Where = {
            and: [
                { site: { equals: siteIdNum } },
                { status: { equals: 'active' } },
                { deletedAt: { exists: false } },
            ],
        }

        if (selection.category) {
            const ids = await getCategoryDescendantIds(payload, siteIdNum, [Number(selection.category)])
            if (!ids) return NextResponse.json({ minPrice: 0, maxPrice: 0, attributes: [] })
            ;(where.and as Where[]).push({ category: { in: ids } })
        }
        if (selection.mode === 'fixed') {
            if (!selection.ids.length) return NextResponse.json({ minPrice: 0, maxPrice: 0, attributes: [] })
            ;(where.and as Where[]).push({ id: { in: selection.ids.map(Number) } })
        }
        if (selection.includeOutOfStock === 'false') {
            ;(where.and as Where[]).push({ or: [
                { and: [{ hasVariants: { not_equals: true } }, { inventory: { greater_than: 0 } }] },
                { and: [{ hasVariants: { equals: true } }, { 'variants.stock': { greater_than: 0 } }] },
            ] })
        }

        const allProducts = await findAllPayloadDocs<{
            category?: number | string | { id: number | string } | null
            currency?: string | null
            price?: number | null
            attributes?: AttributeRow[] | null
        }>(payload, {
            collection: 'products',
            where,
            depth: 0,
            overrideAccess: true,
            select: { price: true, attributes: true, currency: true, category: true },
        }, 1000)

        let minPrice = 0
        let maxPrice = 0
        const attributeMap = new Map<string, Set<string>>()

        allProducts.forEach((doc, index) => {
            const price = typeof doc.price === 'number' ? doc.price : null
            if (price !== null && index === 0) {
                minPrice = price
                maxPrice = price
            } else if (price !== null) {
                if (price < minPrice) minPrice = price
                if (price > maxPrice) maxPrice = price
            }

            if (Array.isArray(doc.attributes)) {
                for (const attr of doc.attributes as AttributeRow[]) {
                    if (!attr?.key || !attr?.value) continue
                    if (!attributeMap.has(attr.key)) attributeMap.set(attr.key, new Set())
                    attributeMap.get(attr.key)!.add(attr.value)
                }
            }
        })

        const attributes = Array.from(attributeMap.entries())
            .sort(([left], [right]) => left.localeCompare(right))
            .map(([key, values]) => ({
                key,
                values: Array.from(values).sort(),
            }))

        const categoryIds = [...new Set(allProducts.flatMap(product => product.category ? [String(typeof product.category === 'object' ? product.category.id : product.category)] : []))]
        return NextResponse.json({ minPrice, maxPrice, attributes, categoryIds, currency: allProducts.find(product => product.currency)?.currency ?? undefined })
    } catch (error) {
        console.error('[Storefront Products Bounds API]', error)
        return NextResponse.json({ minPrice: 0, maxPrice: 0, attributes: [] }, { status: 500 })
    }
}
