import type { Payload } from 'payload'
import type { BatchEntry } from './pw1-batch-input'

export type Readiness = {
    status: 'not-required' | 'missing-data' | 'data-present-mapping-unverified'
    products: number | null
    publishedBlogs: number | null
    sourceMappingVerified: false
    warnings: string[]
}
export function summarizeReadiness(products: number | null, publishedBlogs: number | null): Readiness {
    const warnings: string[] = []
    if (products === 0) warnings.push('BE readiness: no active, undeleted destination site products for product listings')
    if (publishedBlogs === 0) warnings.push('BE readiness: no published destination tenant blogs for blog listings')
    const required = products !== null || publishedBlogs !== null
    if (required) warnings.push('BE source-to-destination identity mapping is not verified; record counts do not establish import parity')
    return { status: !required ? 'not-required' : products === 0 || publishedBlogs === 0 ? 'missing-data' : 'data-present-mapping-unverified', products, publishedBlogs, sourceMappingVerified: false, warnings }
}

/** Availability check using native renderer scopes; this does not certify BE import completeness. */
export async function checkBeReadiness(payload: Payload, entry: BatchEntry, mapping: { site_id: number; tenant_id: number }) {
    const bindings = entry.website.pages.flatMap(p => p.components.filter(c => c.enabled !== false).map(c => c.binding?.collection))
    const products = bindings.includes('products') ? (await payload.count({ collection: 'products', where: { and: [{ site: { equals: mapping.site_id } }, { status: { equals: 'active' } }, { deletedAt: { exists: false } }] } })).totalDocs : null
    const blogs = bindings.includes('blogs') ? (await payload.count({ collection: 'blogs', where: { and: [{ tenant: { equals: mapping.tenant_id } }, { status: { equals: 'published' } }] } })).totalDocs : null
    return summarizeReadiness(products, blogs)
}
