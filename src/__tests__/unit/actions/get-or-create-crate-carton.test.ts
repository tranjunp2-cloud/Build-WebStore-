// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const { mockFind, mockCreate, mockDelete, mockUpdate, mockExistsSync, mockReadFileSync, mockS3Send, mockRepair } = vi.hoisted(() => ({
    mockFind: vi.fn(),
    mockCreate: vi.fn(),
    mockDelete: vi.fn(),
    mockUpdate: vi.fn(),
    mockExistsSync: vi.fn(),
    mockReadFileSync: vi.fn(),
    mockS3Send: vi.fn(),
    mockRepair: vi.fn(),
}))

vi.mock('payload', () => ({
    getPayload: vi.fn().mockResolvedValue({
        find: mockFind,
        create: mockCreate,
        delete: mockDelete,
        update: mockUpdate,
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
vi.mock('@aws-sdk/client-s3', () => ({
    S3Client: vi.fn().mockImplementation(() => ({ send: mockS3Send })),
    HeadObjectCommand: vi.fn().mockImplementation((params) => params),
}))
vi.mock('@/app/(dashboard)/actions/media-repair', () => ({
    repairStaleProductImageRefs: mockRepair,
}))

import { getOrCreateCrateCartonIdAction } from '@/app/(dashboard)/actions/media'
import { getCurrentUser, extractTenantId } from '@/lib/auth'

const S3_ENDPOINT = 'https://s3.example.com'
const S3_INTERNAL = 'http://minio:9000'
const BUCKET = 'primeweb-media'
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
        mockCreate.mockResolvedValue({ id: 99, url: `${S3_ENDPOINT}/${BUCKET}/crate-carton-placeholder.png` })
        mockDelete.mockResolvedValue({ id: 5 })
        mockUpdate.mockResolvedValue({ id: 5 })
        mockRepair.mockResolvedValue(undefined)
        // Default: S3 object exists
        mockS3Send.mockResolvedValue({})
    })

    afterEach(() => {
        vi.unstubAllEnvs()
    })

    it('[TC-F08-04-04] no existing record + S3 configured → creates and returns new id', async () => {
        // Arrange
        vi.stubEnv('NEXT_PUBLIC_S3_ENDPOINT', S3_ENDPOINT)
        vi.stubEnv('S3_BUCKET', BUCKET)
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

    it('[TC-F08-04-04] existing record with url matching S3 endpoint and file exists → returns id, no delete/create', async () => {
        // Arrange
        vi.stubEnv('NEXT_PUBLIC_S3_ENDPOINT', S3_ENDPOINT)
        vi.stubEnv('S3_BUCKET', BUCKET)
        vi.stubEnv('S3_ENDPOINT', S3_INTERNAL)
        mockFind.mockResolvedValue({
            docs: [{ id: 5, url: `${S3_ENDPOINT}/${BUCKET}/crate-carton.png`, alt: TENANT_ALT }],
            totalDocs: 1,
        })
        mockS3Send.mockResolvedValue({}) // HeadObjectCommand succeeds

        // Act
        const result = await getOrCreateCrateCartonIdAction()

        // Assert
        expect(mockS3Send).toHaveBeenCalledOnce()
        expect(mockDelete).not.toHaveBeenCalled()
        expect(mockCreate).not.toHaveBeenCalled()
        expect(result).toBe(5)
    })

    it('[TC-F08-04-04] existing record with original + all 4 size variants on S3 → returns id, checks all 5 keys', async () => {
        // Arrange
        vi.stubEnv('NEXT_PUBLIC_S3_ENDPOINT', S3_ENDPOINT)
        vi.stubEnv('S3_BUCKET', BUCKET)
        vi.stubEnv('S3_ENDPOINT', S3_INTERNAL)
        mockFind.mockResolvedValue({
            docs: [{
                id: 5,
                url: `${S3_ENDPOINT}/${BUCKET}/crate-carton-placeholder.png`,
                alt: TENANT_ALT,
                sizes: {
                    thumbnail: { url: `${S3_ENDPOINT}/${BUCKET}/crate-carton-placeholder-400x300.jpg` },
                    card:      { url: `${S3_ENDPOINT}/${BUCKET}/crate-carton-placeholder-768x512.jpg` },
                    hero:      { url: `${S3_ENDPOINT}/${BUCKET}/crate-carton-placeholder-1920x1080.jpg` },
                    square:    { url: `${S3_ENDPOINT}/${BUCKET}/crate-carton-placeholder-600x600.jpg` },
                },
            }],
            totalDocs: 1,
        })
        mockS3Send.mockResolvedValue({}) // all HEAD checks pass

        // Act
        const result = await getOrCreateCrateCartonIdAction()

        // Assert — 5 keys checked (1 original + 4 variants), no write ops
        expect(mockS3Send).toHaveBeenCalledTimes(5)
        expect(mockDelete).not.toHaveBeenCalled()
        expect(mockCreate).not.toHaveBeenCalled()
        expect(result).toBe(5)
    })

    it('[TC-F08-04-04] existing record with original ok but thumbnail variant missing → renames stale + recreates', async () => {
        // Arrange — staging bug shape: original present, at least one resize variant 404
        vi.stubEnv('NEXT_PUBLIC_S3_ENDPOINT', S3_ENDPOINT)
        vi.stubEnv('S3_BUCKET', BUCKET)
        vi.stubEnv('S3_ENDPOINT', S3_INTERNAL)
        mockFind.mockResolvedValue({
            docs: [{
                id: 5,
                url: `${S3_ENDPOINT}/${BUCKET}/crate-carton-placeholder.png`,
                alt: TENANT_ALT,
                sizes: {
                    thumbnail: { url: `${S3_ENDPOINT}/${BUCKET}/crate-carton-placeholder-400x300.jpg` },
                    card:      { url: `${S3_ENDPOINT}/${BUCKET}/crate-carton-placeholder-768x512.jpg` },
                    hero:      { url: `${S3_ENDPOINT}/${BUCKET}/crate-carton-placeholder-1920x1080.jpg` },
                    square:    { url: `${S3_ENDPOINT}/${BUCKET}/crate-carton-placeholder-600x600.jpg` },
                },
            }],
            totalDocs: 1,
        })
        // Promise.all: one of the parallel HEADs rejects → entire Promise.all rejects
        // AWS SDK signals 404 via $metadata.httpStatusCode (not exception name)
        mockS3Send
            .mockResolvedValueOnce({}) // original ok
            .mockRejectedValueOnce(Object.assign(new Error('NotFound'), { $metadata: { httpStatusCode: 404 } })) // thumbnail 404
            .mockResolvedValue({})     // remaining (in-flight, ignored after rejection)

        // Act
        const result = await getOrCreateCrateCartonIdAction()

        // Assert — record renamed stale, then recreated; delete is fire-and-forget after repair
        expect(mockS3Send).toHaveBeenCalled()
        expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ collection: 'media', id: 5 }))
        expect(mockCreate).toHaveBeenCalledOnce()
        expect(mockDelete).toHaveBeenCalledWith({ collection: 'media', id: 5 })
        expect(result).toBe(99)
    })

    it('[TC-F08-04-04] existing record without sizes field → checks only original key', async () => {
        // Arrange — legacy records predate imageSizes config; only original key collected
        vi.stubEnv('NEXT_PUBLIC_S3_ENDPOINT', S3_ENDPOINT)
        vi.stubEnv('S3_BUCKET', BUCKET)
        vi.stubEnv('S3_ENDPOINT', S3_INTERNAL)
        mockFind.mockResolvedValue({
            docs: [{ id: 5, url: `${S3_ENDPOINT}/${BUCKET}/legacy.png`, alt: TENANT_ALT }],
            totalDocs: 1,
        })
        mockS3Send.mockResolvedValue({})

        // Act
        const result = await getOrCreateCrateCartonIdAction()

        // Assert — exactly 1 HEAD call (no sizes to iterate)
        expect(mockS3Send).toHaveBeenCalledTimes(1)
        expect(mockDelete).not.toHaveBeenCalled()
        expect(result).toBe(5)
    })

    it('[TC-F08-04-04] existing record with matching url but S3 object missing (404) → renames stale + recreates', async () => {
        // Arrange — the staging bug: DB record exists, URL domain matches, but file gone from S3
        vi.stubEnv('NEXT_PUBLIC_S3_ENDPOINT', S3_ENDPOINT)
        vi.stubEnv('S3_BUCKET', BUCKET)
        vi.stubEnv('S3_ENDPOINT', S3_INTERNAL)
        mockFind.mockResolvedValue({
            docs: [{ id: 5, url: `${S3_ENDPOINT}/${BUCKET}/crate-carton-placeholder-3.png`, alt: TENANT_ALT }],
            totalDocs: 1,
        })
        mockS3Send.mockRejectedValue(Object.assign(new Error('NotFound'), { $metadata: { httpStatusCode: 404 } }))

        // Act
        const result = await getOrCreateCrateCartonIdAction()

        // Assert — record renamed stale, then recreated; delete is fire-and-forget after repair
        expect(mockS3Send).toHaveBeenCalledOnce()
        expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ collection: 'media', id: 5 }))
        expect(mockCreate).toHaveBeenCalledOnce()
        expect(mockDelete).toHaveBeenCalledWith({ collection: 'media', id: 5 })
        expect(result).toBe(99)
    })

    it('[TC-F08-04-04] S3 check fails with transient error (non-404) → fail-open: trusts existing record', async () => {
        // Arrange — network timeout, auth error, throttle etc. should NOT delete valid records
        vi.stubEnv('NEXT_PUBLIC_S3_ENDPOINT', S3_ENDPOINT)
        vi.stubEnv('S3_BUCKET', BUCKET)
        vi.stubEnv('S3_ENDPOINT', S3_INTERNAL)
        mockFind.mockResolvedValue({
            docs: [{ id: 5, url: `${S3_ENDPOINT}/${BUCKET}/crate-carton-placeholder.png`, alt: TENANT_ALT }],
            totalDocs: 1,
        })
        // Non-404 error (e.g. network timeout) — no $metadata.httpStatusCode
        mockS3Send.mockRejectedValue(new Error('Network timeout'))
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

        try {
            // Act
            const result = await getOrCreateCrateCartonIdAction()

            // Assert — fail-open: return existing id, do NOT delete or recreate
            expect(mockDelete).not.toHaveBeenCalled()
            expect(mockCreate).not.toHaveBeenCalled()
            expect(result).toBe(5)
            expect(consoleSpy).toHaveBeenCalledWith(
                expect.stringContaining('[checkS3ObjectsExist]'),
                expect.any(Error),
            )
        } finally {
            consoleSpy.mockRestore()
        }
    })

    it('[TC-F08-04-04] existing record with stale host → renames stale + creates, returns new id', async () => {
        // Arrange
        vi.stubEnv('NEXT_PUBLIC_S3_ENDPOINT', S3_ENDPOINT)
        vi.stubEnv('S3_BUCKET', BUCKET)
        mockFind.mockResolvedValue({
            docs: [{ id: 5, url: 'https://old-minio.internal/bucket/crate-carton.png' }],
            totalDocs: 1,
        })

        // Act
        const result = await getOrCreateCrateCartonIdAction()

        // Assert — stale host skips S3 check; record renamed stale, then recreated; delete fire-and-forget
        expect(mockS3Send).not.toHaveBeenCalled()
        expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ collection: 'media', id: 5 }))
        expect(mockCreate).toHaveBeenCalledOnce()
        expect(mockDelete).toHaveBeenCalledWith({ collection: 'media', id: 5 })
        expect(result).toBe(99)
    })

    it('[TC-F08-04-04] existing record with empty url → renames stale + creates', async () => {
        // Arrange
        vi.stubEnv('NEXT_PUBLIC_S3_ENDPOINT', S3_ENDPOINT)
        vi.stubEnv('S3_BUCKET', BUCKET)
        mockFind.mockResolvedValue({
            docs: [{ id: 5, url: '' }],
            totalDocs: 1,
        })

        // Act
        const result = await getOrCreateCrateCartonIdAction()

        // Assert — record renamed stale, then recreated; delete is fire-and-forget after repair
        expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ collection: 'media', id: 5 }))
        expect(mockCreate).toHaveBeenCalledOnce()
        expect(mockDelete).toHaveBeenCalledWith({ collection: 'media', id: 5 })
        expect(result).toBe(99)
    })

    it('[TC-F08-04-04] NEXT_PUBLIC_S3_ENDPOINT unset → returns existing id without S3 check', async () => {
        // Arrange — no env stub, so env is undefined
        mockFind.mockResolvedValue({
            docs: [{ id: 5, url: 'https://whatever.internal/x.png' }],
            totalDocs: 1,
        })

        // Act
        const result = await getOrCreateCrateCartonIdAction()

        // Assert
        expect(mockS3Send).not.toHaveBeenCalled()
        expect(mockDelete).not.toHaveBeenCalled()
        expect(mockCreate).not.toHaveBeenCalled()
        expect(result).toBe(5)
    })

    it('[TC-F08-04-04] unauthorized → throws Unauthorized', async () => {
        // Arrange
        vi.mocked(getCurrentUser).mockResolvedValue(null)

        // Act & Assert
        await expect(getOrCreateCrateCartonIdAction()).rejects.toThrow('Unauthorized')
        expect(mockFind).not.toHaveBeenCalled()
    })

    it('[TC-F08-04-04] trailing slash in S3 endpoint env → still matches doc url and checks S3', async () => {
        // Arrange — env has trailing slash; function normalizes before startsWith check
        vi.stubEnv('NEXT_PUBLIC_S3_ENDPOINT', `${S3_ENDPOINT}/`)
        vi.stubEnv('S3_BUCKET', BUCKET)
        vi.stubEnv('S3_ENDPOINT', S3_INTERNAL)
        mockFind.mockResolvedValue({
            docs: [{ id: 5, url: `${S3_ENDPOINT}/${BUCKET}/crate-carton.png` }],
            totalDocs: 1,
        })
        mockS3Send.mockResolvedValue({})

        // Act
        const result = await getOrCreateCrateCartonIdAction()

        // Assert — trailing slash stripped by replace(/\/$/, ''), so startsWith matches and S3 check passes
        expect(mockS3Send).toHaveBeenCalledOnce()
        expect(mockDelete).not.toHaveBeenCalled()
        expect(mockCreate).not.toHaveBeenCalled()
        expect(result).toBe(5)
    })

    it('[TC-F08-04-04] local placeholder file not found, no CDN configured → returns null, logs warning', async () => {
        // Arrange — no local file AND no NEXT_PUBLIC_SERVER_URL → must return null
        vi.stubEnv('NEXT_PUBLIC_S3_ENDPOINT', S3_ENDPOINT)
        vi.stubEnv('S3_BUCKET', BUCKET)
        vi.stubEnv('NEXT_PUBLIC_SERVER_URL', '') // explicitly empty so CDN path is skipped
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

    it('[TC-F08-04-23] local file missing, NEXT_PUBLIC_SERVER_URL set, CDN ok → fetches + creates', async () => {
        // Arrange — Vercel serverless: local file not found; fallback to CDN fetch succeeds
        vi.stubEnv('NEXT_PUBLIC_S3_ENDPOINT', S3_ENDPOINT)
        vi.stubEnv('S3_BUCKET', BUCKET)
        vi.stubEnv('NEXT_PUBLIC_SERVER_URL', 'https://staging.example.com')
        mockFind.mockResolvedValue({ docs: [], totalDocs: 0 })
        mockExistsSync.mockReturnValue(false)
        const fetchedBuffer = Buffer.from('fetched-png-data')
        const mockFetch = vi.spyOn(global, 'fetch').mockResolvedValue({
            ok: true,
            arrayBuffer: () => Promise.resolve(fetchedBuffer.buffer as ArrayBuffer),
        } as Response)

        try {
            // Act
            const result = await getOrCreateCrateCartonIdAction()

            // Assert — CDN fetched and create called with fetched data
            expect(mockFetch).toHaveBeenCalledWith('https://staging.example.com/images/crate-carton.png')
            expect(mockCreate).toHaveBeenCalledOnce()
            expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({
                file: expect.objectContaining({ name: 'crate-carton-placeholder.png', mimetype: 'image/png' }),
            }))
            expect(result).toBe(99)
        } finally {
            mockFetch.mockRestore()
        }
    })

    it('[TC-F08-04-24] local file missing, CDN returns non-200 → returns null', async () => {
        // Arrange — CDN returns 404 for the placeholder
        vi.stubEnv('NEXT_PUBLIC_S3_ENDPOINT', S3_ENDPOINT)
        vi.stubEnv('S3_BUCKET', BUCKET)
        vi.stubEnv('NEXT_PUBLIC_SERVER_URL', 'https://staging.example.com')
        mockFind.mockResolvedValue({ docs: [], totalDocs: 0 })
        mockExistsSync.mockReturnValue(false)
        const mockFetch = vi.spyOn(global, 'fetch').mockResolvedValue({
            ok: false,
            status: 404,
        } as Response)
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

        try {
            // Act
            const result = await getOrCreateCrateCartonIdAction()

            // Assert
            expect(mockCreate).not.toHaveBeenCalled()
            expect(result).toBeNull()
        } finally {
            mockFetch.mockRestore()
            consoleSpy.mockRestore()
        }
    })

    it('[TC-F08-04-25] local file missing, CDN fetch throws network error → returns null', async () => {
        // Arrange — network error during CDN fetch (e.g., DNS failure)
        vi.stubEnv('NEXT_PUBLIC_S3_ENDPOINT', S3_ENDPOINT)
        vi.stubEnv('S3_BUCKET', BUCKET)
        vi.stubEnv('NEXT_PUBLIC_SERVER_URL', 'https://staging.example.com')
        mockFind.mockResolvedValue({ docs: [], totalDocs: 0 })
        mockExistsSync.mockReturnValue(false)
        const mockFetch = vi.spyOn(global, 'fetch').mockRejectedValue(new Error('DNS lookup failed'))
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

        try {
            // Act
            const result = await getOrCreateCrateCartonIdAction()

            // Assert
            expect(mockCreate).not.toHaveBeenCalled()
            expect(result).toBeNull()
            expect(consoleSpy).toHaveBeenCalledWith(
                expect.stringContaining('[Crate Carton Seed] CDN fetch error:'),
                expect.any(Error),
            )
        } finally {
            mockFetch.mockRestore()
            consoleSpy.mockRestore()
        }
    })

    it('[TC-F08-04-04] payload.create throws → returns null, logs error', async () => {
        // Arrange
        vi.stubEnv('NEXT_PUBLIC_S3_ENDPOINT', S3_ENDPOINT)
        vi.stubEnv('S3_BUCKET', BUCKET)
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
        vi.stubEnv('S3_BUCKET', BUCKET)
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
        vi.stubEnv('S3_BUCKET', BUCKET)
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

    it('[TC-F08-04-04] S3_ENDPOINT or S3_BUCKET unset → skips S3 check, trusts existing record', async () => {
        // Arrange — S3_BUCKET not set
        vi.stubEnv('NEXT_PUBLIC_S3_ENDPOINT', S3_ENDPOINT)
        // S3_BUCKET intentionally not set
        mockFind.mockResolvedValue({
            docs: [{ id: 5, url: `${S3_ENDPOINT}/primeweb-media/crate-carton.png` }],
            totalDocs: 1,
        })

        // Act
        const result = await getOrCreateCrateCartonIdAction()

        // Assert — can't extract key without bucket, falls through to trust-existing path
        expect(mockS3Send).not.toHaveBeenCalled()
        expect(result).toBe(5)
    })

    it('[TC-F08-04-19] stale host → deletes+recreates and calls repairStaleProductImageRefs with (payload, oldId, newId)', async () => {
        // Arrange — stale host triggers delete+recreate path; repair must receive old and new ids
        vi.stubEnv('NEXT_PUBLIC_S3_ENDPOINT', S3_ENDPOINT)
        vi.stubEnv('S3_BUCKET', BUCKET)
        mockFind.mockResolvedValue({
            docs: [{ id: 5, url: 'https://old-minio.internal/bucket/crate-carton.png', alt: TENANT_ALT }],
            totalDocs: 1,
        })

        // Act
        const result = await getOrCreateCrateCartonIdAction()

        // Assert — record renamed stale, then recreated; repair called; delete is fire-and-forget
        expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ collection: 'media', id: 5 }))
        expect(mockCreate).toHaveBeenCalledOnce()
        expect(mockRepair).toHaveBeenCalledWith(expect.anything(), 5, 99)
        expect(mockDelete).toHaveBeenCalledWith({ collection: 'media', id: 5 })
        expect(result).toBe(99)
    })

    it('[TC-F08-04-20] first-create path (no existing doc) → repairStaleProductImageRefs NOT called', async () => {
        // Arrange — no existing record means no oldId; repair must not run
        vi.stubEnv('NEXT_PUBLIC_S3_ENDPOINT', S3_ENDPOINT)
        vi.stubEnv('S3_BUCKET', BUCKET)
        mockFind.mockResolvedValue({ docs: [], totalDocs: 0 })

        // Act
        const result = await getOrCreateCrateCartonIdAction()

        // Assert
        expect(mockCreate).toHaveBeenCalledOnce()
        expect(mockRepair).not.toHaveBeenCalled()
        expect(result).toBe(99)
    })

    it('[TC-F08-04-22] stale record rename fails → aborts recreate, returns existing id, logs warning', async () => {
        // Arrange — rename (payload.update) throws; recreate must be aborted to avoid duplicate altKey
        vi.stubEnv('NEXT_PUBLIC_S3_ENDPOINT', S3_ENDPOINT)
        vi.stubEnv('S3_BUCKET', BUCKET)
        mockFind.mockResolvedValue({
            docs: [{ id: 5, url: 'https://old-minio.internal/bucket/crate-carton.png', alt: TENANT_ALT }],
            totalDocs: 1,
        })
        mockUpdate.mockRejectedValueOnce(new Error('DB connection lost'))
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

        try {
            // Act
            const result = await getOrCreateCrateCartonIdAction()

            // Assert — recreate aborted; stale id returned; no new record created
            expect(mockUpdate).toHaveBeenCalledOnce()
            expect(mockCreate).not.toHaveBeenCalled()
            expect(mockRepair).not.toHaveBeenCalled()
            expect(result).toBe(5)
            expect(warnSpy).toHaveBeenCalledWith(
                expect.stringContaining('[Crate Carton]'),
                expect.any(Error),
            )
        } finally {
            warnSpy.mockRestore()
        }
    })

    it('[TC-F08-04-21] repair throws after recreate → action still returns newId (fire-and-forget contract)', async () => {
        // Arrange — repair rejection must be swallowed; action return value must be preserved
        vi.stubEnv('NEXT_PUBLIC_S3_ENDPOINT', S3_ENDPOINT)
        vi.stubEnv('S3_BUCKET', BUCKET)
        mockFind.mockResolvedValue({
            docs: [{ id: 5, url: 'https://old-minio.internal/bucket/crate-carton.png', alt: TENANT_ALT }],
            totalDocs: 1,
        })
        mockRepair.mockRejectedValueOnce(new Error('repair boom'))

        // Act
        const result = await getOrCreateCrateCartonIdAction()

        // Assert — record renamed stale, repair attempted (and failed), delete still fire-and-forget
        expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ collection: 'media', id: 5 }))
        expect(mockRepair).toHaveBeenCalledWith(expect.anything(), 5, 99)
        expect(mockDelete).toHaveBeenCalledWith({ collection: 'media', id: 5 })
        expect(result).toBe(99)
    })
})
