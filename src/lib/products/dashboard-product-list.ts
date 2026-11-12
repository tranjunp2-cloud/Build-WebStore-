import type { Payload } from 'payload'
import { selectProductPage, productPageInputSchema, productCandidateSchema } from './dashboard-product-pagination'
import { tenantIdForQuery } from '@/lib/auth'
import type { getCurrentUser } from '@/lib/auth'

type AuthenticatedUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>

/**
 * Canonical Products Dashboard read used by both the UI server action and the
 * authenticated HTTP endpoint exercised by load tests.
 */
async function findProductsBatch(payload: Payload, user: AuthenticatedUser, ids?: number[]) {
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
        // One statement for the whole set (plus one per populated collection): no page loop, no COUNT.
        limit: 0,
        pagination: false,
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


/** Legacy array callers still receive the complete authorized inventory (one read, TC-PERF-053). */
export async function findDashboardProducts(payload: Payload, user: AuthenticatedUser) {
    return (await findProductsBatch(payload, user)).docs
}

export async function findDashboardProductPage(payload: Payload, user: AuthenticatedUser, input: unknown = {}) {
    const options = productPageInputSchema.parse(input)
    const tenantId = tenantIdForQuery(user)
    // Scan only lightweight filter/sort fields, in one read: one products statement (variant prices joined in) and
    // one categories statement, whatever the catalog size. This walked 100-row pages one after the other with a
    // COUNT each — 3 statements per 100 products, on every keystroke of the search box (TC-PERF-053).
    // Rich text and image relations are hydrated for the chosen page only.
    const scan = await payload.find({
        collection: 'products', user, overrideAccess: false,
        where: { and: [{ deletedAt: { exists: false } }, ...(tenantId != null ? [{ tenant: { equals: tenantId } }] : [])] },
        limit: 0, pagination: false, sort: ['-createdAt', '-id'], depth: 1,
        select: { name: true, sku: true, status: true, inventory: true, price: true, compareAtPrice: true, hasVariants: true, variants: { price: true }, category: true, createdAt: true },
        populate: { categories: { name: true } },
    })
    const candidates = scan.docs.map(doc => productCandidateSchema.parse(doc))
    const selected = selectProductPage(candidates, options)
    const result = selected.ids.length ? await findProductsBatch(payload, user, selected.ids) : { docs: [] }
    const byId = new Map(result.docs.map(doc => [doc.id, doc]))
    return { ...selected, docs: selected.ids.flatMap(id => { const doc = byId.get(id); return doc ? [doc] : [] }) }
}
