// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockFind, mockCreate, mockUpdate, mockGetOrCreateCrateCartonId } = vi.hoisted(() => ({
    mockFind: vi.fn(),
    mockCreate: vi.fn(),
    mockUpdate: vi.fn(),
    mockGetOrCreateCrateCartonId: vi.fn(),
}))

vi.mock('payload', () => ({
    getPayload: vi.fn().mockResolvedValue({
        find: mockFind,
        create: mockCreate,
        update: mockUpdate,
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

import { saveProductAction } from '@/app/(dashboard)/products/actions'
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
