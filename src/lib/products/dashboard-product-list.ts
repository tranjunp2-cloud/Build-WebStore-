import type { Payload } from 'payload'
import { selectProductPage, productPageInputSchema, productCandidateSchema } from './dashboard-product-pagination'
import { tenantIdForQuery } from '@/lib/auth'
import type { getCurrentUser } from '@/lib/auth'

type AuthenticatedUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>

/**
 * Canonical Products Dashboard read used by both the UI server action and the
 * authenticated HTTP endpoint exercised by load tests.
 */
async function findProductsBatch(payload: Payload, user: AuthenticatedUser, page = 1, ids?: number[]) {
    const tenantId = tenantIdForQuery(user)
    const result = await payload.find({
        collection: 'products',
        user,
        overrideAccess: false,
        where: {
            and: [
                { deletedAt: { exists: false } },
                ...(ids ? [{ id: { in: ids } }] : []),
                ...(tenantId != null ? [{ tenant: { equals: tenantId } }] : []),
            ],
        },
        limit: 100,
        pagination: true,
        page,
        sort: ['-createdAt', '-id'],
        depth: 1,
        // Keep the list/quick-view contract while excluding large edit-only fields
        // such as SEO, BM description, tags, variant configs, dimensions, and halal data.
        select: {
            name: true,
            slug: true,
            sku: true,
            shortDescription: true,
            description: true,
            price: true,
            compareAtPrice: true,
            currency: true,
            status: true,
            inventory: true,
            weight: true,
            category: true,
            images: {
                image: true,
                alt: true,
            },
            createdAt: true,
            updatedAt: true,
            hasVariants: true,
            variants: {
                name: true,
                sku: true,
                price: true,
                compareAtPrice: true,
                stock: true,
            },
            attributes: {
                key: true,
                value: true,
            },
            aiReviewPending: true,
        },
        populate: {
            media: {
                url: true,
                thumbnailURL: true,
            },
            categories: {
                name: true,
                breadcrumbs: true,
            },
        },
    })

    return result
}


/** Legacy array callers still receive the complete authorized inventory. */
export async function findDashboardProducts(payload: Payload, user: AuthenticatedUser) {
    const first = await findProductsBatch(payload, user)
    const docs = [...first.docs]
    for (let page = 2; page <= first.totalPages; page++) docs.push(...(await findProductsBatch(payload, user, page)).docs)
    return docs
}

export async function findDashboardProductPage(payload: Payload, user: AuthenticatedUser, input: unknown = {}) {
    const options = productPageInputSchema.parse(input)
    const tenantId = tenantIdForQuery(user)
    // Scan only lightweight filter/sort fields. Rich text and image relations are
    // hydrated for the chosen page, never for the entire catalog.
    const candidates = []
    let page = 1
    while (true) {
        const result = await payload.find({
            collection: 'products', user, overrideAccess: false,
            where: { and: [{ deletedAt: { exists: false } }, ...(tenantId != null ? [{ tenant: { equals: tenantId } }] : [])] },
            limit: 100, page, pagination: true, sort: ['-createdAt', '-id'], depth: 1,
            select: { name: true, sku: true, status: true, inventory: true, price: true, compareAtPrice: true, hasVariants: true, variants: { price: true }, category: true, createdAt: true },
            populate: { categories: { name: true } },
        })
        candidates.push(...result.docs.map(doc => productCandidateSchema.parse(doc)))
        if (!result.hasNextPage) break
        page++
    }
    const selected = selectProductPage(candidates, options)
    const result = selected.ids.length ? await findProductsBatch(payload, user, 1, selected.ids) : { docs: [] }
    const byId = new Map(result.docs.map(doc => [doc.id, doc]))
    return { ...selected, docs: selected.ids.flatMap(id => { const doc = byId.get(id); return doc ? [doc] : [] }) }
}
