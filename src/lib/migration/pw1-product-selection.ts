import { z } from 'zod'
import type { Payload } from 'payload'
import type { WebsiteBlueprint } from './pw1-contract'
import { MigrationError } from './pw1-errors'

export const SourceProductSelectionSchema = z.object({
    mode: z.enum(['all', 'fixed', 'random']),
    sourceCategoryId: z.string().regex(/^[1-9]\d*$/).optional(),
    sourceProductIds: z.array(z.string().regex(/^[1-9]\d*$/)),
    includeOutOfStock: z.boolean(),
})
type Query = (text: string, params: unknown[]) => Promise<{ rows: Array<{ source_id: string; target_id: string }> }>
const relationId = (value: unknown) => String(value && typeof value === 'object' && 'id' in value ? value.id : value)

export async function verifyProductSelectionScope(payload: Payload, blueprint: WebsiteBlueprint, siteId: number, tenantId: number) {
    for (const component of blueprint.nativeContract.pages.flatMap(page => page.components).filter(c => c.kind === 'product_listing')) {
        const block = component.block
        for (const collection of ['products', 'categories'] as const) {
            const ids = collection === 'products' ? (block.selectedProductIds as string[] | undefined) ?? [] : block.category ? [String(block.category)] : []
            if (!ids.length) continue
            const docs = (await payload.find({ collection, where: { and: [{ id: { in: ids.map(Number) } }, { site: { equals: siteId } }, { tenant: { equals: tenantId } }, { deletedAt: { exists: false } }] }, pagination: false, depth: 0 })).docs
            const found = new Set(docs.map(doc => relationId(doc.id)))
            const missing = ids.filter(id => !found.has(id))
            if (missing.length) throw new MigrationError('BE_MAPPING_INVALID', `Component ${component.sourceId}: ${collection} missing or outside destination scope: ${missing.join(',')}`)
        }
    }
}

/** Resolve only verified BE identities; never infer categories or products from names. */
export async function resolveProductSelections(query: Query, payload: Payload, blueprint: WebsiteBlueprint, siteId: number, tenantId: number) {
    for (const component of blueprint.nativeContract.pages.flatMap(page => page.components).filter(c => c.kind === 'product_listing')) {
        if (!component.block.sourceProductSelection) continue
        const selection = SourceProductSelectionSchema.parse(component.block.sourceProductSelection)
        async function resolveIds(collection: 'products' | 'categories', ids: string[]) {
            if (!ids.length) return []
            const { rows } = await query(`SELECT DISTINCT m.source_id, m.target_id FROM migration_entity_map m
                JOIN ${collection} d ON d.id::text=m.target_id
                WHERE m.source_entity=$1 AND m.target_collection=$1 AND m.state='VERIFIED'
                AND m.source_id=ANY($2::text[]) AND d.site_id=$3 AND d.tenant_id=$4 AND d.deleted_at IS NULL`, [collection, ids, siteId, tenantId])
            return ids.map(id => {
                const targets = [...new Set(rows.filter(row => row.source_id === id).map(row => row.target_id))]
                if (targets.length !== 1) throw new MigrationError('BE_MAPPING_INVALID', `Component ${component.sourceId}: source ${collection} ${id} needs exactly one verified destination mapping`)
                return targets[0]
            })
        }
        component.block.selectionMode = selection.mode
        component.block.includeOutOfStock = selection.includeOutOfStock
        component.block.selectedProductIds = await resolveIds('products', selection.mode === 'fixed' ? selection.sourceProductIds : [])
        component.block.category = selection.mode === 'random' && selection.sourceCategoryId ? (await resolveIds('categories', [selection.sourceCategoryId]))[0] : ''
    }
    await verifyProductSelectionScope(payload, blueprint, siteId, tenantId)
}
