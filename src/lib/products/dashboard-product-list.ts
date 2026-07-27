import type { Payload } from 'payload'
import { tenantIdForQuery } from '@/lib/auth'
import type { getCurrentUser } from '@/lib/auth'

type AuthenticatedUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>

/**
 * Canonical Products Dashboard read used by both the UI server action and the
 * authenticated HTTP endpoint exercised by load tests.
 */
export async function findDashboardProducts(payload: Payload, user: AuthenticatedUser) {
    const tenantId = tenantIdForQuery(user)
    const result = await payload.find({
        collection: 'products',
        user,
        overrideAccess: false,
        where: {
            and: [
                { deletedAt: { exists: false } },
                ...(tenantId != null ? [{ tenant: { equals: tenantId } }] : []),
            ],
        },
        limit: 100,
        pagination: false,
        sort: '-createdAt',
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

    return result.docs
}
