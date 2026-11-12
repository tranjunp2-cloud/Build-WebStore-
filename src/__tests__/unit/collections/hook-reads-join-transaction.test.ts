import { describe, it, expect, vi, beforeEach } from 'vitest'
import { killTransaction, type CollectionAfterChangeHook, type CollectionBeforeChangeHook, type PayloadRequest } from 'payload'

const { queueSEOAutoGeneration } = vi.hoisted(() => ({ queueSEOAutoGeneration: vi.fn() }))
vi.mock('@/lib/products/product-summary-text', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@/lib/products/product-summary-text')>()
    return { ...actual, productSummaryText: vi.fn(actual.productSummaryText) }
})

vi.mock('@/lib/ai/seo-queue', () => ({ queueSEOAutoGeneration }))
vi.mock('../../../lib/ai/seo-queue', () => ({ queueSEOAutoGeneration }))

import { Products } from '@/collections/Products'
import { Pages } from '@/collections/Pages'
import { recomputeComplianceHook } from '@/collections/Templates'
import { productSummaryText } from '@/lib/products/product-summary-text'

const productsAfterChange = Products.hooks!.afterChange![0] as CollectionAfterChangeHook
const productsBeforeChange = Products.hooks!.beforeChange![0] as CollectionBeforeChangeHook
const pagesAfterChange = Pages.hooks!.afterChange![0] as CollectionAfterChangeHook

/** A req inside a Payload-owned transaction; rollbackTransaction is what killTransaction calls. */
function txReq(payloadOverrides: Record<string, unknown>) {
    const rollbackTransaction = vi.fn().mockResolvedValue(undefined)
    const payload = { db: { rollbackTransaction }, ...payloadOverrides }
    const req = { payload, transactionID: 'tx-1', user: null } as unknown as PayloadRequest
    return { req, payload, rollbackTransaction }
}

/** What Payload's find/findByID operation does when its query fails: kill the req's transaction, rethrow. */
function failingRead(error: Error) {
    return vi.fn(async (args: { req?: PayloadRequest }) => {
        if (args.req) await killTransaction(args.req)
        throw error
    })
}

describe('collection hook reads join the save transaction (TC-PERF-186)', () => {
    beforeEach(() => queueSEOAutoGeneration.mockClear())

    it('TC-PERF-186: Products + Pages SEO site lookup passes req and disableErrors (missing site → null, no rollback)', async () => {
        for (const [hook, doc] of [
            [productsAfterChange, { id: 1, status: 'active', site: 5, name: 'P' }],
            [pagesAfterChange, { id: 2, _status: 'published', site: 5, title: 'Home' }],
        ] as const) {
            // Arrange: site gone → Payload returns null under disableErrors
            const findByID = vi.fn().mockResolvedValue(null)
            const { req, rollbackTransaction } = txReq({ findByID })

            // Act
            await hook({ doc, previousDoc: {}, operation: 'create', req } as never)

            // Assert
            expect(findByID).toHaveBeenCalledWith(expect.objectContaining({ collection: 'sites', id: 5, req, disableErrors: true }))
            expect(rollbackTransaction).not.toHaveBeenCalled()
            await vi.waitFor(() => expect(queueSEOAutoGeneration).toHaveBeenCalled()) // lazy-imported queue
            queueSEOAutoGeneration.mockClear()
        }
    })

    it('TC-PERF-186: autoMetaEnabled=false on the site still skips SEO generation', async () => {
        const findByID = vi.fn().mockResolvedValue({ id: 5, seo: { autoMetaEnabled: false } })
        const { req } = txReq({ findByID })
        await productsAfterChange({ doc: { id: 1, status: 'active', site: 5 }, previousDoc: {}, operation: 'create', req } as never)
        await new Promise((resolve) => setTimeout(resolve, 20))
        expect(queueSEOAutoGeneration).not.toHaveBeenCalled()
    })

    it('TC-PERF-186: a lookup that made Payload roll the save back is rethrown (Products, Pages, Templates) — never reported as saved', async () => {
        const dbError = new Error('canceling statement due to statement timeout')

        // Products / Pages afterChange
        for (const [hook, doc] of [
            [productsAfterChange, { id: 1, status: 'active', site: 5 }],
            [pagesAfterChange, { id: 2, _status: 'published', site: 5 }],
        ] as const) {
            const { req, rollbackTransaction } = txReq({ findByID: failingRead(dbError) })
            await expect(hook({ doc, previousDoc: {}, operation: 'create', req } as never)).rejects.toBe(dbError)
            expect(rollbackTransaction).toHaveBeenCalledWith('tx-1')
        }

        // Templates beforeChange
        const { req } = txReq({ find: failingRead(dbError) })
        await expect(
            recomputeComplianceHook({ data: { category: ['ecommerce'] }, req, context: {}, operation: 'update' } as never),
        ).rejects.toBe(dbError)
    })

    it('TC-PERF-186: outside a transaction a failed lookup stays best-effort (SEO still queued, template saved without cache)', async () => {
        const dbError = new Error('db down')
        const findByID = failingRead(dbError)
        const req = { payload: { findByID, db: {} }, user: null } as unknown as PayloadRequest
        await productsAfterChange({ doc: { id: 1, status: 'active', site: 5 }, previousDoc: {}, operation: 'create', req } as never)
        await vi.waitFor(() => expect(queueSEOAutoGeneration).toHaveBeenCalled())

        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
        const find = failingRead(dbError)
        const data = await recomputeComplianceHook({ data: { category: ['ecommerce'] }, req: { payload: { find } }, context: {}, operation: 'update' } as never)
        expect(data).not.toHaveProperty('dnaComplianceCache')
        warn.mockRestore()
    })

    it('TC-PERF-186: Products beforeChange site lookups (tenant check on update, default site on create) pass req', async () => {
        const user = { id: 9, roles: [], tenants: [{ tenant: 3 }] }

        // update: client moves the product to another site → tenant-scoped check
        const find = vi.fn().mockResolvedValue({ docs: [{ id: 8 }] })
        const { req } = txReq({ find })
        Object.assign(req, { user })
        await productsBeforeChange({ data: { site: 8 }, req, operation: 'update', originalDoc: { tenant: 3, site: 5 } } as never)
        expect(find).toHaveBeenCalledWith(expect.objectContaining({ collection: 'sites', req, where: { id: { equals: 8 }, tenant: { equals: 3 } } }))

        // create without a site → first site of the tenant
        const find2 = vi.fn().mockResolvedValue({ docs: [{ id: 6 }] })
        const created = txReq({ find: find2 })
        Object.assign(created.req, { user })
        const data = await productsBeforeChange({ data: {}, req: created.req, operation: 'create' } as never)
        expect(find2).toHaveBeenCalledWith(expect.objectContaining({ collection: 'sites', req: created.req, where: { tenant: { equals: 3 } } }))
        expect(data.site).toBe(6)
    })
})

describe('auto-SEO hook trigger on publish/activation (TC-F37-11-08)', () => {
    beforeEach(() => queueSEOAutoGeneration.mockClear())

    const cases = [
        ['products', productsAfterChange, { id: 1, status: 'active', site: 5, name: 'P' }, 'P'],
        ['pages', pagesAfterChange, { id: 2, _status: 'published', site: 5, title: 'Home' }, 'Home'],
    ] as const

    it('[TC-F37-11-08] queues when the title is filled but the description is empty', async () => {
        for (const [collection, hook, base, name] of cases) {
            // Arrange
            const { req } = txReq({ findByID: vi.fn().mockResolvedValue({ id: 5, seo: {} }) })
            const doc = { ...base, seo: { title: 'Merchant title', description: '  ' } }

            // Act
            await hook({ doc, previousDoc: {}, operation: 'create', req } as never)

            // Assert: queued once, for this doc (collection, id, site, name)
            await vi.waitFor(() => expect(queueSEOAutoGeneration, collection).toHaveBeenCalledTimes(1))
            expect(queueSEOAutoGeneration.mock.calls[0]!.slice(0, 4), collection).toEqual([collection, base.id, 5, name])
            queueSEOAutoGeneration.mockClear()
        }
    })

    it('[TC-F37-11-08] does not queue when both title and description are filled', async () => {
        for (const [collection, hook, base] of cases) {
            // Arrange
            const findByID = vi.fn().mockResolvedValue({ id: 5, seo: {} })
            const { req } = txReq({ findByID })
            const doc = { ...base, seo: { title: 'Merchant title', description: 'Merchant description' } }

            // Act
            await hook({ doc, previousDoc: {}, operation: 'create', req } as never)
            await new Promise((resolve) => setTimeout(resolve, 20))

            // Assert
            expect(findByID, collection).not.toHaveBeenCalled()
            expect(queueSEOAutoGeneration, collection).not.toHaveBeenCalled()
        }
    })

    it('[TC-F09-2378-07] products queue SEO generation with description text when shortDescription is empty', async () => {
        // Arrange
        const { req } = txReq({ findByID: vi.fn().mockResolvedValue({ id: 5, seo: {} }) })
        const description = { root: { type: 'root', children: [{ type: 'paragraph', children: [{ type: 'text', text: 'Form description', mode: 'normal', style: '', detail: 0, format: 0, version: 1 }] }] } }

        // Act
        await productsAfterChange({ doc: { id: 1, status: 'active', site: 5, name: 'P', description }, previousDoc: {}, operation: 'create', req } as never)

        // Assert
        await vi.waitFor(() => expect(queueSEOAutoGeneration).toHaveBeenCalledTimes(1))
        expect(queueSEOAutoGeneration.mock.calls[0]!.slice(0, 5)).toEqual(['products', 1, 5, 'P', 'Form description'])
    })

    it('[TC-F09-2378-08] summary failure warns without leaking content and still queues the short description', async () => {
        // Arrange
        const { req } = txReq({ findByID: vi.fn().mockResolvedValue({ id: 5, seo: {} }) })
        vi.mocked(productSummaryText).mockImplementationOnce(() => { throw new Error('private description') })
        const warning = vi.spyOn(console, 'warn').mockImplementation(() => {})

        try {
            // Act — resolving proves the hook does not break the save
            await productsAfterChange({ doc: { id: 1, status: 'active', site: 5, name: 'P', shortDescription: 'Merchant summary' }, previousDoc: {}, operation: 'create', req } as never)

            // Assert
            await vi.waitFor(() => expect(queueSEOAutoGeneration).toHaveBeenCalledWith('products', 1, 5, 'P', 'Merchant summary', req.user))
            expect(warning.mock.calls).toEqual([['[Products] SEO summary fallback failed', { productId: 1 }]])
        } finally {
            warning.mockRestore()
        }
    })
})
