import { describe, expect, it, vi } from 'vitest'
import { uploadBufferToMedia } from '@/lib/ai/media-pipeline'
import { uploadImageUrl } from '@/lib/ai/upload-media'

vi.mock('@/lib/ai/pixabay-client', async (importOriginal) => ({
    ...(await importOriginal<object>()),
    downloadPhotoBuffer: vi.fn().mockResolvedValue({
        buffer: Buffer.from('image'),
        mimetype: 'image/jpeg',
    }),
}))

describe('generation media write fence', () => {
    it('blocks both serialized buffer-upload attempts after the request aborts', async () => {
        const payload = { create: vi.fn() }
        const assertCanWrite = vi.fn(() => {
            throw new Error('GENERATION_DEADLINE_EXCEEDED')
        })

        await expect(uploadBufferToMedia(payload, {
            buffer: Buffer.from('image'),
            filename: 'blocked.jpg',
            mimetype: 'image/jpeg',
            alt: 'blocked image',
            tenantId: 'tenant-1',
            assertCanWrite,
        })).rejects.toThrow('GENERATION_DEADLINE_EXCEEDED')

        expect(assertCanWrite).toHaveBeenCalledTimes(2)
        expect(payload.create).not.toHaveBeenCalled()
    })

    it('blocks URL-upload media creates after the request aborts', async () => {
        const payload = { create: vi.fn() }
        const assertCanWrite = vi.fn(() => {
            throw new Error('GENERATION_DEADLINE_EXCEEDED')
        })

        await expect(uploadImageUrl(
            'https://example.com/image.jpg',
            'blocked-url.jpg',
            'blocked image',
            'tenant-1',
            payload as never,
            assertCanWrite,
        )).rejects.toThrow('GENERATION_DEADLINE_EXCEEDED')

        expect(assertCanWrite).toHaveBeenCalledTimes(2)
        expect(payload.create).not.toHaveBeenCalled()
    })
})
