/**
 * Unit Tests: createVideoPresignedPost — the presigned POST policy must pin the
 * key, Content-Type, and a hard 0..maxBytes size range so the client cannot
 * upload beyond the limit (GH-1284, server-authoritative cap).
 * TC-IDs: TC-F30-HMO-014
 * QA doc: docs/qa/F30-hero-media-overlay.md
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const createPresignedPostMock = vi.fn()
vi.mock('@aws-sdk/s3-presigned-post', () => ({
    createPresignedPost: (...args: unknown[]) => createPresignedPostMock(...args),
}))
vi.mock('@/lib/media/s3-client', () => ({
    buildS3Client: () => ({ client: { __fake: true }, bucket: 'test-bucket' }),
}))

import { createVideoPresignedPost, S3_POST_MULTIPART_OVERHEAD_BYTES } from '@/lib/media/s3-presign'

describe('TC-F30-HMO-015: createVideoPresignedPost enforces size + type in the policy', () => {
    beforeEach(() => {
        createPresignedPostMock.mockReset()
        createPresignedPostMock.mockResolvedValue({ url: 'https://s3/test-bucket', fields: {} })
    })

    it('allows a max-size file plus multipart framing and pins Content-Type', async () => {
        // Arrange
        const maxFileBytes = 100 * 1024 * 1024

        // Act
        await createVideoPresignedPost({ key: 'u1-v.mp4', contentType: 'video/mp4', maxFileBytes })

        // Assert
        const [, params] = createPresignedPostMock.mock.calls[0] as [unknown, Record<string, unknown>]
        expect(params.Bucket).toBe('test-bucket')
        expect(params.Key).toBe('u1-v.mp4')
        expect(params.Conditions).toContainEqual(['content-length-range', 0, maxFileBytes + S3_POST_MULTIPART_OVERHEAD_BYTES])
        expect(params.Conditions).toContainEqual(['eq', '$Content-Type', 'video/mp4'])
        expect((params.Fields as Record<string, string>)['Content-Type']).toBe('video/mp4')
        expect(params.Expires).toBeGreaterThan(0)
    })

    it('keeps a stable multipart allowance for every policy', async () => {
        // Arrange
        const maxFileBytes = 12345

        // Act
        await createVideoPresignedPost({ key: 'k.webm', contentType: 'video/webm', maxFileBytes })

        // Assert
        const [, params] = createPresignedPostMock.mock.calls[0] as [unknown, Record<string, unknown>]
        expect(params.Conditions).toContainEqual(['content-length-range', 0, maxFileBytes + S3_POST_MULTIPART_OVERHEAD_BYTES])
    })
})
