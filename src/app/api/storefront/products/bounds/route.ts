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

        const payload = await getPayload({ config })

        const where: Where = {
            and: [
                { site: { equals: siteIdNum } },
                { status: { equals: 'active' } },
                { deletedAt: { exists: false } },
            ],
        }

        const allProducts = await findAllPayloadDocs<{
            price?: number | null
            attributes?: AttributeRow[] | null
        }>(payload, {
            collection: 'products',
            where,
            depth: 0,
            overrideAccess: true,
            select: { price: true, attributes: true },
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

        return NextResponse.json({ minPrice, maxPrice, attributes })
    } catch (error) {
        console.error('[Storefront Products Bounds API]', error)
        return NextResponse.json({ minPrice: 0, maxPrice: 0, attributes: [] }, { status: 500 })
    }
}
