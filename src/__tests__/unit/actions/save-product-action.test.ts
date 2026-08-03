// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const {
    mockFind,
    mockCreate,
    mockUpdate,
    mockFindByID,
    mockDrizzleExecute,
    mockWithActiveCategoryRowLock,
    mockGetOrCreateCrateCartonId,
} = vi.hoisted(() => ({
    mockFind: vi.fn(),
    mockCreate: vi.fn(),
    mockUpdate: vi.fn(),
    mockFindByID: vi.fn(),
    mockDrizzleExecute: vi.fn(),
    mockWithActiveCategoryRowLock: vi.fn(),
    mockGetOrCreateCrateCartonId: vi.fn(),
}))

vi.mock('payload', () => ({
    getPayload: vi.fn().mockResolvedValue({
        find: mockFind,
        create: mockCreate,
        update: mockUpdate,
        findByID: mockFindByID,
        db: {
            drizzle: {
                execute: mockDrizzleExecute,
            },
        },
    }),
}))
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('@/lib/auth', () => ({
    getCurrentUser: vi.fn().mockResolvedValue({ id: 'u1', email: 'test@example.com' }),
    extractTenantId: vi.fn().mockReturnValue(null),
    tenantIdForQuery: vi.fn().mockReturnValue(null),
}))
vi.mock('@/lib/subscriptions/plan-subscription', () => ({
    getActivePlanSubscription: vi.fn().mockResolvedValue({
        id: 'mock-sub-1', plan: 'PROFESSIONAL_TM_USER', status: 'active', startDate: '2026-01-01T00:00:00.000Z',
    }),
    canUse: vi.fn().mockResolvedValue(true),
    canUseWithinLimit: vi.fn().mockResolvedValue(true),
}))
vi.mock('@/lib/payload/category-row-lock', () => ({
    CATEGORY_LOCK_BUSY_ERROR: 'CATEGORY_BUSY_RETRY',
    withActiveCategoryRowLock: mockWithActiveCategoryRowLock,
}))
// Mock dynamic import of getOrCreateCrateCartonIdAction
vi.mock('@/app/(dashboard)/actions/media', () => ({
    getOrCreateCrateCartonIdAction: mockGetOrCreateCrateCartonId,
    uploadMediaAction: vi.fn(),
}))

import {
    saveAiProductAction,
    saveProductAction,
    updateProductFieldAction,
    getProductAction,
    getProductsAction,
} from '@/app/(dashboard)/products/actions'
import { getCurrentUser, extractTenantId, tenantIdForQuery } from '@/lib/auth'

const VALID_PRODUCT = { name: 'Test Product', price: 100 }
const PRODUCT_WITH_IMAGES = {
    name: 'Test Product',
    images: [{ image: 10, alt: 'some image' }],
}

describe('getProductsAction [TC-GH1432-PERF-01]', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.mocked(getCurrentUser).mockResolvedValue({ id: 'u1', email: 'test@example.com' } as never)
        vi.mocked(tenantIdForQuery).mockReturnValue(68)
        mockFind.mockResolvedValue({ docs: [{ id: 42, name: 'Test Product' }] })
    })

    it('loads only list/quick-view fields without a pagination count query', async () => {
        const result = await getProductsAction()

        expect(result).toEqual([{ id: 42, name: 'Test Product' }])
        expect(mockFind).toHaveBeenCalledOnce()

        const query = mockFind.mock.calls[0][0]
        expect(query).toMatchObject({
            collection: 'products',
            overrideAccess: false,
            limit: 100,
            pagination: false,
            sort: '-createdAt',
            depth: 1,
            where: {
                and: [
                    { deletedAt: { exists: false } },
                    { tenant: { equals: 68 } },
                ],
            },
        })
        expect(query.select).toMatchObject({
            name: true,
            description: true,
            category: true,
            images: { image: true, alt: true },
            variants: { name: true, sku: true, price: true, stock: true },
            attributes: { key: true, value: true },
        })
        expect(query.select).not.toHaveProperty('seo')
        expect(query.select).not.toHaveProperty('variantConfigs')
        expect(query.select).not.toHaveProperty('descriptionBM')
        expect(query.populate).toEqual({
            media: { url: true, thumbnailURL: true },
            categories: { name: true, breadcrumbs: true },
        })
    })
})

describe('saveProductAction', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.mocked(getCurrentUser).mockResolvedValue({ id: 'u1', email: 'test@example.com' } as never)
        vi.mocked(extractTenantId).mockReturnValue(null)
        vi.mocked(tenantIdForQuery).mockReturnValue(null)
        mockFind.mockResolvedValue({ docs: [] })
        mockCreate.mockResolvedValue({ id: 42, name: 'Test Product' })
        mockUpdate.mockResolvedValue({ id: 42, name: 'Test Product' })
        mockFindByID.mockResolvedValue({ id: 42, name: 'Test Product' })
        mockDrizzleExecute.mockResolvedValue({ rows: [] })
        mockWithActiveCategoryRowLock.mockImplementation(async (_payload, _categoryId, _tenantId, operation) => operation(123))
        mockGetOrCreateCrateCartonId.mockResolvedValue(99)
    })

    // ── Auth ──────────────────────────────────────────────────────────────────

    it('[TC-F08-04-04] unauthorized → throws Unauthorized', async () => {
        // Arrange
        vi.mocked(getCurrentUser).mockResolvedValue(null)

        // Act & Assert
        await expect(saveProductAction(VALID_PRODUCT)).rejects.toThrow('Unauthorized')
        expect(mockCreate).not.toHaveBeenCalled()
    })

    // ── Validation ────────────────────────────────────────────────────────────

    it('[TC-F08-SKU-GLOBAL-09] allows literal SQL wildcard characters in SKU values', async () => {
        // Arrange
        const sku = 'TS_RED%M'

        // Act
        await expect(saveProductAction({ name: 'Test Product', sku })).resolves.not.toThrow()

        // Assert
        expect(mockDrizzleExecute).toHaveBeenCalledOnce()
        expect(mockCreate).toHaveBeenCalledOnce()
    })

    it('[TC-F08-04-04] invalid data (name too short) → throws Zod error', async () => {
        // Arrange
        const badData = { name: 'AB' }

        // Act & Assert
        await expect(saveProductAction(badData)).rejects.toThrow()
        expect(mockCreate).not.toHaveBeenCalled()
    })

    // ── Placeholder attachment (no images) ────────────────────────────────────

    it('[TC-F08-04-04] no images provided → attaches crate carton placeholder', async () => {
        // Arrange — product has no images

        // Act
        await saveProductAction(VALID_PRODUCT)

        // Assert — carton looked up and attached
        expect(mockGetOrCreateCrateCartonId).toHaveBeenCalledOnce()
        expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({
                images: [{ image: 99, alt: 'Test Product' }],
            }),
        }))
    })

    it('[TC-F08-04-04] no images + carton returns null → creates without images', async () => {
        // Arrange
        mockGetOrCreateCrateCartonId.mockResolvedValue(null)

        // Act
        await saveProductAction(VALID_PRODUCT)

        // Assert — no images attached, create still proceeds
        expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.not.objectContaining({ images: expect.anything() }),
        }))
    })

    it('[TC-F08-04-04] no images + carton throws → logs error, creates without images', async () => {
        // Arrange
        mockGetOrCreateCrateCartonId.mockRejectedValue(new Error('media error'))
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

        try {
            // Act
            await saveProductAction(VALID_PRODUCT)

            // Assert — error swallowed, create still proceeds
            expect(mockCreate).toHaveBeenCalledOnce()
            expect(consoleSpy).toHaveBeenCalledWith(
                expect.stringContaining('Failed to attach placeholder image'),
                expect.any(Error),
            )
        } finally {
            consoleSpy.mockRestore()
        }
    })

    // ── Images already provided ────────────────────────────────────────────────

    it('[TC-F08-04-04] images already provided → skips crate carton lookup', async () => {
        // Arrange

        // Act
        await saveProductAction(PRODUCT_WITH_IMAGES)

        // Assert — no carton lookup needed
        expect(mockGetOrCreateCrateCartonId).not.toHaveBeenCalled()
        expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({
                images: PRODUCT_WITH_IMAGES.images,
            }),
        }))
    })

    // ── Tenant injection (Fix A) ──────────────────────────────────────────────

    it('[TC-F08-04-32] tenantIdForQuery returns 83 → payload.create called with tenant: 83', async () => {
        // Arrange
        vi.mocked(tenantIdForQuery).mockReturnValue(83)
        mockGetOrCreateCrateCartonId.mockResolvedValue(null)

        // Act
        await saveProductAction(PRODUCT_WITH_IMAGES)

        // Assert — Fix A: explicit tenant injection prevents tenant_id NOT NULL constraint failure
        expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({ tenant: 83 }),
        }))
    })

    it('[TC-F08-04-32b] tenantIdForQuery returns null → payload.create NOT given a tenant field', async () => {
        // Arrange
        vi.mocked(tenantIdForQuery).mockReturnValue(null)
        mockGetOrCreateCrateCartonId.mockResolvedValue(null)

        // Act
        await saveProductAction(PRODUCT_WITH_IMAGES)

        // Assert — no tenant injected when user has no tenant (null guard)
        expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.not.objectContaining({ tenant: expect.anything() }),
        }))
    })

    // ── Create vs Update ──────────────────────────────────────────────────────

    it('[TC-F08-04-04] no id → calls payload.create', async () => {
        // Arrange
        mockGetOrCreateCrateCartonId.mockResolvedValue(null)

        // Act
        await saveProductAction(PRODUCT_WITH_IMAGES)

        // Assert
        expect(mockCreate).toHaveBeenCalledOnce()
        expect(mockUpdate).not.toHaveBeenCalled()
    })

    it('[TC-F08-04-04] id provided → calls payload.update', async () => {
        // Arrange
        mockGetOrCreateCrateCartonId.mockResolvedValue(null)

        // Act
        await saveProductAction(PRODUCT_WITH_IMAGES, 42)

        // Assert
        expect(mockUpdate).toHaveBeenCalledOnce()
        expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
            collection: 'products',
            id: 42,
        }))
        expect(mockCreate).not.toHaveBeenCalled()
    })

    // ── SKU global uniqueness check ───────────────────────────────────────────

    describe('SKU global uniqueness check', () => {
        const USER_WITH_TENANT = { id: 'u1', email: 'test@example.com', tenant: { id: 42 } }

        beforeEach(() => {
            vi.mocked(getCurrentUser).mockResolvedValue(USER_WITH_TENANT as never)
            vi.mocked(extractTenantId).mockReturnValue('42')
        })

        it('[TC-F08-SKU-GLOBAL-01] baseSku conflicts with active product → throws JSON field error on baseSku', async () => {
            // Arrange
            mockDrizzleExecute.mockResolvedValueOnce({ rows: [{ sku: 'sku-001' }] })

            // Act
            let thrown: Error | null = null
            try {
                await saveProductAction({ name: 'New Product', sku: 'SKU-001' })
            } catch (e) { thrown = e as Error }

            // Assert — structured JSON error
            expect(thrown).not.toBeNull()
            const parsed = JSON.parse(thrown!.message)
            expect(parsed.code).toBe('FIELD_ERRORS')
            expect(parsed.fieldErrors).toHaveProperty('baseSku')
            expect(parsed.fieldErrors.baseSku.code).toBe('SKU_ALREADY_IN_USE')
            expect(parsed.fieldErrors.baseSku.values).toEqual(['SKU-001'])
            expect(parsed.message).toContain('SKU-001')
            expect(mockDrizzleExecute).toHaveBeenCalledOnce()
            expect(mockCreate).not.toHaveBeenCalled()
        })

        it('[TC-F08-SKU-GLOBAL-02] variant sku conflicts → throws JSON field error on variants.0.skuCode', async () => {
            // Arrange
            mockDrizzleExecute.mockResolvedValueOnce({ rows: [{ sku: 'var-001' }] })

            // Act
            let thrown: Error | null = null
            try {
                await saveProductAction({ name: 'New Product', variants: [{ sku: 'VAR-001' }] })
            } catch (e) { thrown = e as Error }

            // Assert
            expect(thrown).not.toBeNull()
            const parsed = JSON.parse(thrown!.message)
            expect(parsed.code).toBe('FIELD_ERRORS')
            expect(parsed.fieldErrors).toHaveProperty('variants.0.skuCode')
            expect(parsed.fieldErrors['variants.0.skuCode'].code).toBe('SKU_ALREADY_IN_USE')
            expect(parsed.fieldErrors['variants.0.skuCode'].values).toEqual(['VAR-001'])
            expect(mockCreate).not.toHaveBeenCalled()
        })

        it('[TC-F08-04-77] duplicate base/variant SKUs in one request → returns structured variant field error', async () => {
            let thrown: Error | null = null
            try {
                await saveProductAction({
                    name: 'Wool Coat',
                    sku: 'COAT-001',
                    variants: [
                        { sku: 'COAT-RED-M' },
                        { sku: 'coat-red-m' },
                        { sku: 'COAT-001' },
                    ],
                })
            } catch (error) { thrown = error as Error }

            expect(thrown).not.toBeNull()
            const parsed = JSON.parse(thrown!.message)
            expect(parsed.code).toBe('FIELD_ERRORS')
            expect(parsed.fieldErrors).toHaveProperty('variants.1.skuCode')
            expect(parsed.fieldErrors).toHaveProperty('variants.2.skuCode')
            expect(parsed.fieldErrors['variants.1.skuCode'].code).toBe('DUPLICATE_SKU_IN_REQUEST')
            expect(mockDrizzleExecute).not.toHaveBeenCalled()
            expect(mockCreate).not.toHaveBeenCalled()
        })

        it('[TC-F08-SKU-GLOBAL-03] sku conflicts with soft-deleted product → allowed (no throw)', async () => {
            // Arrange — soft-deleted product excluded by query filter, mockFind returns empty
            mockDrizzleExecute.mockResolvedValueOnce({ rows: [] })

            // Act & Assert — no error thrown
            await expect(
                saveProductAction({ name: 'New Product', sku: 'DELETED-SKU' })
            ).resolves.not.toThrow()
            expect(mockCreate).toHaveBeenCalledOnce()
        })

        it('[TC-F08-SKU-GLOBAL-04] update — same product own SKU → allowed (self excluded)', async () => {
            // Arrange — Payload excludes id=42 from query, returns empty
            mockDrizzleExecute.mockResolvedValueOnce({ rows: [] })

            // Act & Assert
            await expect(
                saveProductAction({ name: 'Existing Product', sku: 'OWN-SKU' }, 42)
            ).resolves.not.toThrow()

            expect(JSON.stringify(mockDrizzleExecute.mock.calls[0][0])).toContain('p.id <>')
            expect(mockUpdate).toHaveBeenCalledOnce()
        })

        it('[TC-F08-SKU-GLOBAL-05] no sku provided → skips check, save proceeds', async () => {
            // Arrange — product with no sku field

            // Act
            await saveProductAction({ name: 'No SKU Product' })

            // Assert — exact SKU query is skipped when no SKU is submitted.
            expect(mockDrizzleExecute).not.toHaveBeenCalled()
            expect(mockCreate).toHaveBeenCalledOnce()
        })

        it('[TC-F08-SKU-GLOBAL-06] different tenant SKU → no conflict (tenant scoped)', async () => {
            // Arrange — mockFind returns empty (tenant filter excludes other tenants' products)
            mockDrizzleExecute.mockResolvedValueOnce({ rows: [] })

            // Act & Assert
            await expect(
                saveProductAction({ name: 'New Product', sku: 'OTHER-TENANT-SKU' })
            ).resolves.not.toThrow()
            expect(mockCreate).toHaveBeenCalledOnce()
        })

        it('[TC-F08-SKU-GLOBAL-07] both baseSku AND variant conflict → both paths in fieldErrors', async () => {
            // Arrange — DB has a product with both sku and variant sku conflicting
            mockDrizzleExecute.mockResolvedValueOnce({ rows: [{ sku: 'b-001' }, { sku: 'v-001' }] })

            // Act
            let thrown: Error | null = null
            try {
                await saveProductAction({
                    name: 'New Product',
                    sku: 'B-001',
                    variants: [{ sku: 'V-001' }],
                })
            } catch (e) { thrown = e as Error }

            // Assert — both field paths populated
            expect(thrown).not.toBeNull()
            const parsed = JSON.parse(thrown!.message)
            expect(parsed.code).toBe('FIELD_ERRORS')
            expect(parsed.fieldErrors).toHaveProperty('baseSku')
            expect(parsed.fieldErrors).toHaveProperty('variants.0.skuCode')
            expect(mockCreate).not.toHaveBeenCalled()
        })

        it('[TC-F08-SKU-GLOBAL-08] case-insensitive conflict detection → field error mapped correctly', async () => {
            // Arrange — DB stores 'SKU-001' (uppercase), input is 'sku-001' (lowercase)
            mockDrizzleExecute.mockResolvedValueOnce({ rows: [{ sku: 'sku-001' }] })

            // Act
            let thrown: Error | null = null
            try {
                await saveProductAction({ name: 'New Product', sku: 'sku-001' })
            } catch (e) { thrown = e as Error }

            // Assert — baseSku field error present despite case difference
            expect(thrown).not.toBeNull()
            const parsed = JSON.parse(thrown!.message)
            expect(parsed.code).toBe('FIELD_ERRORS')
            expect(parsed.fieldErrors).toHaveProperty('baseSku')
            expect(mockCreate).not.toHaveBeenCalled()
        })

        it('[TC-F08-SKU-GLOBAL-10] exact SQL checks base and variant SKUs without LIKE wildcards (shape-lock)', async () => {
            // Arrange — no conflicts; purpose is to capture and assert the exact SQL shape.
            mockDrizzleExecute.mockResolvedValueOnce({ rows: [] })

            // Act — both a base SKU and a variant SKU so both normalized comparisons are present.
            await saveProductAction({
                name: 'Probe Product',
                sku: 'BASE-001',
                variants: [{ sku: 'VAR-001' }],
            })

            // Assert — both tables use exact normalized comparison; SQL LIKE is absent.
            const sqlText = JSON.stringify(mockDrizzleExecute.mock.calls[0][0])
            expect(sqlText).toContain('lower(p.sku) IN')
            expect(sqlText).toContain('lower(v.sku) IN')
            expect(sqlText).toContain('products_variants')
            expect(sqlText).not.toContain('LIKE')
        })
    })

    // ── TC-09.38: alt-text fallback threading (GH-1458) ─────────────────────────

    describe('alt-text fallback (GH-1458)', () => {
        it('[TC-09.38] blank alt + tenant has a site name → "{name}"', async () => {
            vi.mocked(tenantIdForQuery).mockReturnValue(83)
            mockFind.mockImplementation((args: { collection: string }) =>
                args.collection === 'sites'
                    ? Promise.resolve({ docs: [{ id: 1, name: 'My Shop' }] })
                    : Promise.resolve({ docs: [] }))

            await saveProductAction({ name: 'Baju Pink', images: [{ image: 10, alt: '' }] })

            expect(mockFind).not.toHaveBeenCalled()
            expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({
                data: expect.objectContaining({ images: [{ image: 10, alt: 'Baju Pink' }] }),
            }))
        })

        it('[TC-09.38] non-blank alt passes through unchanged even when a store name is available', async () => {
            vi.mocked(tenantIdForQuery).mockReturnValue(83)
            mockFind.mockImplementation((args: { collection: string }) =>
                args.collection === 'sites'
                    ? Promise.resolve({ docs: [{ id: 1, name: 'My Shop' }] })
                    : Promise.resolve({ docs: [] }))

            await saveProductAction({ name: 'Baju Pink', images: [{ image: 10, alt: 'Custom alt text' }] })

            expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({
                data: expect.objectContaining({ images: [{ image: 10, alt: 'Custom alt text' }] }),
            }))
        })

        it('[TC-09.38] no tenant → no store lookup, falls back to product name only', async () => {
            vi.mocked(tenantIdForQuery).mockReturnValue(null)

            await saveProductAction({ name: 'Baju Pink', images: [{ image: 10, alt: '  ' }] })

            expect(mockFind).not.toHaveBeenCalled()
            expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({
                data: expect.objectContaining({ images: [{ image: 10, alt: 'Baju Pink' }] }),
            }))
        })

        it('[TC-09.38] no images provided → placeholder image gets the same buildProductAlt fallback', async () => {
            vi.mocked(tenantIdForQuery).mockReturnValue(83)
            mockGetOrCreateCrateCartonId.mockResolvedValue(99)
            mockFind.mockImplementation((args: { collection: string }) =>
                args.collection === 'sites'
                    ? Promise.resolve({ docs: [{ id: 1, name: 'My Shop' }] })
                    : Promise.resolve({ docs: [] }))

            await saveProductAction({ name: 'Baju Pink' })

            expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({
                data: expect.objectContaining({ images: [{ image: 99, alt: 'Baju Pink' }] }),
            }))
        })
    })

    // ── TC-09.39: save-as-draft regression (GH-1458) ────────────────────────────
    // Publishing gate (productPublishBlocks) never blocks a save that leaves `status` untouched
    // (Draft stays Draft) — only an explicit `status:'active'` in the payload triggers the gate
    // (see 'publishing gate (direct saveProductAction call)' describe below).

    describe('save-as-draft regression (GH-1458)', () => {
        it('[TC-09.39] missing category AND missing image alt → create succeeds (no gate on save)', async () => {
            const draftProduct = {
                name: 'Draft Product No Category No Alt',
                price: 100,
                images: [{ image: 10, alt: '' }],
                // category intentionally omitted
            }

            await expect(saveProductAction(draftProduct)).resolves.not.toThrow()

            expect(mockCreate).toHaveBeenCalledOnce()
            const call = mockCreate.mock.calls[0][0]
            expect(call.data.category).toBeUndefined()
            // saveProductAction never forces `status` — Payload's collection defaultValue:'draft'
            // (src/collections/Products.ts) applies at the DB layer for new products.
            expect(call.data.status).toBeUndefined()
        })

        it('[TC-09.39] editing an existing product (id provided), same missing fields → update succeeds', async () => {
            const draftProduct = {
                name: 'Draft Product Edit',
                images: [{ image: 10, alt: '' }],
            }

            await expect(saveProductAction(draftProduct, 42)).resolves.not.toThrow()

            expect(mockUpdate).toHaveBeenCalledOnce()
        })
    })

    // ── TC-09.45: publishing gate on direct saveProductAction calls (GH-1458, code-review fix) ──
    // Adversarial review found saveProductAction never called productPublishBlocks(), so a direct
    // call (bypassing the React form, which never sends `status` on edits) could smuggle
    // status:'active' + missing core fields straight past the gate. Fixed by gating whenever the
    // incoming `data.status === 'active'`, evaluated against the merged existing+incoming fields.

    describe('publishing gate on direct saveProductAction calls (GH-1458)', () => {
        it('[TC-09.45] create with status:active and missing sku/inventory/weight → throws PUBLISH_BLOCKED, no create', async () => {
            const incompleteActiveProduct = {
                name: 'Sneaky Active Product',
                price: 100,
                status: 'active',
                // sku/inventory/weight intentionally omitted
            }

            let thrown: Error | null = null
            try {
                await saveProductAction(incompleteActiveProduct)
            } catch (e) { thrown = e as Error }

            expect(thrown).not.toBeNull()
            const parsed = JSON.parse(thrown!.message)
            expect(parsed.code).toBe('PUBLISH_BLOCKED')
            expect(parsed.missingFields.sort()).toEqual(['inventory', 'sku', 'weight'])
            expect(mockCreate).not.toHaveBeenCalled()
        })

        it('[TC-09.45] edit with status:active, existing doc missing weight → throws PUBLISH_BLOCKED, no update', async () => {
            mockFindByID.mockResolvedValue({ id: 42, name: 'Test Product', price: 100, sku: 'SKU-1', inventory: 10 })
            const activatePayload = { name: 'Test Product', status: 'active' }

            let thrown: Error | null = null
            try {
                await saveProductAction(activatePayload, 42)
            } catch (e) { thrown = e as Error }

            expect(thrown).not.toBeNull()
            const parsed = JSON.parse(thrown!.message)
            expect(parsed.code).toBe('PUBLISH_BLOCKED')
            expect(parsed.missingFields).toEqual(['weight'])
            expect(mockUpdate).not.toHaveBeenCalled()
        })

        it('[TC-09.45] edit with status:active, merged existing+incoming fields are complete → update proceeds', async () => {
            mockFindByID.mockResolvedValue({ id: 42, name: 'Test Product', price: 100, sku: 'SKU-1', inventory: 10, weight: 500 })
            const activatePayload = { name: 'Test Product', status: 'active' }

            await expect(saveProductAction(activatePayload, 42)).resolves.not.toThrow()
            expect(mockUpdate).toHaveBeenCalledOnce()
        })

        it('[TC-09.45] create with status:active and all core fields present (including weight) → create proceeds', async () => {
            const completeActiveProduct = {
                name: 'Complete Active Product',
                price: 100,
                sku: 'SKU-COMPLETE',
                inventory: 10,
                weight: 500,
                status: 'active',
            }

            await expect(saveProductAction(completeActiveProduct)).resolves.not.toThrow()
            expect(mockCreate).toHaveBeenCalledOnce()
        })
    })

    // ── TC-09.50: id===0 falsy-zero bug (code-review fix) ──────────────────────
    describe('id===0 routes to update, not create (TC-09.50)', () => {
        it('[TC-09.50] saveProductAction(data, 0) calls payload.update, not payload.create', async () => {
            mockFindByID.mockResolvedValue({ id: 0, name: 'Test Product' })

            await saveProductAction({ name: 'Test Product' }, 0)

            expect(mockUpdate).toHaveBeenCalledOnce()
            expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ id: 0 }))
            expect(mockCreate).not.toHaveBeenCalled()
        })
    })

    // ── AI-review flag lifecycle (GH-1502) ────────────────────────────────────

    describe('aiReviewPending lifecycle (GH-1502)', () => {
        it('[TC-F08-04-35] update path (id provided) → forces aiReviewPending:false regardless of input', async () => {
            await saveProductAction({ name: 'Test Product', aiReviewPending: true }, 42)

            expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
                data: expect.objectContaining({ aiReviewPending: false }),
            }))
        })

        it('[TC-F08-04-36] create path (no id) → passes through caller-provided aiReviewPending unchanged', async () => {
            await saveProductAction({ name: 'Test Product', aiReviewPending: true })

            expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({
                data: expect.objectContaining({ aiReviewPending: true }),
            }))
        })
    })

    // ── DB-level SKU conflict translation (code-review follow-up, GH-1502) ────

    describe('translateDbSkuConflict (code-review follow-up)', () => {
        // Shape verified against the real, installed @payloadcms/drizzle source
        // (handleUpsertError.js) and confirmed live against the docker Postgres/Payload instance:
        // a raw pg 23505 is ALWAYS converted to this generic Payload ValidationError shape before
        // it reaches saveProductAction — the original pg `.code`/`.message`/`.constraint` never
        // survive. `path` is `null` for our raw-SQL indexes since Payload can't resolve a field
        // name for a constraint it didn't create itself (see actions.ts comment for the full trace).
        function makeUnresolvedUniqueViolation(path: string | null = null) {
            return Object.assign(new Error('The following field is invalid: '), {
                name: 'ValidationError',
                data: { collection: 'products', errors: [{ message: 'Value must be unique', path }] },
            })
        }

        it('[TC-F08-04-48] create path: unresolved unique-violation (our raw-SQL sku index) → translated into FIELD_ERRORS/baseSku shape', async () => {
            mockCreate.mockRejectedValueOnce(makeUnresolvedUniqueViolation())

            let thrown: Error | null = null
            try {
                await saveProductAction({ name: 'New Product', sku: 'DUP-001' })
            } catch (e) { thrown = e as Error }

            expect(thrown).not.toBeNull()
            const parsed = JSON.parse(thrown!.message)
            expect(parsed.code).toBe('FIELD_ERRORS')
            expect(parsed.fieldErrors.baseSku.code).toBe('SKU_ALREADY_IN_USE')
            expect(parsed.fieldErrors.baseSku.values).toEqual(['DUP-001'])
        })

        it('[TC-F08-04-49] update path: same violation is translated identically', async () => {
            mockUpdate.mockRejectedValueOnce(makeUnresolvedUniqueViolation())

            let thrown: Error | null = null
            try {
                await saveProductAction({ name: 'Existing Product', sku: 'DUP-002' }, 42)
            } catch (e) { thrown = e as Error }

            expect(thrown).not.toBeNull()
            const parsed = JSON.parse(thrown!.message)
            expect(parsed.code).toBe('FIELD_ERRORS')
            expect(parsed.fieldErrors.baseSku.values).toEqual(['DUP-002'])
        })

        it('[TC-F08-04-50a] a resolved slug unique-violation (path:"slug") is re-thrown unchanged, not misreported as a SKU conflict', async () => {
            const dbErr = makeUnresolvedUniqueViolation('slug')
            mockCreate.mockRejectedValueOnce(dbErr)

            let thrown: Error | null = null
            try {
                await saveProductAction({ name: 'New Product' })
            } catch (e) { thrown = e as Error }

            expect(thrown).toBe(dbErr) // passed through unchanged, not our JSON shape
            expect(() => JSON.parse(thrown!.message)).toThrow()
        })

        it('[TC-F08-04-50b] KNOWN LIMITATION: a same-product variant-SKU violation is indistinguishable from a base-sku one and is also classified as baseSku', async () => {
            // Payload's ValidationError carries no constraint name for either of our raw-SQL
            // indexes, so a products_variants_sku_parent_uniq hit produces the identical generic
            // shape as a products_sku_tenant_uniq hit. This test documents the accepted trade-off
            // (see actions.ts translateDbSkuConflict comment) rather than asserting ideal behavior.
            mockCreate.mockRejectedValueOnce(makeUnresolvedUniqueViolation())

            let thrown: Error | null = null
            try {
                await saveProductAction({ name: 'New Product', sku: 'BASE-1', variants: [{ sku: 'DUP-VAR' }] })
            } catch (e) { thrown = e as Error }

            expect(thrown).not.toBeNull()
            const parsed = JSON.parse(thrown!.message)
            expect(parsed.code).toBe('FIELD_ERRORS')
            expect(parsed.fieldErrors).toHaveProperty('baseSku') // not a variants.N.skuCode key — the limitation
        })

        it('[TC-F08-04-50c] an unrelated (non-ValidationError) error passes through untouched', async () => {
            mockCreate.mockRejectedValueOnce(new Error('Network timeout'))

            await expect(saveProductAction({ name: 'New Product' })).rejects.toThrow('Network timeout')
        })
    })
})

describe('updateProductFieldAction', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.mocked(getCurrentUser).mockResolvedValue({ id: 'u1', email: 'test@example.com' } as never)
        mockUpdate.mockResolvedValue({ id: 42, status: 'active' })
        // price/sku/inventory/weight set so these non-gate-focused tests pass the GH-1458 publishing
        // gate by default when they set status:'active' — see 'publishing gate' describe below
        // for dedicated gate coverage.
        mockFindByID.mockResolvedValue({ id: 42, name: 'Test Product', tenant: 68, price: 100, sku: 'SKU-001', inventory: 10, weight: 500 })
    })

    // ── ID Guard ──────────────────────────────────────────────────────────────

    it('[TC-F08-01-27] null id → throws Invalid product ID', async () => {
        await expect(updateProductFieldAction(null as never, { status: 'active' })).rejects.toThrow('Invalid product ID')
        expect(mockUpdate).not.toHaveBeenCalled()
    })

    it('[TC-F08-01-27] undefined id → throws Invalid product ID', async () => {
        await expect(updateProductFieldAction(undefined as never, { status: 'active' })).rejects.toThrow('Invalid product ID')
        expect(mockUpdate).not.toHaveBeenCalled()
    })

    it('[TC-F08-01-27] empty string id → throws Invalid product ID', async () => {
        await expect(updateProductFieldAction('', { status: 'active' })).rejects.toThrow('Invalid product ID')
        expect(mockUpdate).not.toHaveBeenCalled()
    })

    it('[TC-F08-01-27] id=0 → guard allows through (valid DB id)', async () => {
        await updateProductFieldAction(0, { status: 'active' })
        expect(mockUpdate).toHaveBeenCalledOnce()
    })

    // ── Auth ──────────────────────────────────────────────────────────────────

    it('[TC-F08-01-29] unauthenticated → throws Unauthorized before findByID or update', async () => {
        vi.mocked(getCurrentUser).mockResolvedValue(null)
        await expect(updateProductFieldAction(42, { status: 'active' })).rejects.toThrow('Unauthorized')
        expect(mockFindByID).not.toHaveBeenCalled()
        expect(mockUpdate).not.toHaveBeenCalled()
    })

    // ── Field allowlist ───────────────────────────────────────────────────────

    it('[TC-F08-01-28] disallowed field → throws ZodError before payload.update', async () => {
        await expect(updateProductFieldAction(42, { tenant: 99 })).rejects.toThrow()
        expect(mockUpdate).not.toHaveBeenCalled()
    })

    it('[TC-F08-01-28] valid field (deletedAt) → findByID access-gate then update with overrideAccess', async () => {
        // Arrange — findByID confirms product exists and user has access (default beforeEach mock)

        // Act
        await updateProductFieldAction(42, { deletedAt: null })

        // Assert — access gate via findByID (with user context)
        expect(mockFindByID).toHaveBeenCalledWith(expect.objectContaining({
            collection: 'products',
            id: 42,
            user: expect.objectContaining({ id: 'u1' }),
        }))
        // Assert — update uses overrideAccess:true to bypass Payload/Neon WHERE bug for variant docs
        // data also contains variants/variantConfigs (stripped of auto-managed 'id')
        expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
            collection: 'products',
            id: 42,
            data: expect.objectContaining({ deletedAt: null }),
            overrideAccess: true,
        }))
    })

    it('[TC-F08-01-29b] product not found / no access → throws before update', async () => {
        // Arrange — findByID returns null (product not found or tenant mismatch)
        mockFindByID.mockResolvedValue(null)

        // Act & Assert
        await expect(updateProductFieldAction(42, { status: 'active' })).rejects.toThrow('Product not found or access denied')
        expect(mockUpdate).not.toHaveBeenCalled()
    })

    // ── Payload 3.79 variant id-strip ─────────────────────────────────────────

    it('[TC-F08-01-32] product with variants → auto-managed id stripped from variants/variantConfigs before update', async () => {
        // Arrange — product with variants that have Payload's auto-managed UUID 'id' on each row
        mockFindByID.mockResolvedValue({
            id: 42,
            name: 'Test Product',
            tenant: 68,
            hasVariants: true,
            sku: 'BASE-SKU',
            weight: 500,
            variants: [
                { id: 'uuid-v1', name: 'Red/S', sku: 'P-R-S', price: 10, stock: 5 },
                { id: 'uuid-v2', name: 'Blue/M', sku: 'P-B-M', price: 10, stock: 3 },
            ],
            variantConfigs: [
                {
                    id: 'uuid-vc1',
                    name: 'Color',
                    options: [
                        { id: 'uuid-o1', value: 'Red' },
                        { id: 'uuid-o2', value: 'Blue' },
                    ],
                },
            ],
        })

        // Act
        await updateProductFieldAction(42, { status: 'active' })

        // Assert — auto-managed 'id' must not reach payload.update (Payload 3.79 traverseFields bug)
        const call = mockUpdate.mock.calls[0][0]
        expect(call.data.variants[0]).not.toHaveProperty('id')
        expect(call.data.variants[1]).not.toHaveProperty('id')
        expect(call.data.variantConfigs[0]).not.toHaveProperty('id')
        expect(call.data.variantConfigs[0].options[0]).not.toHaveProperty('id')
        expect(call.data.variantConfigs[0].options[1]).not.toHaveProperty('id')
        // Non-id fields must be preserved
        expect(call.data.variants[0]).toMatchObject({ name: 'Red/S', sku: 'P-R-S', price: 10, stock: 5 })
        expect(call.data.variantConfigs[0]).toMatchObject({ name: 'Color' })
    })

    // ── TC-09.37: soft validation publishing gate (GH-1458) ────────────────────

    describe('publishing gate (GH-1458)', () => {
        it('[TC-09.37] status:active on product missing price/sku/inventory/weight → throws PUBLISH_BLOCKED, no update', async () => {
            // Arrange — persisted product has none of the core fields
            mockFindByID.mockResolvedValue({ id: 42, name: 'Test Product', tenant: 68 })

            // Act & Assert
            let thrown: Error | null = null
            try {
                await updateProductFieldAction(42, { status: 'active' })
            } catch (e) { thrown = e as Error }

            expect(thrown).not.toBeNull()
            const parsed = JSON.parse(thrown!.message)
            expect(parsed.code).toBe('PUBLISH_BLOCKED')
            expect(parsed.missingFields.sort()).toEqual(['inventory', 'price', 'sku', 'weight'])
            expect(mockUpdate).not.toHaveBeenCalled()
        })

        it('[TC-09.37] status:active on complete product → proceeds to payload.update', async () => {
            // Arrange — beforeEach default already sets price/sku/inventory

            // Act
            await updateProductFieldAction(42, { status: 'active' })

            // Assert
            expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
                collection: 'products',
                id: 42,
                data: expect.objectContaining({ status: 'active' }),
            }))
        })

        it('[TC-09.37] status:active on variant product missing variants matrix → throws PUBLISH_BLOCKED', async () => {
            // Arrange — hasVariants true but matrix empty
            mockFindByID.mockResolvedValue({ id: 42, name: 'Test Product', tenant: 68, hasVariants: true, sku: 'BASE-SKU', weight: 500, variants: [] })

            // Act & Assert
            let thrown: Error | null = null
            try {
                await updateProductFieldAction(42, { status: 'active' })
            } catch (e) { thrown = e as Error }

            expect(thrown).not.toBeNull()
            const parsed = JSON.parse(thrown!.message)
            expect(parsed.code).toBe('PUBLISH_BLOCKED')
            expect(parsed.missingFields).toEqual(['variants'])
            expect(mockUpdate).not.toHaveBeenCalled()
        })

        it('[TC-09.37] status:archived on incomplete product → gate NOT applied, update proceeds', async () => {
            // Arrange — incomplete product, but only Draft/Archived -> Active is gated
            mockFindByID.mockResolvedValue({ id: 42, name: 'Test Product', tenant: 68 })

            // Act
            await updateProductFieldAction(42, { status: 'archived' })

            // Assert — no gate check for non-active transitions
            expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
                collection: 'products',
                id: 42,
                data: expect.objectContaining({ status: 'archived' }),
            }))
        })

        it('[TC-09.37] price:0 and inventory:0 on complete-otherwise product → NOT blocked', async () => {
            // Arrange — zero values must not be treated as missing (matches Phase 1 guard behavior)
            mockFindByID.mockResolvedValue({ id: 42, name: 'Test Product', tenant: 68, price: 0, sku: 'SKU-ZERO', inventory: 0, weight: 500 })

            // Act
            await updateProductFieldAction(42, { status: 'active' })

            // Assert
            expect(mockUpdate).toHaveBeenCalledOnce()
        })

        it('[TC-09.37] weight:0 on otherwise-complete product → throws PUBLISH_BLOCKED (weight required)', async () => {
            // Arrange — weight:0 is the collection default, never a valid physical weight
            mockFindByID.mockResolvedValue({ id: 42, name: 'Test Product', tenant: 68, price: 100, sku: 'SKU-001', inventory: 10, weight: 0 })

            // Act & Assert
            let thrown: Error | null = null
            try {
                await updateProductFieldAction(42, { status: 'active' })
            } catch (e) { thrown = e as Error }

            expect(thrown).not.toBeNull()
            const parsed = JSON.parse(thrown!.message)
            expect(parsed.code).toBe('PUBLISH_BLOCKED')
            expect(parsed.missingFields).toEqual(['weight'])
            expect(mockUpdate).not.toHaveBeenCalled()
        })
    })

    // ── AI-review flag lifecycle (GH-1502) ────────────────────────────────────

    describe('aiReviewPending lifecycle (GH-1502)', () => {
        it('[TC-F08-04-37] status:active → update data includes aiReviewPending:false', async () => {
            await updateProductFieldAction(42, { status: 'active' })

            expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
                data: expect.objectContaining({ aiReviewPending: false }),
            }))
        })

        it('[TC-F08-04-38] status:archived → update data does NOT include aiReviewPending', async () => {
            await updateProductFieldAction(42, { status: 'archived' })

            const call = mockUpdate.mock.calls[0][0]
            expect(call.data).not.toHaveProperty('aiReviewPending')
        })

        it('[TC-F08-04-39] deletedAt branch → update data does NOT include aiReviewPending', async () => {
            await updateProductFieldAction(42, { deletedAt: null })

            const call = mockUpdate.mock.calls[0][0]
            expect(call.data).not.toHaveProperty('aiReviewPending')
        })
    })
})

describe('[TC-F08-04-105] saveAiProductAction category boundary', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.mocked(getCurrentUser).mockResolvedValue({ id: 'u1', email: 'test@example.com' } as never)
        vi.mocked(tenantIdForQuery).mockReturnValue(68)
        mockFind.mockResolvedValue({ docs: [] })
        mockCreate.mockResolvedValue({ id: 42, name: 'Test Product' })
        mockUpdate.mockResolvedValue({ id: 42, deletedAt: '2026-07-29T00:00:00.000Z' })
        mockFindByID.mockResolvedValue({ id: 42, name: 'Test Product' })
        mockDrizzleExecute.mockResolvedValue({ rows: [] })
        mockWithActiveCategoryRowLock.mockImplementation(
            async (_payload, _categoryId, _tenantId, operation) => operation(123, { transactionID: 'category-tx' }),
        )
        mockGetOrCreateCrateCartonId.mockResolvedValue(null)
    })

    it('accepts exactly one active tenant category and forces an AI draft', async () => {
        await saveAiProductAction({
            ...PRODUCT_WITH_IMAGES,
            category: ['123'],
            status: 'active',
            aiReviewPending: false,
        })

        expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({
                category: [123],
                status: 'draft',
                aiReviewPending: true,
                tenant: 68,
            }),
        }))
    })

    it.each([
        undefined,
        null,
        [],
        [1, 2],
        ['not-an-id'],
        [''],
        [0],
        [-1],
        [1.5],
        ['1.5'],
        [2_147_483_648],
    ])('returns CATEGORY_INVALID for malformed category selection before querying or creating: %j', async category => {
        await expect(saveAiProductAction({
            ...PRODUCT_WITH_IMAGES,
            category,
        })).resolves.toMatchObject({
            ok: false,
            code: 'CATEGORY_INVALID',
        })

        expect(mockWithActiveCategoryRowLock).not.toHaveBeenCalled()
        expect(mockCreate).not.toHaveBeenCalled()
    })

    it('returns CATEGORY_INVALID for a category that is missing, deleted, or outside the current tenant', async () => {
        mockWithActiveCategoryRowLock.mockResolvedValue(null)

        await expect(saveAiProductAction({
            ...PRODUCT_WITH_IMAGES,
            category: [123],
        })).resolves.toMatchObject({
            ok: false,
            code: 'CATEGORY_INVALID',
        })

        expect(mockCreate).not.toHaveBeenCalled()
    })

    it('writes the Product through the same bounded tenant-category transaction', async () => {
        await saveAiProductAction({
            ...PRODUCT_WITH_IMAGES,
            category: [123],
        })

        expect(mockWithActiveCategoryRowLock).toHaveBeenCalledWith(
            expect.anything(),
            123,
            68,
            expect.any(Function),
        )
        expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({
            req: { transactionID: 'category-tx' },
        }))
        expect(mockCreate.mock.calls[0][0]).not.toHaveProperty('disableTransaction')
        expect(mockFindByID).not.toHaveBeenCalled()
        expect(getCurrentUser).toHaveBeenCalledOnce()
        expect(tenantIdForQuery).toHaveBeenCalledOnce()
    })

    it('returns the existing AI draft for a stable-slug replay without creating a duplicate', async () => {
        const stableSlug = 'test-product-ai-1234567890abcdef1234567890abcdef'
        mockFind.mockResolvedValueOnce({ docs: [{ id: 42, slug: stableSlug, aiReviewPending: true, category: [123] }] })

        await expect(saveAiProductAction({
            ...PRODUCT_WITH_IMAGES,
            slug: stableSlug,
            category: [123],
        })).resolves.toMatchObject({ id: 42, slug: stableSlug })

        expect(mockFind).toHaveBeenCalledWith(expect.objectContaining({
            collection: 'products',
            where: {
                and: [
                    { deletedAt: { exists: false } },
                    { tenant: { equals: 68 } },
                    { slug: { equals: stableSlug } },
                    { aiReviewPending: { equals: true } },
                ],
            },
            pagination: false,
        }))
        expect(mockWithActiveCategoryRowLock).not.toHaveBeenCalled()
        expect(mockCreate).not.toHaveBeenCalled()
    })

    it('recovers an AI draft committed before an ambiguous transaction error', async () => {
        const stableSlug = 'test-product-ai-fedcba0987654321fedcba0987654321'
        mockFind
            .mockResolvedValueOnce({ docs: [] })
            .mockResolvedValueOnce({ docs: [{ id: 43, slug: stableSlug, aiReviewPending: true, category: [123] }] })
        mockWithActiveCategoryRowLock.mockRejectedValueOnce(new Error('commit acknowledgement lost'))

        await expect(saveAiProductAction({
            ...PRODUCT_WITH_IMAGES,
            slug: stableSlug,
            category: [123],
        })).resolves.toMatchObject({ id: 43, slug: stableSlug })

        expect(mockFind).toHaveBeenCalledTimes(2)
        expect(mockCreate).not.toHaveBeenCalled()
    })

    it('[TC-F08-04-113] rejects a different-category replay visible during the initial lookup', async () => {
        // Arrange
        const stableSlug = 'test-product-ai-abcdef1234567890abcdef1234567890'
        const committedInCategoryA = {
            id: 43,
            slug: stableSlug,
            aiReviewPending: true,
            category: [123],
        }
        mockFind.mockResolvedValueOnce({ docs: [committedInCategoryA] })

        // Act & Assert
        await expect(saveAiProductAction({
            ...PRODUCT_WITH_IMAGES,
            slug: stableSlug,
            category: [456],
        })).rejects.toThrow('This AI draft was already saved to a different category')

        expect(mockFind).toHaveBeenCalledOnce()
        expect(mockWithActiveCategoryRowLock).not.toHaveBeenCalled()
        expect(mockCreate).not.toHaveBeenCalled()
    })

    it('[TC-F08-04-113] rejects a different-category winner found after a concurrent unique collision', async () => {
        // Arrange
        const stableSlug = 'test-product-ai-0123456789abcdef0123456789abcdef'
        const committedInCategoryA = {
            id: 44,
            slug: stableSlug,
            aiReviewPending: true,
            category: [123],
        }
        mockFind
            .mockResolvedValueOnce({ docs: [] })
            .mockResolvedValueOnce({ docs: [committedInCategoryA] })
        mockCreate.mockRejectedValueOnce(new Error('Value must be unique: slug'))

        // Act & Assert
        await expect(saveAiProductAction({
            ...PRODUCT_WITH_IMAGES,
            slug: stableSlug,
            category: [456],
        })).rejects.toThrow('This AI draft was already saved to a different category')

        expect(mockFind).toHaveBeenCalledTimes(2)
        expect(mockWithActiveCategoryRowLock).toHaveBeenCalledWith(
            expect.anything(),
            456,
            68,
            expect.any(Function),
        )
        expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({ slug: stableSlug }),
        }))
    })

    it('[TC-F08-04-114] replays a same-category winner after a concurrent unique collision', async () => {
        // Arrange
        const stableSlug = 'test-product-ai-11111111111111111111111111111111'
        const committedInSameCategory = {
            id: 45,
            slug: stableSlug,
            aiReviewPending: true,
            category: [123],
        }
        mockFind
            .mockResolvedValueOnce({ docs: [] })
            .mockResolvedValueOnce({ docs: [committedInSameCategory] })
        mockCreate.mockRejectedValueOnce(new Error('Value must be unique: slug'))

        // Act
        const result = await saveAiProductAction({
            ...PRODUCT_WITH_IMAGES,
            slug: stableSlug,
            category: [123],
        })

        // Assert
        expect(result).toMatchObject({ id: 45, slug: stableSlug })
        expect(mockFind).toHaveBeenCalledTimes(2)
        expect(mockWithActiveCategoryRowLock).toHaveBeenCalledWith(
            expect.anything(),
            123,
            68,
            expect.any(Function),
        )
        expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({ slug: stableSlug }),
        }))
    })

    it('[TC-F08-04-111] exposes a clear retry message when the category lock is busy', async () => {
        mockWithActiveCategoryRowLock.mockRejectedValue(new Error('CATEGORY_BUSY_RETRY'))

        await expect(saveAiProductAction({
            ...PRODUCT_WITH_IMAGES,
            category: [123],
        })).rejects.toThrow('This category is busy. Please try again.')

        expect(mockCreate).not.toHaveBeenCalled()
    })

    it('does not change the manual save contract', async () => {
        await saveProductAction({
            ...PRODUCT_WITH_IMAGES,
            category: [123],
            status: 'draft',
        })

        expect(mockFind).not.toHaveBeenCalled()
        expect(mockWithActiveCategoryRowLock).not.toHaveBeenCalled()
        expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({ category: [123], status: 'draft' }),
            disableTransaction: true,
        }))
        expect(mockCreate.mock.calls[0][0]).not.toHaveProperty('req')
        expect(mockFindByID).toHaveBeenCalledWith(expect.objectContaining({
            collection: 'products',
            id: 42,
        }))
    })
})

describe('getProductAction', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.mocked(getCurrentUser).mockResolvedValue({ id: 'u1', email: 'test@example.com' } as never)
        mockUpdate.mockResolvedValue({ id: 42, aiReviewPending: false })
    })

    // ── AI-review flag: clear on view, not just on save (GH-1502 view-clears-flag) ──────

    it('[TC-F08-04-60] aiReviewPending:true → clears the flag immediately on fetch', async () => {
        mockFindByID.mockResolvedValue({ id: 42, name: 'Test Product', aiReviewPending: true })

        const result = await getProductAction(42)

        expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
            collection: 'products',
            id: 42,
            data: expect.objectContaining({ aiReviewPending: false }),
        }))
        expect(result.aiReviewPending).toBe(false)
    })

    it('[TC-F08-04-61] aiReviewPending:false → no extra write issued', async () => {
        mockFindByID.mockResolvedValue({ id: 42, name: 'Test Product', aiReviewPending: false })

        await getProductAction(42)

        expect(mockUpdate).not.toHaveBeenCalled()
    })

    it('[TC-F08-04-62] flag-clear write fails → getProductAction still resolves with the fetched data (read is not broken by a secondary-write failure)', async () => {
        mockFindByID.mockResolvedValue({ id: 42, name: 'Test Product', aiReviewPending: true })
        mockUpdate.mockRejectedValue(new Error('transient DB error'))

        const result = await getProductAction(42)

        expect(result.name).toBe('Test Product')
        // Write failed, so we don't claim it succeeded — flag stays as fetched (true).
        expect(result.aiReviewPending).toBe(true)
    })
})
