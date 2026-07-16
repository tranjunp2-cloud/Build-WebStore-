/**
 * Unit Tests: POST /api/media/register cleanup paths for direct S3 uploads.
 * TC-IDs: TC-F30-HMO-019
 * QA doc: docs/qa/F30-hero-media-overlay.md
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { mockGetPayload, mockGetCurrentUser, mockRegisterUploadedMedia, mockS3Send } = vi.hoisted(() => ({
    mockGetPayload: vi.fn(),
    mockGetCurrentUser: vi.fn(),
    mockRegisterUploadedMedia: vi.fn(),
    mockS3Send: vi.fn(),
}))

vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('payload', () => ({ getPayload: mockGetPayload }))
vi.mock('@/lib/auth', () => ({ getCurrentUser: mockGetCurrentUser }))
vi.mock('@/lib/media/register-media', () => ({ registerUploadedMedia: mockRegisterUploadedMedia }))
vi.mock('@/lib/media/s3-client', () => ({
    buildS3Client: () => ({ client: { send: mockS3Send }, bucket: 'test-bucket' }),
}))
vi.mock('@aws-sdk/client-s3', () => ({
    HeadObjectCommand: class HeadObjectCommand {
        constructor(public input: unknown) {}
    },
    DeleteObjectCommand: class DeleteObjectCommand {
        constructor(public input: unknown) {}
    },
}))

import { DeleteObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3'
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
})
