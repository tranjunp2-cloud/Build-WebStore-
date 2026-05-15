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
}))
// Mock dynamic import of getOrCreateCrateCartonIdAction
vi.mock('@/app/(dashboard)/actions/media', () => ({
    getOrCreateCrateCartonIdAction: mockGetOrCreateCrateCartonId,
    uploadMediaAction: vi.fn(),
}))

import { saveProductAction, updateProductFieldAction } from '@/app/(dashboard)/products/actions'
import { getCurrentUser } from '@/lib/auth'

const VALID_PRODUCT = { name: 'Test Product', price: 100 }
const PRODUCT_WITH_IMAGES = {
    name: 'Test Product',
    images: [{ image: 10, alt: 'some image' }],
}

describe('saveProductAction', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.mocked(getCurrentUser).mockResolvedValue({ id: 'u1', email: 'test@example.com' } as never)
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
        expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
            collection: 'products',
            id: 42,
            data: { deletedAt: null },
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
})
