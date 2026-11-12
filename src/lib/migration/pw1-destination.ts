import { z } from 'zod'
import type { Payload, PayloadRequest } from 'payload'
import { MigrationError } from './pw1-errors'

const PositiveId = z.number().int().positive().safe()
const CategoryMapping = z.object({
    sourceId: z.string().regex(/^\d+$/),
    destinationId: PositiveId,
    listingPageId: z.string().regex(/^\d+$/),
    sourcePath: z.string().regex(/^\/(?:[a-z0-9-]+)?$/).default('/products'),
}).strict()
export type VerifiedCategoryMapping = z.infer<typeof CategoryMapping>
/** Prepared masters declare bare destination IDs; the source side is resolved
 *  from migration_entity_map at runtime. Explicit object mappings stay supported. */
export const DestinationSchema = z.object({
    tenantId: PositiveId,
    siteId: PositiveId,
    productCategories: z.array(z.union([PositiveId, CategoryMapping])).default([]),
}).strict().superRefine((value, ctx) => {
    const seen = new Set<string>()
    for (const item of value.productCategories) {
        const key = typeof item === 'number' ? `id:${item}` : `${item.sourcePath}:${item.sourceId}`
        if (seen.has(key)) ctx.addIssue({code:'custom',message:`Duplicate category mapping ${key}`})
        seen.add(key)
    }
})
export type MigrationDestination = z.infer<typeof DestinationSchema>
const categoryDestinationId = (item: number | VerifiedCategoryMapping) => typeof item === 'number' ? item : item.destinationId
const relationId = (value: unknown): string => String(value && typeof value === 'object' && 'id' in value ? value.id : value)

export function assertDestinationOwnership(destination: MigrationDestination, site: {id:unknown;tenant?:unknown;status?:unknown}, memberships: Array<{tenant?:unknown;role?:unknown;status?:unknown}>, allowPublished = false) {
    if (relationId(site.id) !== String(destination.siteId) || relationId(site.tenant) !== String(destination.tenantId)) throw new MigrationError('BE_MAPPING_INVALID','Destination site does not belong to the declared tenant')
    if (site.status !== 'draft' && !(allowPublished && site.status === 'published')) throw new MigrationError('PUBLISHED_SITE','BE destination must be a draft before migration')
    if (!memberships.some(m => relationId(m.tenant) === String(destination.tenantId) && m.role === 'owner' && m.status === 'active')) throw new MigrationError('BE_MAPPING_INVALID','Source account is not an active owner of the destination tenant')
}

export function assertCategoryScope(destination: MigrationDestination, docs: Array<{id:unknown;tenant?:unknown;site?:unknown;deletedAt?:unknown}>) {
    for (const mapping of destination.productCategories) {
        const destinationId = categoryDestinationId(mapping)
        const doc = docs.find(d => relationId(d.id) === String(destinationId))
        if (!doc || doc.deletedAt || relationId(doc.tenant) !== String(destination.tenantId) || relationId(doc.site) !== String(destination.siteId)) throw new MigrationError('BE_MAPPING_INVALID',`Category ${destinationId} is missing, deleted or outside destination scope`)
    }
}

/** Explicit operator mapping is the identity evidence; DB checks verify ownership and current availability. */
export async function verifyMigrationDestination(payload: Payload, destination: MigrationDestination, email: string, req?: Pick<PayloadRequest,'transactionID'>, allowPublished = false) {
    const user = await payload.find({collection:'users',where:{email:{equals:email}},limit:2,depth:0,req})
    if (user.docs.length !== 1) throw new MigrationError('BE_MAPPING_INVALID','Destination owner must already exist uniquely')
    const site = await payload.findByID({collection:'sites',id:destination.siteId,depth:0,req})
    assertDestinationOwnership(destination,site,user.docs[0].tenants ?? [], allowPublished)
    const ids = [...new Set(destination.productCategories.map(categoryDestinationId))]
    const docs = ids.length ? (await payload.find({collection:'categories',where:{and:[{id:{in:ids}},{tenant:{equals:destination.tenantId}},{site:{equals:destination.siteId}},{deletedAt:{exists:false}}]},pagination:false,depth:0,req})).docs : []
    assertCategoryScope(destination,docs)
    return user.docs[0]
}

type IdMapQuery = (text: string, params: unknown[]) => Promise<{ rows: Array<{ source_id: string; target_id: string }> }>
/** Bare destination IDs (prepared masters) pair with source IDs via the BE import's
 *  verified entity map; each pair applies to every source product-listing page. */
export async function resolveDeclaredCategories(
    query: IdMapQuery,
    productCategories: ReadonlyArray<number | VerifiedCategoryMapping>,
    listingPages: ReadonlyArray<{ sourceId: string; path: string }>,
): Promise<{ mappings: VerifiedCategoryMapping[]; unresolved: number[] }> {
    const mappings = productCategories.filter((c): c is VerifiedCategoryMapping => typeof c === 'object')
    const ids = [...new Set(productCategories.filter((c): c is number => typeof c === 'number'))]
    if (!ids.length) return { mappings, unresolved: [] }
    const { rows } = await query(
        `SELECT source_id, target_id FROM migration_entity_map
         WHERE source_entity='categories' AND target_collection='categories' AND state='VERIFIED' AND target_id = ANY($1)`,
        [ids.map(String)])
    const sourceByTarget = new Map(rows.map(r => [Number(r.target_id), r.source_id]))
    const unresolved = ids.filter(id => !sourceByTarget.has(id))
    const declared = new Set(mappings.map(m => `${m.sourcePath}:${m.sourceId}`))
    for (const id of ids) {
        const sourceId = sourceByTarget.get(id)
        if (!sourceId) continue
        for (const page of listingPages) {
            const key = `${page.path}:${sourceId}`
            if (declared.has(key)) continue
            declared.add(key)
            mappings.push({ sourceId, destinationId: id, listingPageId: page.sourceId, sourcePath: page.path })
        }
    }
    return { mappings, unresolved }
}
