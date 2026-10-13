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
