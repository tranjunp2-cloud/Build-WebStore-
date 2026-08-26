import { NextResponse } from 'next/server'
import { getPayload, type Where, type Payload } from 'payload'
import config from '@payload-config'
import { checkRateLimit } from '@/lib/rateLimit'

export const maxDuration = 60

const ALLOWED_SORT = new Set(['-createdAt', 'createdAt', '-price', 'price', '-name', 'name'])
const CATEGORY_PAGE_SIZE = 500

type CategoryLookupRow = {
    id: number | string
    parent?: number | string | { id?: number | string } | null
}

async function getCategoryDescendantIds(payload: Payload, siteId: number, categoryIds: number[]): Promise<number[] | null> {
    const idToParent = new Map<number, number | null>()
    let currentPage = 1
    let totalPages = 1

    while (currentPage <= totalPages) {
        const categoriesResult = await payload.find({
            collection: 'categories',
            where: { and: [{ site: { equals: siteId } }, { deletedAt: { exists: false } }] },
            limit: CATEGORY_PAGE_SIZE,
            page: currentPage,
            depth: 0,
            overrideAccess: true,
            select: { id: true, parent: true },
        })

        totalPages = categoriesResult.totalPages || 1
        categoriesResult.docs.forEach((doc) => {
            const row = doc as unknown as CategoryLookupRow
            const parentRaw = row.parent
            const parentId = typeof parentRaw === 'object' && parentRaw !== null ? parentRaw.id : parentRaw
            idToParent.set(Number(row.id), parentId ? Number(parentId) : null)
        })
        currentPage += 1
    }

    const validSeedIds = Array.from(new Set(categoryIds.filter((id) => idToParent.has(id))))
    if (validSeedIds.length === 0) return null

    const descendantIds = new Set<number>(validSeedIds)
    let changed = true

    while (changed) {
        changed = false
        idToParent.forEach((parentId, id) => {
            if (parentId !== null && descendantIds.has(parentId) && !descendantIds.has(id)) {
                descendantIds.add(id)
                changed = true
            }
        })
    }

    return Array.from(descendantIds)
}

/**
 * GET /api/storefront/products — Public endpoint for storefront product listing.
 * Returns only active, non-deleted products. No auth required.
 * Query params: site (required), limit, page, sort, categoryId (repeatable), minPrice, maxPrice, search, attr_<key> (repeatable)
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

        const categoryIds = Array.from(new Set(
            url.searchParams
                .getAll('categoryId')
                .map((value) => value.trim())
                .filter(Boolean)
                .map((value) => {
                    const parsed = parseInt(value, 10)
                    return Number.isInteger(parsed) && parsed > 0 && String(parsed) === value ? parsed : null
                })
                .filter((value): value is number => value !== null),
        ))
        if (categoryIds.length > 0) {
            const descendantIds = await getCategoryDescendantIds(payload, siteIdNum, categoryIds)
            if (!descendantIds) {
                return NextResponse.json({ docs: [], totalDocs: 0, page, totalPages: 1 })
            }
            ;(where.and as Where[]).push({ category: { in: descendantIds } })
        }

        const minPriceRaw = url.searchParams.get('minPrice')
        const maxPriceRaw = url.searchParams.get('maxPrice')
        const minPrice = minPriceRaw !== null ? Number(minPriceRaw) : NaN
        const maxPrice = maxPriceRaw !== null ? Number(maxPriceRaw) : NaN
        if (Number.isFinite(minPrice) && minPrice >= 0) {
            ;(where.and as Where[]).push({ price: { greater_than_equal: minPrice } })
        }
        if (Number.isFinite(maxPrice) && maxPrice >= 0) {
            ;(where.and as Where[]).push({ price: { less_than_equal: maxPrice } })
        }

        const search = url.searchParams.get('search')?.trim()
        if (search) {
            ;(where.and as Where[]).push({
                or: [
                    { name: { contains: search } },
                    { shortDescription: { contains: search } },
                ],
            } as Where)
        }

        const attrKeys = new Set<string>()
        url.searchParams.forEach((_value, key) => {
            if (key.startsWith('attr_') && key.length > 5) attrKeys.add(key)
        })
        attrKeys.forEach((paramKey) => {
            const attrKey = paramKey.slice(5).trim()
            const values = url.searchParams.getAll(paramKey).map((value) => value.trim()).filter(Boolean)
            if (attrKey && values.length > 0) {
                ;(where.and as Where[]).push({
                    attributes: { elemMatch: { and: [{ key: { equals: attrKey } }, { value: { in: values } }] } },
                } as Where)
            }
        })

        const result = await payload.find({
            collection: 'products',
            where,
            limit,
            page,
            sort,
            depth: 2,
            overrideAccess: true,
        })

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
            category: doc.category && typeof doc.category === 'object'
                ? {
                    id: (doc.category as { id?: number | string }).id ?? null,
                    name: (doc.category as { name?: string }).name ?? null,
                    slug: (doc.category as { slug?: string }).slug ?? null,
                }
                : null,
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
