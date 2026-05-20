// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('payload', () => ({
    getPayload: vi.fn().mockResolvedValue({
        create: vi.fn().mockResolvedValue({ id: 'm1', url: '/media/test.png', alt: 'Test' }),
    }),
}))
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('@/lib/auth', () => ({
    getCurrentUser: vi.fn().mockResolvedValue({ id: 'u1', email: 'test@test.com' }),
}))

import { uploadMediaAction } from '@/app/(dashboard)/actions/media'
import { getPayload } from 'payload'
import { getCurrentUser } from '@/lib/auth'

describe('uploadMediaAction', () => {
    beforeEach(() => { vi.clearAllMocks() })

    it('uploads file and returns media object with url', async () => {
        const file = new File(['pixel'], 'photo.png', { type: 'image/png' })
        const formData = new FormData()
        formData.append('file', file)

        const result = await uploadMediaAction(formData)

        expect(result).toHaveProperty('url')
        expect(result.url).toBe('/media/test.png')
    })

    it('uses alt from FormData when provided', async () => {
        const file = new File(['pixel'], 'logo.png', { type: 'image/png' })
        const formData = new FormData()
        formData.append('file', file)
        formData.append('alt', 'Site Logo')

        await uploadMediaAction(formData)

        const payload = await getPayload({ config: {} as never })
        expect(payload.create).toHaveBeenCalledWith(expect.objectContaining({
            data: { alt: 'Site Logo' },
        }))
    })

    it('falls back to file.name when alt not provided', async () => {
        const file = new File(['pixel'], 'my-image.jpg', { type: 'image/jpeg' })
        const formData = new FormData()
        formData.append('file', file)

        await uploadMediaAction(formData)

        const payload = await getPayload({ config: {} as never })
        expect(payload.create).toHaveBeenCalledWith(expect.objectContaining({
            data: { alt: 'my-image.jpg' },
        }))
    })

    it('throws if no file provided', async () => {
        const formData = new FormData()
        await expect(uploadMediaAction(formData)).rejects.toThrow('No file provided')
    })

    it('throws if user not authenticated', async () => {
        vi.mocked(getCurrentUser).mockResolvedValueOnce(null)
        const formData = new FormData()
        formData.append('file', new File(['x'], 'x.png', { type: 'image/png' }))
        await expect(uploadMediaAction(formData)).rejects.toThrow('Unauthorized')
    })
})
