// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const { mockFind, mockCreate, mockDelete, mockExistsSync, mockReadFileSync } = vi.hoisted(() => ({
    mockFind: vi.fn(),
    mockCreate: vi.fn(),
    mockDelete: vi.fn(),
    mockExistsSync: vi.fn(),
    mockReadFileSync: vi.fn(),
}))

vi.mock('payload', () => ({
    getPayload: vi.fn().mockResolvedValue({
        find: mockFind,
        create: mockCreate,
        delete: mockDelete,
    }),
}))
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('@/lib/auth', () => ({
    getCurrentUser: vi.fn(),
    extractTenantId: vi.fn(),
}))
vi.mock('fs', () => ({
    default: {
        existsSync: mockExistsSync,
        readFileSync: mockReadFileSync,
    },
    existsSync: mockExistsSync,
    readFileSync: mockReadFileSync,
}))

import { getOrCreateCrateCartonIdAction } from '@/app/(dashboard)/actions/media'
import { getCurrentUser, extractTenantId } from '@/lib/auth'

const S3_ENDPOINT = 'https://s3.example.com'
const TENANT_ID = 'tenant-abc'
const TENANT_ALT = `Crate Carton Placeholder - ${TENANT_ID}`
// User with no tenants falls back to the shared alt key
const FALLBACK_ALT = 'Crate Carton Placeholder'

const mockUserWithTenant = { id: 'u1', email: 'test@example.com', tenants: [{ tenant: TENANT_ID }] }
const mockUserNoTenant = { id: 'u2', email: 'notenant@example.com' }

describe('getOrCreateCrateCartonIdAction', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.mocked(getCurrentUser).mockResolvedValue(mockUserWithTenant as never)
        vi.mocked(extractTenantId).mockReturnValue(TENANT_ID)
        mockExistsSync.mockReturnValue(true)
        mockReadFileSync.mockReturnValue(Buffer.from('fake-png'))
        mockCreate.mockResolvedValue({ id: 99, url: `${S3_ENDPOINT}/bucket/crate-carton-placeholder.png` })
        mockDelete.mockResolvedValue({ id: 5 })
    })

    afterEach(() => {
        vi.unstubAllEnvs()
    })

    it('[TC-F08-04-04] no existing record + S3 configured → creates and returns new id', async () => {
        // Arrange
        vi.stubEnv('NEXT_PUBLIC_S3_ENDPOINT', S3_ENDPOINT)
        mockFind.mockResolvedValue({ docs: [], totalDocs: 0 })

        // Act
        const result = await getOrCreateCrateCartonIdAction()

        // Assert
        expect(mockDelete).not.toHaveBeenCalled()
        expect(mockCreate).toHaveBeenCalledOnce()
        expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({
            data: { alt: TENANT_ALT },
            file: expect.objectContaining({ name: 'crate-carton-placeholder.png', mimetype: 'image/png' }),
        }))
        expect(result).toBe(99)
    })

    it('[TC-F08-04-04] existing record with url matching S3 endpoint → returns id, no delete/create', async () => {
        // Arrange
        vi.stubEnv('NEXT_PUBLIC_S3_ENDPOINT', S3_ENDPOINT)
        mockFind.mockResolvedValue({
            docs: [{ id: 5, url: `${S3_ENDPOINT}/bucket/crate-carton.png`, alt: TENANT_ALT }],
            totalDocs: 1,
        })

        // Act
        const result = await getOrCreateCrateCartonIdAction()

        // Assert
        expect(mockDelete).not.toHaveBeenCalled()
        expect(mockCreate).not.toHaveBeenCalled()
        expect(result).toBe(5)
    })

    it('[TC-F08-04-04] existing record with stale host → deletes stale + creates, returns new id', async () => {
        // Arrange
        vi.stubEnv('NEXT_PUBLIC_S3_ENDPOINT', S3_ENDPOINT)
        mockFind.mockResolvedValue({
            docs: [{ id: 5, url: 'https://old-minio.internal/bucket/crate-carton.png' }],
            totalDocs: 1,
        })

        // Act
        const result = await getOrCreateCrateCartonIdAction()

        // Assert
        expect(mockDelete).toHaveBeenCalledOnce()
        expect(mockDelete).toHaveBeenCalledWith({ collection: 'media', id: 5 })
        expect(mockCreate).toHaveBeenCalledOnce()
        expect(result).toBe(99)
    })

    it('[TC-F08-04-04] existing record with empty url → deletes stale + creates', async () => {
        // Arrange
        vi.stubEnv('NEXT_PUBLIC_S3_ENDPOINT', S3_ENDPOINT)
        mockFind.mockResolvedValue({
            docs: [{ id: 5, url: '' }],
            totalDocs: 1,
        })

        // Act
        const result = await getOrCreateCrateCartonIdAction()

        // Assert
        expect(mockDelete).toHaveBeenCalledOnce()
        expect(mockCreate).toHaveBeenCalledOnce()
        expect(result).toBe(99)
    })

    it('[TC-F08-04-04] NEXT_PUBLIC_S3_ENDPOINT unset → returns existing id without validation', async () => {
        // Arrange — no env stub, so env is undefined
        mockFind.mockResolvedValue({
            docs: [{ id: 5, url: 'https://whatever.internal/x.png' }],
            totalDocs: 1,
        })

        // Act
        const result = await getOrCreateCrateCartonIdAction()

        // Assert
        expect(mockDelete).not.toHaveBeenCalled()
        expect(mockCreate).not.toHaveBeenCalled()
        expect(result).toBe(5)
    })

    it('[TC-F08-04-04] delete fails (FK constraint) → returns stale id, no create, logs error', async () => {
        // Arrange
        vi.stubEnv('NEXT_PUBLIC_S3_ENDPOINT', S3_ENDPOINT)
        mockFind.mockResolvedValue({
            docs: [{ id: 5, url: 'https://old-minio.internal/x.png' }],
            totalDocs: 1,
        })
        mockDelete.mockRejectedValue(new Error('FK constraint violation'))
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

        try {
            // Act
            const result = await getOrCreateCrateCartonIdAction()

            // Assert
            expect(mockDelete).toHaveBeenCalledOnce()
            expect(mockCreate).not.toHaveBeenCalled()
            expect(result).toBe(5)
            expect(consoleSpy).toHaveBeenCalledWith(
                expect.stringContaining('[Crate Carton]'),
                expect.any(Error),
            )
        } finally {
            consoleSpy.mockRestore()
        }
    })

    it('[TC-F08-04-04] unauthorized → throws Unauthorized', async () => {
        // Arrange
        vi.mocked(getCurrentUser).mockResolvedValue(null)

        // Act & Assert
        await expect(getOrCreateCrateCartonIdAction()).rejects.toThrow('Unauthorized')
        expect(mockFind).not.toHaveBeenCalled()
    })

    it('[TC-F08-04-04] trailing slash in S3 endpoint env → still matches doc url', async () => {
        // Arrange — env has trailing slash; function normalizes before startsWith check
        vi.stubEnv('NEXT_PUBLIC_S3_ENDPOINT', `${S3_ENDPOINT}/`)
        mockFind.mockResolvedValue({
            docs: [{ id: 5, url: `${S3_ENDPOINT}/bucket/crate-carton.png` }],
            totalDocs: 1,
        })

        // Act
        const result = await getOrCreateCrateCartonIdAction()

        // Assert — trailing slash stripped by replace(/\/$/, ''), so startsWith matches
        expect(mockDelete).not.toHaveBeenCalled()
        expect(mockCreate).not.toHaveBeenCalled()
        expect(result).toBe(5)
    })

    it('[TC-F08-04-04] local placeholder file not found → returns null, logs warning', async () => {
        // Arrange
        vi.stubEnv('NEXT_PUBLIC_S3_ENDPOINT', S3_ENDPOINT)
        mockFind.mockResolvedValue({ docs: [], totalDocs: 0 })
        mockExistsSync.mockReturnValue(false)
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

        try {
            // Act
            const result = await getOrCreateCrateCartonIdAction()

            // Assert
            expect(mockCreate).not.toHaveBeenCalled()
            expect(result).toBeNull()
            expect(consoleSpy).toHaveBeenCalledWith(
                expect.stringContaining('[Crate Carton Seed]'),
                expect.any(String),
            )
        } finally {
            consoleSpy.mockRestore()
        }
    })

    it('[TC-F08-04-04] payload.create throws → returns null, logs error', async () => {
        // Arrange
        vi.stubEnv('NEXT_PUBLIC_S3_ENDPOINT', S3_ENDPOINT)
        mockFind.mockResolvedValue({ docs: [], totalDocs: 0 })
        mockCreate.mockRejectedValue(new Error('S3 upload failed'))
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

        try {
            // Act
            const result = await getOrCreateCrateCartonIdAction()

            // Assert
            expect(result).toBeNull()
            expect(consoleSpy).toHaveBeenCalledWith(
                expect.stringContaining('Failed to create crate carton placeholder'),
                expect.any(Error),
            )
        } finally {
            consoleSpy.mockRestore()
        }
    })

    it('[TC-F08-04-04] user with no tenant → falls back to shared alt key', async () => {
        // Arrange
        vi.stubEnv('NEXT_PUBLIC_S3_ENDPOINT', S3_ENDPOINT)
        vi.mocked(extractTenantId).mockReturnValue(null)
        mockFind.mockResolvedValue({ docs: [], totalDocs: 0 })

        // Act
        await getOrCreateCrateCartonIdAction()

        // Assert — find and create use the fallback key, not a tenant-scoped key
        expect(mockFind).toHaveBeenCalledWith(expect.objectContaining({
            where: { alt: { equals: FALLBACK_ALT } },
        }))
        expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({
            data: { alt: FALLBACK_ALT },
        }))
    })

    it('[TC-F08-04-04] tenant isolation — find uses tenant-scoped alt key', async () => {
        // Arrange
        vi.stubEnv('NEXT_PUBLIC_S3_ENDPOINT', S3_ENDPOINT)
        mockFind.mockResolvedValue({ docs: [], totalDocs: 0 })

        // Act
        await getOrCreateCrateCartonIdAction()

        // Assert — find query scoped to this tenant's alt key, not the shared one
        expect(mockFind).toHaveBeenCalledWith(expect.objectContaining({
            where: { alt: { equals: TENANT_ALT } },
        }))
        expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({
            data: { alt: TENANT_ALT },
        }))
    })
})
