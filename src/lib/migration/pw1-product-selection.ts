import { z } from 'zod'
import type { Payload } from 'payload'
import type { WebsiteBlueprint } from './pw1-contract'
import { MigrationError } from './pw1-errors'
import { categoriesMappedOutsideScope, productsNotEmittedByBe, type SelectionQuery } from './pw1-selection-evidence'

export const SourceProductSelectionSchema = z.object({
    mode: z.enum(['all', 'fixed', 'random']),
    sourceCategoryId: z.string().regex(/^[1-9]\d*$/).optional(),
    sourceProductIds: z.array(z.string().regex(/^[1-9]\d*$/)),
    includeOutOfStock: z.boolean(),
})
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

/**
 * Resolve only verified BE identities; never infer categories or products from names.
 * Two evidenced cases degrade to a warning instead of failing the store (Issue #1956):
 * a template-owned category (listing left empty, as on PW1) and fixed products the BE
 * export did not emit. Everything else still throws BE_MAPPING_INVALID.
 */
export async function resolveProductSelections(query: SelectionQuery, payload: Payload, blueprint: WebsiteBlueprint, siteId: number, tenantId: number, sourceStoreId?: string): Promise<string[]> {
    const warnings: string[] = []
    for (const component of blueprint.nativeContract.pages.flatMap(page => page.components).filter(c => c.kind === 'product_listing')) {
        if (!component.block.sourceProductSelection) continue
        const selection = SourceProductSelectionSchema.parse(component.block.sourceProductSelection)
        const unmapped = (collection: string, id: string) => new MigrationError('BE_MAPPING_INVALID', `Component ${component.sourceId}: source ${collection} ${id} needs exactly one verified destination mapping`)
        async function targetsById(collection: 'products' | 'categories', ids: string[]) {
            const { rows } = await query(`SELECT DISTINCT m.source_id, m.target_id FROM migration_entity_map m
                JOIN ${collection} d ON d.id::text=m.target_id
                WHERE m.source_entity=$1 AND m.target_collection=$1 AND m.state='VERIFIED'
                AND m.source_id=ANY($2::text[]) AND d.site_id=$3 AND d.tenant_id=$4 AND d.deleted_at IS NULL`, [collection, ids, siteId, tenantId])
            return new Map(ids.map(id => [id, [...new Set(rows.filter(row => row.source_id === id).map(row => row.target_id))]]))
        }
        async function resolveProducts(ids: string[]) {
            if (!ids.length) return []
            const targets = await targetsById('products', ids)
            const absent = ids.filter(id => !targets.get(id)?.length)
            const evidence = sourceStoreId && absent.length ? await productsNotEmittedByBe(query, sourceStoreId, absent) : undefined
            const resolved: string[] = [], dropped: string[] = []
            for (const id of ids) {
                const found = targets.get(id) ?? []
                if (found.length === 1) resolved.push(found[0])
                else if (!found.length && evidence?.ids.has(id)) dropped.push(id)
                else throw unmapped('products', id)
            }
            if (dropped.length) warnings.push(`Component ${component.sourceId}: source products ${dropped.join(',')} were not emitted by the BE export (retained-source evidence, snapshot ${evidence?.snapshotId}); removed from the fixed selection`)
            return resolved
        }
        async function resolveCategory(id: string) {
            const found = (await targetsById('categories', [id])).get(id) ?? []
            if (found.length === 1) return found[0]
            const outside = found.length ? undefined : (await categoriesMappedOutsideScope(query, [id], siteId, tenantId)).get(id)
            if (outside) {
                warnings.push(`Component ${component.sourceId}: source category ${id} is mapped outside this destination (${outside}; likely a template-owned category copied verbatim by PW1 cloning); listing left empty as on PW1`)
                return undefined
            }
            throw unmapped('categories', id)
        }
        component.block.includeOutOfStock = selection.includeOutOfStock
        const category = selection.mode === 'random' && selection.sourceCategoryId ? await resolveCategory(selection.sourceCategoryId) : ''
        component.block.selectionMode = category === undefined ? 'fixed' : selection.mode
        component.block.selectedProductIds = category === undefined ? [] : await resolveProducts(selection.mode === 'fixed' ? selection.sourceProductIds : [])
        component.block.category = category ?? ''
    }
    await verifyProductSelectionScope(payload, blueprint, siteId, tenantId)
    return warnings
}
