// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockFind, mockCreate, mockUpdate, mockFindByID, mockGetOrCreateCrateCartonId } = vi.hoisted(() => ({
    mockFind: vi.fn(),
    mockCreate: vi.fn(),
    mockUpdate: vi.fn(),
    mockFindByID: vi.fn(),
    mockGetOrCreateCrateCartonId: vi.fn(),
}))

vi.mock('payload', () => ({
    getPayload: vi.fn().mockResolvedValue({
        find: mockFind,
        create: mockCreate,
        update: mockUpdate,
        findByID: mockFindByID,
    }),
}))
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('@/lib/auth', () => ({
    getCurrentUser: vi.fn().mockResolvedValue({ id: 'u1', email: 'test@example.com' }),
    extractTenantId: vi.fn().mockReturnValue(null),
}))
vi.mock('@/lib/subscriptions/plan-subscription', () => ({
    getActivePlanSubscription: vi.fn().mockResolvedValue({
        id: 'mock-sub-1', plan: 'PROFESSIONAL_TM_USER', status: 'active', startDate: '2026-01-01T00:00:00.000Z',
    }),
    canUse: vi.fn().mockResolvedValue(true),
    canUseWithinLimit: vi.fn().mockResolvedValue(true),
}))
// Mock dynamic import of getOrCreateCrateCartonIdAction
vi.mock('@/app/(dashboard)/actions/media', () => ({
    getOrCreateCrateCartonIdAction: mockGetOrCreateCrateCartonId,
    uploadMediaAction: vi.fn(),
}))

import { saveProductAction, updateProductFieldAction } from '@/app/(dashboard)/products/actions'
import { getCurrentUser, extractTenantId } from '@/lib/auth'

const VALID_PRODUCT = { name: 'Test Product', price: 100 }
const PRODUCT_WITH_IMAGES = {
    name: 'Test Product',
    images: [{ image: 10, alt: 'some image' }],
}

describe('saveProductAction', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.mocked(getCurrentUser).mockResolvedValue({ id: 'u1', email: 'test@example.com' } as never)
        vi.mocked(extractTenantId).mockReturnValue(null)
        mockFind.mockResolvedValue({ docs: [] })
        mockCreate.mockResolvedValue({ id: 42, name: 'Test Product' })
        mockUpdate.mockResolvedValue({ id: 42, name: 'Test Product' })
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
            mockFind.mockResolvedValueOnce({ docs: [{ id: 99, sku: 'SKU-001' }] })

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
            expect(mockFind).toHaveBeenCalledWith(expect.objectContaining({
                collection: 'products',
                limit: 100,
                depth: 0,
            }))
            expect(mockCreate).not.toHaveBeenCalled()
        })

        it('[TC-F08-SKU-GLOBAL-02] variant sku conflicts → throws JSON field error on variants.0.skuCode', async () => {
            // Arrange
            mockFind.mockResolvedValueOnce({ docs: [{ id: 99, variants: [{ sku: 'VAR-001' }] }] })

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

        it('[TC-F08-SKU-GLOBAL-03] sku conflicts with soft-deleted product → allowed (no throw)', async () => {
            // Arrange — soft-deleted product excluded by query filter, mockFind returns empty
            mockFind.mockResolvedValueOnce({ docs: [] })

            // Act & Assert — no error thrown
            await expect(
                saveProductAction({ name: 'New Product', sku: 'DELETED-SKU' })
            ).resolves.not.toThrow()
            expect(mockCreate).toHaveBeenCalledOnce()
        })

        it('[TC-F08-SKU-GLOBAL-04] update — same product own SKU → allowed (self excluded)', async () => {
            // Arrange — Payload excludes id=42 from query, returns empty
            mockFind.mockResolvedValueOnce({ docs: [] })

            // Act & Assert
            await expect(
                saveProductAction({ name: 'Existing Product', sku: 'OWN-SKU' }, 42)
            ).resolves.not.toThrow()

            expect(mockFind).toHaveBeenCalledWith(expect.objectContaining({
                where: expect.objectContaining({
                    and: expect.arrayContaining([
                        { id: { not_equals: 42 } },
                    ]),
                }),
            }))
            expect(mockUpdate).toHaveBeenCalledOnce()
        })

        it('[TC-F08-SKU-GLOBAL-05] no sku provided → skips check, save proceeds', async () => {
            // Arrange — product with no sku field

            // Act
            await saveProductAction({ name: 'No SKU Product' })

            // Assert — mockFind not called for SKU check (only carton lookup would call find)
            expect(mockFind).not.toHaveBeenCalled()
            expect(mockCreate).toHaveBeenCalledOnce()
        })

        it('[TC-F08-SKU-GLOBAL-06] different tenant SKU → no conflict (tenant scoped)', async () => {
            // Arrange — mockFind returns empty (tenant filter excludes other tenants' products)
            mockFind.mockResolvedValueOnce({ docs: [] })

            // Act & Assert
            await expect(
                saveProductAction({ name: 'New Product', sku: 'OTHER-TENANT-SKU' })
            ).resolves.not.toThrow()
            expect(mockCreate).toHaveBeenCalledOnce()
        })

        it('[TC-F08-SKU-GLOBAL-07] both baseSku AND variant conflict → both paths in fieldErrors', async () => {
            // Arrange — DB has a product with both sku and variant sku conflicting
            mockFind.mockResolvedValueOnce({
                docs: [{ id: 99, sku: 'B-001', variants: [{ sku: 'V-001' }] }],
            })

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
            mockFind.mockResolvedValueOnce({ docs: [{ id: 99, sku: 'SKU-001' }] })

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

        it('[TC-F08-SKU-GLOBAL-09] totalDocs > docs.length → throws plain verification error (not FIELD_ERRORS)', async () => {
            // Arrange — Payload reports 150 matching docs but only returns first 100
            mockFind.mockResolvedValueOnce({
                docs: Array.from({ length: 100 }, (_, i) => ({ id: i + 1, sku: `OTHER-${i}` })),
                totalDocs: 150,
            })

            // Act
            let thrown: Error | null = null
            try {
                await saveProductAction({ name: 'New Product', sku: 'SKU-NEW' })
            } catch (e) { thrown = e as Error }

            // Assert — plain Error (not FIELD_ERRORS JSON), human-readable
            expect(thrown).not.toBeNull()
            expect(thrown!.message).toContain('Cannot verify SKU uniqueness')
            expect(() => JSON.parse(thrown!.message)).toThrow() // not JSON
            expect(mockCreate).not.toHaveBeenCalled()
        })

        it('[TC-F08-SKU-GLOBAL-10] WHERE clause includes both sku and variants.sku branches (shape-lock)', async () => {
            // Arrange — no conflicts; purpose is to capture and assert the exact WHERE shape
            mockFind.mockResolvedValueOnce({ docs: [], totalDocs: 0 })

            // Act — both a base SKU and a variant SKU so both IN arrays are non-empty
            await saveProductAction({
                name: 'Probe Product',
                sku: 'BASE-001',
                variants: [{ sku: 'VAR-001' }],
            })

            // Assert — verify the WHERE clause passed to payload.find contains both OR branches
            const call = mockFind.mock.calls[0][0]
            const where = call.where as { and: Array<Record<string, unknown>> }
            expect(where).toHaveProperty('and')
            const orBranch = where.and.find(c => 'or' in c) as { or: Array<Record<string, unknown>> } | undefined
            expect(orBranch).toBeDefined()
            expect(orBranch!.or).toEqual(expect.arrayContaining([
                expect.objectContaining({ sku: expect.objectContaining({ in: expect.arrayContaining(['BASE-001', 'VAR-001']) }) }),
                expect.objectContaining({ 'variants.sku': expect.objectContaining({ in: expect.arrayContaining(['BASE-001', 'VAR-001']) }) }),
            ]))
        })
    })
})

describe('updateProductFieldAction', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.mocked(getCurrentUser).mockResolvedValue({ id: 'u1', email: 'test@example.com' } as never)
        mockUpdate.mockResolvedValue({ id: 42, status: 'active' })
        mockFindByID.mockResolvedValue({ id: 42, name: 'Test Product', tenant: 68 })
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
})
