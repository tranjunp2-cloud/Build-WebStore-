import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const {
    mockCheckRateLimit,
    mockCreateMediaPresignedPost,
    mockGetCurrentUser,
    mockIsS3Configured,
} = vi.hoisted(() => ({
    mockCheckRateLimit: vi.fn(),
    mockCreateMediaPresignedPost: vi.fn(),
    mockGetCurrentUser: vi.fn(),
    mockIsS3Configured: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({ getCurrentUser: mockGetCurrentUser }))
vi.mock('@/lib/rateLimit', () => ({ checkRateLimit: mockCheckRateLimit }))
vi.mock('@/lib/media/s3-client', () => ({ isS3Configured: mockIsS3Configured }))
vi.mock('@/lib/media/s3-presign', () => ({
    createMediaPresignedPost: mockCreateMediaPresignedPost,
}))
vi.mock('@/lib/media/media-key', () => ({
    buildMediaKey: () => 'u1-logo.png',
}))
vi.mock('@/lib/media/s3-public-url', () => ({
    s3PublicUrl: (key: string) => `https://cdn.example/${key}`,
}))

import { POST } from '@/app/api/media/presign/route'
import { UPLOAD_LIMITS } from '@/lib/media/upload-limits'

function makeRequest() {
    return new NextRequest('http://localhost:3000/api/media/presign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            filename: 'logo.png',
            contentType: 'image/png',
            size: 48_000,
        }),
    })
}

describe('POST /api/media/presign for direct image uploads', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockGetCurrentUser.mockResolvedValue({ id: 1 })
        mockIsS3Configured.mockReturnValue(true)
        mockCheckRateLimit.mockResolvedValue({ allowed: true })
        mockCreateMediaPresignedPost.mockResolvedValue({
            url: 'https://storage.example/upload',
            fields: { key: 'u1-logo.png' },
        })
    })

    it('uses the image limit when preparing a direct image upload', async () => {
        // Act
        const response = await POST(makeRequest())

        // Assert
        expect(response.status).toBe(200)
        expect(mockCreateMediaPresignedPost).toHaveBeenCalledWith({
            key: 'u1-logo.png',
            contentType: 'image/png',
            maxFileBytes: UPLOAD_LIMITS.image,
        })
    })

    it('reports direct upload unavailable before rate limiting when storage is not configured', async () => {
        // Arrange
        mockIsS3Configured.mockReturnValue(false)

        // Act
        const response = await POST(makeRequest())

        // Assert
        expect(response.status).toBe(503)
        await expect(response.json()).resolves.toMatchObject({
            code: 'DIRECT_UPLOAD_UNAVAILABLE',
        })
        expect(mockCheckRateLimit).not.toHaveBeenCalled()
    })
})
