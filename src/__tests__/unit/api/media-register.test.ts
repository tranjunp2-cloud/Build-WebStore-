/**
 * Unit Tests: POST /api/media/register cleanup paths for direct S3 uploads.
 * TC-IDs: TC-F30-HMO-019
 * QA doc: docs/qa/F30-hero-media-overlay.md
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { mockFindRegisteredMedia, mockGetPayload, mockGetCurrentUser, mockRegisterUploadedMedia, mockS3Send } = vi.hoisted(() => ({
    mockFindRegisteredMedia: vi.fn(),
    mockGetPayload: vi.fn(),
    mockGetCurrentUser: vi.fn(),
    mockRegisterUploadedMedia: vi.fn(),
    mockS3Send: vi.fn(),
}))

vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('payload', () => ({ getPayload: mockGetPayload }))
vi.mock('@/lib/auth', () => ({ getCurrentUser: mockGetCurrentUser }))
vi.mock('@/lib/media/register-media', () => ({
    findRegisteredMedia: mockFindRegisteredMedia,
    registerUploadedMedia: mockRegisterUploadedMedia,
}))
vi.mock('@/lib/media/s3-client', () => ({
    buildS3Client: () => ({ client: { send: mockS3Send }, bucket: 'test-bucket' }),
}))
vi.mock('@aws-sdk/client-s3', () => ({
    HeadObjectCommand: class HeadObjectCommand {
        constructor(public input: unknown) {}
    },
    GetObjectCommand: class GetObjectCommand {
        constructor(public input: unknown) {}
    },
    DeleteObjectCommand: class DeleteObjectCommand {
        constructor(public input: unknown) {}
    },
}))

import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3'
import { POST } from '@/app/api/media/register/route'

function makeRequest(key = 'u1-hero-video.mp4') {
    return new NextRequest('http://localhost:3000/api/media/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, alt: 'Hero video' }),
    })
}

function expectDeleted(key: string) {
    const command = mockS3Send.mock.calls
        .map(([candidate]) => candidate)
        .find((candidate) => candidate instanceof DeleteObjectCommand) as { input: unknown } | undefined
    expect(command?.input).toEqual({ Bucket: 'test-bucket', Key: key })
}

describe('TC-F30-HMO-019: failed direct-upload registration removes the S3 object', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockGetCurrentUser.mockResolvedValue({ id: 1 })
        mockGetPayload.mockResolvedValue({})
        mockFindRegisteredMedia.mockResolvedValue(null)
        mockS3Send.mockImplementation(async (command: unknown) => {
            if (command instanceof HeadObjectCommand) {
                return { ContentLength: 16_600_000, ContentType: 'video/mp4' }
            }
            return {}
        })
    })

    it('deletes the object when the media insert fails', async () => {
        // Arrange
        const key = 'u1-hero-video.mp4'
        mockRegisterUploadedMedia.mockRejectedValue(new Error('database unavailable'))

        // Act
        const response = await POST(makeRequest(key))

        // Assert
        expect(response.status).toBe(500)
        expectDeleted(key)
    })

    it('returns an already-registered record and keeps its object after a concurrent retry', async () => {
        // Arrange
        const key = 'u1-hero-video.mp4'
        const existing = { id: 9, url: 'https://cdn/hero.mp4', filename: key, mimeType: 'video/mp4', filesize: 16_600_000 }
        mockFindRegisteredMedia.mockResolvedValueOnce(null).mockResolvedValueOnce(existing)
        mockRegisterUploadedMedia.mockRejectedValue(new Error('duplicate key'))

        // Act
        const response = await POST(makeRequest(key))

        // Assert
        expect(response.status).toBe(200)
        await expect(response.json()).resolves.toEqual(existing)
        expect(mockS3Send).not.toHaveBeenCalledWith(expect.any(DeleteObjectCommand))
    })

    it('keeps the object when the registration state cannot be verified', async () => {
        // Arrange
        const key = 'u1-hero-video.mp4'
        mockFindRegisteredMedia.mockResolvedValueOnce(null).mockRejectedValueOnce(new Error('database unavailable'))
        mockRegisterUploadedMedia.mockRejectedValue(new Error('database unavailable'))

        // Act
        const response = await POST(makeRequest(key))

        // Assert
        expect(response.status).toBe(500)
        expect(mockS3Send).not.toHaveBeenCalledWith(expect.any(DeleteObjectCommand))
    })

    it('deletes an uploaded object with an unsupported stored MIME type', async () => {
        // Arrange
        const key = 'u1-not-a-video.mp4'
        mockS3Send.mockImplementation(async (command: unknown) => {
            if (command instanceof HeadObjectCommand) {
                return { ContentLength: 16_600_000, ContentType: 'application/octet-stream' }
            }
            return {}
        })

        // Act
        const response = await POST(makeRequest(key))

        // Assert
        expect(response.status).toBe(415)
        expectDeleted(key)
        expect(mockRegisterUploadedMedia).not.toHaveBeenCalled()
    })

    it('registers an image after validating its stored bytes', async () => {
        // Arrange
        const key = 'u1-logo.png'
        const media = {
            id: 10,
            url: 'https://cdn/logo.png',
            filename: key,
            mimeType: 'image/png',
            filesize: 48_000,
        }
        mockRegisterUploadedMedia.mockResolvedValue(media)
        mockS3Send.mockImplementation(async (command: unknown) => {
            if (command instanceof HeadObjectCommand) {
                return { ContentLength: 48_000, ContentType: 'image/png' }
            }
            if (command instanceof GetObjectCommand) {
                return {
                    Body: {
                        transformToByteArray: async () =>
                            Uint8Array.from([0x89, 0x50, 0x4E, 0x47, 0, 0, 0, 0, 0, 0, 0, 0]),
                    },
                }
            }
            return {}
        })

        // Act
        const response = await POST(makeRequest(key))

        // Assert
        expect(response.status).toBe(200)
        await expect(response.json()).resolves.toEqual(media)
        expect(mockRegisterUploadedMedia).toHaveBeenCalledWith(
            {},
            { alt: 'Hero video', filename: key, mimeType: 'image/png', filesize: 48_000 },
        )
    })

    it('deletes an image whose bytes do not match a supported image signature', async () => {
        // Arrange
        const key = 'u1-fake.png'
        mockS3Send.mockImplementation(async (command: unknown) => {
            if (command instanceof HeadObjectCommand) {
                return { ContentLength: 48_000, ContentType: 'image/png' }
            }
            if (command instanceof GetObjectCommand) {
                return {
                    Body: {
                        transformToByteArray: async () => Uint8Array.from([1, 2, 3, 4]),
                    },
                }
            }
            return {}
        })

        // Act
        const response = await POST(makeRequest(key))

        // Assert
        expect(response.status).toBe(400)
        expectDeleted(key)
        expect(mockRegisterUploadedMedia).not.toHaveBeenCalled()
    })

    it('retries a transient image read and registers the original object', async () => {
        // Arrange
        const key = 'u1-retry-success.png'
        const media = {
            id: 11,
            url: 'https://cdn/retry-success.png',
            filename: key,
            mimeType: 'image/png',
            filesize: 48_000,
        }
        let imageReadAttempts = 0
        mockRegisterUploadedMedia.mockResolvedValue(media)
        mockS3Send.mockImplementation(async (command: unknown) => {
            if (command instanceof HeadObjectCommand) {
                return { ContentLength: 48_000, ContentType: 'image/png' }
            }
            if (command instanceof GetObjectCommand) {
                imageReadAttempts++
                if (imageReadAttempts < 3) throw new Error('temporary storage failure')
                return {
                    Body: {
                        transformToByteArray: async () =>
                            Uint8Array.from([0x89, 0x50, 0x4E, 0x47, 0, 0, 0, 0, 0, 0, 0, 0]),
                    },
                }
            }
            return {}
        })

        // Act
        const response = await POST(makeRequest(key))

        // Assert
        expect(response.status).toBe(200)
        expect(imageReadAttempts).toBe(3)
        expect(mockS3Send).not.toHaveBeenCalledWith(expect.any(DeleteObjectCommand))
        expect(mockRegisterUploadedMedia).toHaveBeenCalledTimes(1)
    })

    it('deletes an image after all signature read attempts fail', async () => {
        // Arrange
        const key = 'u1-retry.png'
        let imageReadAttempts = 0
        mockS3Send.mockImplementation(async (command: unknown) => {
            if (command instanceof HeadObjectCommand) {
                return { ContentLength: 48_000, ContentType: 'image/png' }
            }
            if (command instanceof GetObjectCommand) {
                imageReadAttempts++
                throw new Error('temporary storage failure')
            }
            return {}
        })

        // Act
        const response = await POST(makeRequest(key))

        // Assert
        expect(response.status).toBe(500)
        expect(imageReadAttempts).toBe(3)
        expectDeleted(key)
        expect(mockRegisterUploadedMedia).not.toHaveBeenCalled()
    })
})
