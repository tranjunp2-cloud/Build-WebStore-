import { z } from 'zod'
import type { Payload, PayloadRequest } from 'payload'
import { MigrationError } from './pw1-errors'

const PositiveId = z.number().int().positive().safe()
export const DestinationSchema = z.object({
    tenantId: PositiveId,
    siteId: PositiveId,
    productCategories: z.array(z.object({
        sourceId: z.string().regex(/^\d+$/),
        destinationId: PositiveId,
        listingPageId: z.string().regex(/^\d+$/),
        sourcePath: z.string().regex(/^\/(?:[a-z0-9-]+)?$/).default('/products'),
    }).strict()).default([]),
}).strict().superRefine((value, ctx) => {
    const seen = new Set<string>()
    for (const item of value.productCategories) {
        const key = `${item.sourcePath}:${item.sourceId}`
        if (seen.has(key)) ctx.addIssue({code:'custom',message:`Duplicate category mapping ${key}`})
        seen.add(key)
    }
})
export type MigrationDestination = z.infer<typeof DestinationSchema>
const relationId = (value: unknown): string => String(value && typeof value === 'object' && 'id' in value ? value.id : value)

export function assertDestinationOwnership(destination: MigrationDestination, site: {id:unknown;tenant?:unknown;status?:unknown}, memberships: Array<{tenant?:unknown;role?:unknown;status?:unknown}>, allowPublished = false) {
    if (relationId(site.id) !== String(destination.siteId) || relationId(site.tenant) !== String(destination.tenantId)) throw new MigrationError('BE_MAPPING_INVALID','Destination site does not belong to the declared tenant')
    if (site.status !== 'draft' && !(allowPublished && site.status === 'published')) throw new MigrationError('PUBLISHED_SITE','BE destination must be a draft before migration')
    if (!memberships.some(m => relationId(m.tenant) === String(destination.tenantId) && m.role === 'owner' && m.status === 'active')) throw new MigrationError('BE_MAPPING_INVALID','Source account is not an active owner of the destination tenant')
}

export function assertCategoryScope(destination: MigrationDestination, docs: Array<{id:unknown;tenant?:unknown;site?:unknown;deletedAt?:unknown}>) {
    for (const mapping of destination.productCategories) {
        const doc = docs.find(d => relationId(d.id) === String(mapping.destinationId))
        if (!doc || doc.deletedAt || relationId(doc.tenant) !== String(destination.tenantId) || relationId(doc.site) !== String(destination.siteId)) throw new MigrationError('BE_MAPPING_INVALID',`Category ${mapping.destinationId} is missing, deleted or outside destination scope`)
    }
}

/** Explicit operator mapping is the identity evidence; DB checks verify ownership and current availability. */
export async function verifyMigrationDestination(payload: Payload, destination: MigrationDestination, email: string, req?: Pick<PayloadRequest,'transactionID'>, allowPublished = false) {
    const user = await payload.find({collection:'users',where:{email:{equals:email}},limit:2,depth:0,req})
    if (user.docs.length !== 1) throw new MigrationError('BE_MAPPING_INVALID','Destination owner must already exist uniquely')
    const site = await payload.findByID({collection:'sites',id:destination.siteId,depth:0,req})
    assertDestinationOwnership(destination,site,user.docs[0].tenants ?? [], allowPublished)
    const ids = [...new Set(destination.productCategories.map(c=>c.destinationId))]
    const docs = ids.length ? (await payload.find({collection:'categories',where:{and:[{id:{in:ids}},{tenant:{equals:destination.tenantId}},{site:{equals:destination.siteId}},{deletedAt:{exists:false}}]},pagination:false,depth:0,req})).docs : []
    assertCategoryScope(destination,docs)
    return user.docs[0]
}
