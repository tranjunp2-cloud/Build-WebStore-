import { productSummaryText } from '@/lib/products/product-summary-text'
import { getCategoryDescendantIds } from '@/lib/products/category-descendants'
import { isCachedSiteUnavailable } from '@/lib/storefront/cached-store-availability'
import { ListingSelectionSchema, orderListingIds } from '@/lib/products/listing-selection'
import { NextResponse } from 'next/server'
import { getPayload, type Where } from 'payload'
import config from '@payload-config'
import { checkRateLimit } from '@/lib/rateLimit'

export const maxDuration = 60

const ALLOWED_SORT = new Set(['-createdAt', 'createdAt', '-price', 'price', '-name', 'name'])
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
        // GH-2378: rendering descriptions is costly, so only callers that show it (quick view) ask for it
        const withSummary = url.searchParams.get('summary') === '1'
        const sortRaw = url.searchParams.get('sort') || '-createdAt'
        const sort = ALLOWED_SORT.has(sortRaw) ? sortRaw : '-createdAt'

        if (!siteId) {
            return NextResponse.json({ docs: [], totalDocs: 0 })
        }

        const siteIdNum = parseInt(siteId, 10)
        if (!Number.isInteger(siteIdNum) || siteIdNum <= 0 || String(siteIdNum) !== siteId) {
            return NextResponse.json({ docs: [], totalDocs: 0 })
        }

        const selectionResult = ListingSelectionSchema.safeParse({
            mode: url.searchParams.get('selectionMode') ?? undefined,
            ids: url.searchParams.getAll('productId'),
            includeOutOfStock: url.searchParams.get('includeOutOfStock') ?? undefined,
            seed: url.searchParams.get('seed') ?? undefined,
            category: url.searchParams.get('fixedCategoryId') ?? undefined,
        })
        if (!selectionResult.success) return NextResponse.json({ error: 'Invalid listing selection' }, { status: 400 })
        const selection = selectionResult.data
        const payload = await getPayload({ config })
        // #2179: banned or expired store answers like an unknown one (no reason given)
        if (await isCachedSiteUnavailable(siteIdNum)) return NextResponse.json({ docs: [], totalDocs: 0 })

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

        if (selection.category) {
            const ids = await getCategoryDescendantIds(payload, siteIdNum, [Number(selection.category)])
            if (!ids) return NextResponse.json({ docs: [], totalDocs: 0, page, totalPages: 1 })
            ;(where.and as Where[]).push({ category: { in: ids } })
        }
        if (selection.mode === 'fixed') {
            if (!selection.ids.length) return NextResponse.json({ docs: [], totalDocs: 0, page, totalPages: 1 })
            ;(where.and as Where[]).push({ id: { in: selection.ids.map(Number) } })
        }
        if (selection.includeOutOfStock === 'false') {
            ;(where.and as Where[]).push({ or: [
                { and: [{ hasVariants: { not_equals: true } }, { inventory: { greater_than: 0 } }] },
                { and: [{ hasVariants: { equals: true } }, { 'variants.stock': { greater_than: 0 } }] },
            ] })
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

        let orderedPageIds: string[] | undefined
        let selectionTotal = 0
        if (selection.mode !== 'all') {
            const ids: string[] = []
            // Fetch IDs only before ordering; hydrate just the requested page below.
            let scanPage = 1
            let scanPages = 1
            do {
                const batch = await payload.find({ collection: 'products', where, limit: 500, page: scanPage,
                    sort: 'id', depth: 0, overrideAccess: true, select: { id: true } })
                ids.push(...batch.docs.map(doc => String(doc.id)))
                scanPages = batch.totalPages
                scanPage++
            } while (scanPage <= scanPages)
            const ordered = orderListingIds(ids, selection.mode, selection.ids, selection.seed)
            selectionTotal = ordered.length
            orderedPageIds = ordered.slice((page - 1) * limit, page * limit)
            if (!orderedPageIds.length) return NextResponse.json({ docs: [], totalDocs: selectionTotal, page, totalPages: Math.max(1, Math.ceil(selectionTotal / limit)) })
            ;(where.and as Where[]).push({ id: { in: orderedPageIds.map(Number) } })
        }
        const result = await payload.find({
            collection: 'products',
            where,
            limit,
            page: orderedPageIds ? 1 : page,
            sort,
            depth: 2,
            overrideAccess: true,
        })

        if (orderedPageIds) result.docs.sort((a, b) => orderedPageIds!.indexOf(String(a.id)) - orderedPageIds!.indexOf(String(b.id)))
        const docs = result.docs.map((doc) => ({
            id: doc.id,
            name: doc.name,
            slug: doc.slug,
            shortDescription: doc.shortDescription,
            ...(withSummary ? { summary: productSummaryText(doc as { shortDescription?: unknown; description?: unknown }, 300) } : {}),
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
            totalDocs: orderedPageIds ? selectionTotal : result.totalDocs,
            page,
            totalPages: orderedPageIds ? Math.max(1, Math.ceil(selectionTotal / limit)) : result.totalPages,
        })
    } catch (error) {
        console.error('[Storefront Products API]', error)
        return NextResponse.json({ docs: [], totalDocs: 0 }, { status: 500 })
    }
}
