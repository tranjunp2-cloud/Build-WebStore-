/**
 * TC-AICP-138..140 — the Product Store's categories through the copilot (store.categories / store.prepare_categories,
 * `store.categories_patch`, undo `store.categories_restore`):
 *   138  the draft: a new category with its products (and a sub-category made in the same card), rename / move /
 *        delete, three levels, one name per level, delete refused while products stay in it (unless moved first)
 *   139  the apply: the Categories page's own save / delete as the approver, products moved, nothing overwritten
 *        when edited since, a half-run change put back
 *   140  undo: products back, the change's categories gone, a deleted category back with its sub-categories
 * Real: store-categories.ts (read / prepare), appliers/store-categories.ts. Faked: Payload (in memory),
 * the Categories page's save / delete (category-service: their own rules are the page's, tested there), the
 * user's tenant.
 */

import { PgDialect } from 'drizzle-orm/pg-core'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
    categories: [] as Array<{ id: number; name: string; parent: number | null; breadcrumbs: string; description?: string; updatedAt: string; deletedAt?: string | null }>,
    products: [] as Array<{ id: number; name: string; category: number[]; updatedAt: string }>,
    sql: [] as string[],
    saves: [] as Array<{ data: Record<string, unknown>; id?: number }>,
    deletes: [] as number[],
    failSave: null as string | null,
    nextId: 100,
}))

vi.mock('payload', () => {
    const cms = {
        find: vi.fn(async ({ collection, where }: { collection: string; where: { and: Array<Record<string, { in?: number[]; like?: string }>> } }) => {
            if (collection === 'categories') return { docs: state.categories.filter((c) => !c.deletedAt).map((c) => ({ ...c })) }
            const ids = where.and.find((w) => w.id)?.id?.in
            const like = where.and.find((w) => w.name)?.name?.like
            return { docs: state.products.filter((p) => (!ids || ids.includes(p.id)) && (!like || p.name.toLowerCase().includes(like.toLowerCase()))).map((p) => ({ ...p })) }
        }),
        update: vi.fn(async ({ collection, id, data }: { collection: string; id: number; data: { category: number[] } }) => {
            const product = state.products.find((p) => p.id === id)!
            if (collection === 'products') Object.assign(product, { category: data.category, updatedAt: 'later' })
            return product
        }),
        db: {
            drizzle: {
                execute: vi.fn(async (query: unknown) => {
                    const text = new PgDialect().sqlToQuery(query as never).sql
                    state.sql.push(text)
                    if (text.includes('COUNT(DISTINCT p.id)')) {
                        const counts = new Map<number, number>()
                        for (const p of state.products) for (const c of p.category) counts.set(c, (counts.get(c) ?? 0) + 1)
                        return { rows: [...counts].map(([id, count]) => ({ id, count })) }
                    }
                    return { rows: [] }
                }),
            },
        },
    }
    return { getPayload: vi.fn(async () => cms) }
})
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('@/lib/auth', () => ({ tenantIdForQuery: vi.fn(() => 1) }))
vi.mock('@/lib/products/category-service', () => ({
    saveCategoryAs: vi.fn(async (_user: unknown, data: Record<string, unknown>, id?: number) => {
        if (state.failSave) return { success: false, error: state.failSave }
        state.saves.push({ data, ...(id ? { id } : {}) })
        if (id) return { id }
        const created = { id: state.nextId++, name: String(data.name), parent: (data.parent as number | null) ?? null, breadcrumbs: String(data.name), updatedAt: 'now' }
        state.categories.push(created)
        return created
    }),
    deleteCategoryAs: vi.fn(async (_user: unknown, id: number) => {
        state.deletes.push(id)
        const row = state.categories.find((c) => c.id === id)
        if (row) row.deletedAt = 'now'
        return { id }
    }),
}))

import { applyStoreCategoriesPatch, applyStoreCategoriesRestore } from '@/lib/ai-platform/appliers/store-categories'
import { prepareStoreCategories, readStoreCategories } from '@/lib/ai-platform/store/store-categories'
import { saveCategoryAs } from '@/lib/products/category-service'

const actor = { user: { id: 3, tenants: [{ tenant: 1 }] }, tenantId: '1', organizationId: 'org_1' } as never
type Prepared = { error?: { code: string; message: string }; kind?: string; title?: string; confirmText?: string; diffs?: Array<{ entity: { kind: string; id: string; label?: string }; field: string; before: string | null; after: string }>; plan?: Record<string, unknown> }
const draft = (changes: unknown[]) => prepareStoreCategories(actor, { why: 'tidy the store', changes }) as Promise<Prepared>

beforeEach(() => {
    vi.clearAllMocks()
    state.categories = [
        { id: 1, name: 'Fesyen Wanita', parent: null, breadcrumbs: 'Fesyen Wanita', updatedAt: 't1' },
        { id: 2, name: 'Kasut', parent: 1, breadcrumbs: 'Fesyen Wanita > Kasut', updatedAt: 't2' },
        { id: 3, name: 'Pakaian', parent: 1, breadcrumbs: 'Fesyen Wanita > Pakaian', updatedAt: 't3' },
        { id: 4, name: 'Baju', parent: 3, breadcrumbs: 'Fesyen Wanita > Pakaian > Baju', updatedAt: 't4' },
        { id: 5, name: 'Skincare', parent: null, breadcrumbs: 'Skincare', updatedAt: 't5' },
    ]
    state.products = [
        { id: 11, name: 'Áo thun tay ngắn', category: [3], updatedAt: 'p11' },
        { id: 12, name: 'Kemeja-T Gaya Pejabat', category: [], updatedAt: 'p12' },
        { id: 13, name: 'Serum', category: [5], updatedAt: 'p13' },
    ]
    state.sql = []
    state.saves = []
    state.deletes = []
    state.failSave = null
    state.nextId = 100
})

describe('store categories read [TC-AICP-138]', () => {
    it('lists the tree with levels and product counts, and products found by name with their category', async () => {
        const read = await readStoreCategories(actor, { query: 'áo thun' })

        expect(read.categories).toContainEqual({ id: '4', name: 'Baju', path: 'Fesyen Wanita > Pakaian > Baju', level: 3, parentId: '3', products: 0 })
        expect(read.categories).toContainEqual(expect.objectContaining({ id: '3', products: 1 }))
        expect(read.products).toEqual([{ id: '11', name: 'Áo thun tay ngắn', status: null, category: 'Fesyen Wanita > Pakaian' }])
    })
})

describe('the category change card [TC-AICP-138]', () => {
    it('makes a category with its products, and a sub-category of it, in one card', async () => {
        const prepared = await draft([
            { op: 'create', ref: 'tops', name: 'Áo', parentId: '1', productIds: ['12'] },
            { op: 'create', ref: 'tees', name: 'Áo thun', parentRef: 'tops', productIds: ['11'] },
        ])

        expect(prepared.kind).toBe('store.categories_patch')
        expect(prepared.title).toBe('New categories with 2 products')
        expect(prepared.diffs).toEqual(expect.arrayContaining([
            expect.objectContaining({ field: 'new category', after: 'Fesyen Wanita > Áo' }),
            expect.objectContaining({ field: 'new category', after: 'Fesyen Wanita > Áo > Áo thun' }),
            { entity: { kind: 'product', id: '11', label: 'Áo thun tay ngắn' }, field: 'category', before: 'Pakaian', after: 'Fesyen Wanita > Áo > Áo thun' },
        ]))
        expect(prepared.plan).toMatchObject({ steps: [{ op: 'create', parent: { id: 1 } }, { op: 'create', parent: { ref: 'tops' } }], base: { products: { '11': 'p11', '12': 'p12' } } })
        expect(prepared.confirmText).toBeUndefined()
    })

    it('keeps three levels and one name per level', async () => {
        expect((await draft([{ op: 'create', ref: 'x', name: 'Lengan pendek', parentId: '4' }])).error).toMatchObject({ code: 'too_deep' })
        expect((await draft([{ op: 'create', ref: 'x', name: ' kasut ', parentId: '1' }])).error).toMatchObject({ code: 'name_taken' })
        // Pakaian has Baju under it: moving it under Kasut would make level 4
        expect((await draft([{ op: 'update', categoryId: '3', parentId: '2' }])).error).toMatchObject({ code: 'too_deep' })
        expect((await draft([{ op: 'update', categoryId: '1', parentId: '4' }])).error).toMatchObject({ code: 'invalid_move' })
        expect((await draft([{ op: 'assign', categoryId: '5', productIds: ['999'] }])).error).toMatchObject({ code: 'unknown_product' })
    })

    it('refuses a delete while products stay in it, allows it once the same card moves them, and asks for the name', async () => {
        expect((await draft([{ op: 'delete', categoryId: '5' }])).error).toMatchObject({ code: 'has_products', message: expect.stringContaining('1 product') })

        const prepared = await draft([
            { op: 'assign', categoryId: '3', productIds: ['13'] },
            { op: 'delete', categoryId: '5' },
        ])

        expect(prepared.confirmText).toBe('Skincare')
        expect(prepared.diffs).toContainEqual(expect.objectContaining({ field: 'deleted', before: 'Skincare', after: 'Deleted' }))
    })
})

describe('applying a category change [TC-AICP-139]', () => {
    it('runs the page save as the approver, moves the products and records the undo', async () => {
        const prepared = await draft([
            { op: 'create', ref: 'tops', name: 'Áo', parentId: '1', productIds: ['12'] },
            { op: 'update', categoryId: '5', name: 'Kecantikan' },
        ])

        const result = await applyStoreCategoriesPatch(prepared.plan, actor)

        expect(saveCategoryAs).toHaveBeenNthCalledWith(1, actor.user, { name: 'Áo', parent: 1 }, undefined)
        expect(saveCategoryAs).toHaveBeenNthCalledWith(2, actor.user, { name: 'Kecantikan', parent: null }, 5)
        expect(state.products.find((p) => p.id === 12)?.category).toEqual([100])
        expect(result.undo).toMatchObject({ kind: 'store.categories_restore', payload: { created: [100], updated: [{ id: 5, name: 'Skincare', parent: null }], products: [{ id: 12, categories: [] }] } })
    })

    it('overwrites nothing edited since the draft', async () => {
        const prepared = await draft([{ op: 'assign', categoryId: '5', productIds: ['11'] }])
        state.products[0]!.updatedAt = 'edited'

        await expect(applyStoreCategoriesPatch(prepared.plan, actor)).rejects.toMatchObject({ status: 409 })
        expect(state.saves).toEqual([])
    })

    it('puts back what already ran when a later step is refused', async () => {
        const prepared = await draft([
            { op: 'assign', categoryId: '5', productIds: ['11'] },
            { op: 'create', ref: 'x', name: 'Promo', parentId: null },
        ])
        state.failSave = 'CATEGORY_SLUG_DUPLICATE'

        await expect(applyStoreCategoriesPatch(prepared.plan, actor)).rejects.toThrow('web address')
        expect(state.products.find((p) => p.id === 11)?.category).toEqual([3])
    })
})

describe('undoing a category change [TC-AICP-140]', () => {
    /** the shop as the change left it: Promo (100) made with product 12 in it, Pakaian (3) deleted and Baju moved up */
    const asTheChangeLeftIt = () => {
        state.categories.push({ id: 100, name: 'Promo', parent: null, breadcrumbs: 'Promo', updatedAt: 'now' })
        Object.assign(state.categories.find((c) => c.id === 3)!, { deletedAt: 'then' })
        Object.assign(state.categories.find((c) => c.id === 4)!, { parent: 1 })
        state.products.find((p) => p.id === 12)!.category = [100]
    }
    const record = { created: [100], updated: [], deleted: [{ id: 3, children: [4] }], products: [{ id: 12, categories: [] }] }

    it('moves products back, removes the categories it made, brings a deleted one back with its sub-categories', async () => {
        asTheChangeLeftIt()

        await applyStoreCategoriesRestore(record, actor)

        expect(state.products.find((p) => p.id === 12)?.category).toEqual([])
        expect(state.deletes).toEqual([100])
        expect(state.sql.some((q) => q.includes('SET deleted_at = NULL'))).toBe(true)
        expect(state.sql.some((q) => q.includes('SET parent_id ='))).toBe(true)
        expect(state.sql.some((q) => q.includes('WITH RECURSIVE up'))).toBe(true)
    })

    it('an undo that already ran (record lost, second tab) succeeds again and writes nothing [TC-AISEC-104]', async () => {
        // the pre-image is in place: Promo gone, Pakaian back with Baju under it, product 12 in no category
        await applyStoreCategoriesRestore(record, actor)

        expect(state.deletes).toEqual([])
        expect(state.saves).toEqual([])
        expect(state.sql.filter((q) => q.startsWith('UPDATE'))).toEqual([])
    })
})

describe('category card hardening [TC-AISEC-105, TC-AISEC-107]', () => {
    it('closes (final, stale) a card whose category or product changed after the draft [TC-AISEC-107]', async () => {
        const prepared = await draft([{ op: 'assign', categoryId: '5', productIds: ['11'] }])
        state.products[0]!.updatedAt = 'edited'

        const error = await applyStoreCategoriesPatch(prepared.plan, actor).catch((e) => e)

        expect(error).toMatchObject({ status: 409, final: true, stale: true })
    })

    it('when putting back a half-run change fails too, the card closes saying what is still in place [TC-AISEC-105]', async () => {
        const log = vi.spyOn(console, 'error').mockImplementation(() => undefined)
        const prepared = await draft([
            { op: 'assign', categoryId: '5', productIds: ['11'] },
            { op: 'create', ref: 'x', name: 'Promo', parentId: null },
        ])
        state.failSave = 'CATEGORY_SLUG_DUPLICATE'
        // moving product 11 back fails (the database dropped the connection)
        const { getPayload } = await import('payload')
        const cms = (await getPayload({} as never)) as unknown as { update: ReturnType<typeof vi.fn> }
        cms.update.mockImplementationOnce(async ({ id, data }: { id: number; data: { category: number[] } }) => {
            Object.assign(state.products.find((p) => p.id === id)!, { category: data.category, updatedAt: 'later' })
            return {}
        }).mockRejectedValueOnce(new Error('connection reset'))

        const error = await applyStoreCategoriesPatch(prepared.plan, actor).catch((e) => e)

        expect(error).toMatchObject({ status: 422, final: true })
        expect(error.message).toContain('web address')
        expect(error.message).toContain('Done: moved 1 product, could not put back: product #11')
        expect(state.products.find((p) => p.id === 11)?.category).toEqual([5])
        log.mockRestore()
    })
})
