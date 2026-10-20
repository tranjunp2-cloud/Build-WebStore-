import { describe, expect, it } from 'vitest'
import { ListingSelectionSchema, orderListingIds } from '@/lib/products/listing-selection'

describe('[TC-F35.M59] Product listing selection', () => {
    it('preserves fixed order, removes unavailable IDs and duplicates, and keeps empty selections empty', () => {
        const available = ['1', '2', '3']
        expect(orderListingIds(available, 'fixed', ['3', '9', '1', '3'], 'seed')).toEqual(['3', '1'])
        expect(orderListingIds(available, 'fixed', [], 'seed')).toEqual([])
    })
    it('randomizes independently of DB order and keeps page slices stable', () => {
        const ids = Array.from({ length: 20 }, (_, i) => String(i + 1))
        const ordered = orderListingIds(ids, 'random', [], 'session')
        expect(orderListingIds([...ids].reverse(), 'random', [], 'session')).toEqual(ordered)
        expect(new Set([...ordered.slice(0, 10), ...ordered.slice(10)])).toEqual(new Set(ids))
        expect(orderListingIds(ids, 'random', [], 'other-session')).not.toEqual(ordered)
    })
    it('rejects invalid modes and unsafe IDs without imposing a selection cap', () => {
        expect(ListingSelectionSchema.safeParse({ mode: 'unknown' }).success).toBe(false)
        expect(ListingSelectionSchema.safeParse({ ids: ['1 OR 1=1'] }).success).toBe(false)
        expect(ListingSelectionSchema.safeParse({ ids: Array(501).fill('1') }).success).toBe(true)
    })
})

import type { Payload } from 'payload'
import { createNativeBlueprint } from '@/lib/migration/pw1-contract'
import { resolveProductSelections } from '@/lib/migration/pw1-product-selection'
function blueprint() {
    return createNativeBlueprint({ format: 'pw2-reconstruction-contract', version: '1.0.0', source: { url: 'https://example.com', storeId: '1', capturedAt: '', dumpHash: '' }, site: { name: 'Test', navigation: {}, footer: {} }, reconciliation: [], pages: [{ sourceId: '1', title: 'Home', slug: 'home', isHomepage: true, components: [{ sourceId: '2', position: 0, kind: 'product_listing', block: { sourceProductSelection: { mode: 'fixed', sourceProductIds: ['30', '10'], sourceCategoryId: '7', includeOutOfStock: false } } }] }] })
}
it('[TC-F35.M59] maps verified IDs while preserving source order and stock policy', async () => {
    const value = blueprint()
    const payload = { find: async ({ collection }: { collection: string }) => ({ docs: (collection === 'products' ? ['300', '100'] : ['70']).map(id => ({ id })) }) } as unknown as Payload
    await resolveProductSelections(async (_sql, params) => ({ rows: (params[1] as string[]).map(source_id => ({ source_id, target_id: `${source_id}0` })) }), payload, value, 1, 1)
    expect(value.nativeContract.pages[0].components[0].block).toMatchObject({ selectionMode: 'fixed', selectedProductIds: ['300', '100'], category: '', includeOutOfStock: false })
})
it('[TC-F35.M59] refuses missing BE mapping rather than falling back to all products', async () => {
    const value = blueprint()
    await expect(resolveProductSelections(async () => ({ rows: [] }), {} as Payload, value, 1, 1)).rejects.toThrow('source products 30')
})

import { routeBlockChanges } from '@/lib/editor/structural-block-fields'
it('[TC-F35.M59] keeps listing settings structural when editing another locale', () => {
    const patch = { selectionMode: 'fixed', selectedProductIds: ['30', '10'], category: '7', includeOutOfStock: false, limit: 4 }
    const result = routeBlockChanges(patch, { hasBlockId: true, activeLocale: 'ms', generationLocale: 'en' })
    expect(result.flatChanges).toEqual(patch)
    expect(result.contentOverride).toEqual({})
})

type Selection = { mode: 'fixed' | 'random'; sourceProductIds: string[]; sourceCategoryId?: string }
function selectionBlueprint(sourceProductSelection: Selection) {
    return createNativeBlueprint({ format: 'pw2-reconstruction-contract', version: '1.0.0', source: { url: 'https://example.com', storeId: '1', capturedAt: '', dumpHash: '' }, site: { name: 'Test', navigation: {}, footer: {} }, reconciliation: [], pages: [{ sourceId: '1', title: 'Home', slug: 'home', isHomepage: true, components: [{ sourceId: '2', position: 0, kind: 'product_listing', block: { sourceProductSelection: { ...sourceProductSelection, includeOutOfStock: true } } }] }] })
}
const block = (value: ReturnType<typeof selectionBlueprint>) => value.nativeContract.pages[0].components[0].block
const payloadOf = (productIds: string[] = [], categoryIds: string[] = []) => ({ find: async ({ collection }: { collection: string }) => ({ docs: (collection === 'products' ? productIds : categoryIds).map(id => ({ id })) }) }) as unknown as Payload
type Stub = { scoped?: Record<string, string>; outOfScope?: string[]; evidence?: string[]; seen?: unknown[][] }
/** Routes by SQL text: scoped mapping lookup, out-of-scope category lookup, BE evidence lookup. */
const stubQuery = ({ scoped = {}, outOfScope = [], evidence = [], seen = [] }: Stub) => async (sql: string, params: unknown[]) => {
    if (sql.includes('migration_source_evidence_rows')) { seen.push(params); return { rows: evidence.map(source_id => ({ source_id, snapshot_id: 'snap-1' })) } }
    if (sql.includes('d.site_id<>$2')) return { rows: outOfScope.map(source_id => ({ source_id, tenant_id: '24', site_id: '24' })) }
    return { rows: (params[1] as string[]).filter(id => scoped[id]).map(source_id => ({ source_id, target_id: scoped[source_id] })) }
}

describe('[TC-F35.M73] Empty fixed list shows every product, as on PW1', () => {
    it('binds a fixed listing without source items to all', async () => {
        const value = selectionBlueprint({ mode: 'fixed', sourceProductIds: [] })
        await resolveProductSelections(stubQuery({}), payloadOf(), value, 71, 71)
        expect(block(value)).toMatchObject({ selectionMode: 'all', selectedProductIds: [] })
    })
})

describe('[TC-F35.M62] Template-owned category (Issue #1956)', () => {
    it('leaves the listing empty with a warning when the verified mapping is outside the destination', async () => {
        const value = selectionBlueprint({ mode: 'random', sourceProductIds: [], sourceCategoryId: '606' })
        const warnings = await resolveProductSelections(stubQuery({ outOfScope: ['606'] }), payloadOf(), value, 71, 71)
        expect(block(value)).toMatchObject({ selectionMode: 'fixed', selectedProductIds: [], category: '', includeOutOfStock: true })
        expect(warnings).toHaveLength(1)
        expect(warnings[0]).toContain('source category 606 is mapped outside this destination (tenant 24 / site 24;')
    })
    it('still refuses a category with no mapping at all', async () => {
        const value = selectionBlueprint({ mode: 'random', sourceProductIds: [], sourceCategoryId: '606' })
        await expect(resolveProductSelections(stubQuery({}), payloadOf(), value, 71, 71)).rejects.toThrow('source categories 606')
    })
    it('keeps resolving an in-scope category without warnings', async () => {
        const value = selectionBlueprint({ mode: 'random', sourceProductIds: [], sourceCategoryId: '7' })
        const warnings = await resolveProductSelections(stubQuery({ scoped: { '7': '70' } }), payloadOf([], ['70']), value, 1, 1)
        expect(block(value)).toMatchObject({ selectionMode: 'random', category: '70', selectedProductIds: [] })
        expect(warnings).toEqual([])
    })
})

describe('[TC-F35.M63] Fixed products excluded by the BE export (Issue #1956)', () => {
    it('drops evidenced IDs, keeps source order and warns', async () => {
        const seen: unknown[][] = []
        const value = selectionBlueprint({ mode: 'fixed', sourceProductIds: ['30', '10', '20'] })
        const warnings = await resolveProductSelections(stubQuery({ scoped: { '30': '300', '20': '200' }, evidence: ['10'], seen }), payloadOf(['300', '200']), value, 48, 48, '48')
        expect(block(value)).toMatchObject({ selectionMode: 'fixed', selectedProductIds: ['300', '200'] })
        expect(warnings[0]).toContain('source products 10 were not emitted by the BE export')
        expect(warnings[0]).toContain('snapshot snap-1')
        expect(seen).toEqual([['48', ['10']]])
    })
    it('refuses a missing mapping that has no BE evidence', async () => {
        const value = selectionBlueprint({ mode: 'fixed', sourceProductIds: ['30', '10'] })
        await expect(resolveProductSelections(stubQuery({ scoped: { '30': '300' } }), payloadOf(['300']), value, 48, 48, '48')).rejects.toThrow('source products 10')
    })
    it('does not look up evidence when no source store is given', async () => {
        const seen: unknown[][] = []
        const value = selectionBlueprint({ mode: 'fixed', sourceProductIds: ['10'] })
        await expect(resolveProductSelections(stubQuery({ evidence: ['10'], seen }), payloadOf(), value, 48, 48)).rejects.toThrow('source products 10')
        expect(seen).toEqual([])
    })
    it('keeps an empty fixed selection when every product is evidenced as not emitted', async () => {
        const value = selectionBlueprint({ mode: 'fixed', sourceProductIds: ['10'] })
        const warnings = await resolveProductSelections(stubQuery({ evidence: ['10'] }), payloadOf(), value, 48, 48, '48')
        expect(block(value)).toMatchObject({ selectionMode: 'fixed', selectedProductIds: [] })
        expect(warnings).toHaveLength(1)
    })
    it('refuses a product with several verified targets even when evidence exists', async () => {
        const value = selectionBlueprint({ mode: 'fixed', sourceProductIds: ['10'] })
        const query = async (sql: string) => sql.includes('migration_source_evidence_rows') ? { rows: [{ source_id: '10', snapshot_id: 's' }] } : { rows: [{ source_id: '10', target_id: '1' }, { source_id: '10', target_id: '2' }] }
        await expect(resolveProductSelections(query, payloadOf(), value, 48, 48, '48')).rejects.toThrow('source products 10')
    })
})
