import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock OpenAI
vi.mock('openai', () => ({
    default: vi.fn(),
}))

import { generateAndUploadHeroImage } from '@/lib/ai/openai-image'

// ─── TC-F01.20: AI image generation ──────────────────────────────────

const businessInfo = {
    businessName: 'My Cafe',
    industry: 'Food & Beverage',
    products: 'Coffee, pastries',
    shortDescription: 'A cozy cafe',
}

const mockPayload = {
    create: vi.fn(),
}

describe('generateAndUploadHeroImage [TC-F01.20]', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        delete process.env.OPENAI_API_KEY
    })

    it('returns null when no OPENAI_API_KEY is set', async () => {
        const result = await generateAndUploadHeroImage(businessInfo, 'tenant-1', mockPayload)
        expect(result).toBeNull()
    })

    it('calls DALL-E and uploads to Payload when key exists', async () => {
        process.env.OPENAI_API_KEY = 'test-key'

        const mockImageUrl = 'https://example.com/image.png'
        const OpenAI = (await import('openai')).default as any
        OpenAI.mockImplementation(() => ({
            images: {
                generate: vi.fn().mockResolvedValue({
                    data: [{ url: mockImageUrl }],
                }),
            },
        }))

        // Mock fetch for image download
        vi.spyOn(globalThis, 'fetch').mockResolvedValue({
            arrayBuffer: () => Promise.resolve(new ArrayBuffer(100)),
            headers: new Headers({ 'content-type': 'image/png' }),
        } as Response)

        mockPayload.create.mockResolvedValue({ id: 'media-123' })

        const result = await generateAndUploadHeroImage(businessInfo, 'tenant-1', mockPayload)

        expect(result).toEqual({ id: 'media-123' })
        expect(mockPayload.create).toHaveBeenCalledWith(
            expect.objectContaining({
                collection: 'media',
                data: expect.objectContaining({
                    alt: expect.stringContaining('My Cafe'),
                    tenant: 'tenant-1',
                }),
            }),
        )
    })

    it('falls back to Unsplash when DALL-E fails', async () => {
        process.env.OPENAI_API_KEY = 'test-key'

        const OpenAI = (await import('openai')).default as any
        OpenAI.mockImplementation(() => ({
            images: {
                generate: vi.fn().mockRejectedValue(new Error('DALL-E rate limited')),
            },
        }))

        // Mock fetch for Unsplash fallback
        vi.spyOn(globalThis, 'fetch').mockResolvedValue({
            ok: true,
            arrayBuffer: () => Promise.resolve(new ArrayBuffer(50)),
        } as Response)

        mockPayload.create.mockResolvedValue({ id: 'fallback-media-456' })

        const result = await generateAndUploadHeroImage(businessInfo, 'tenant-1', mockPayload)

        expect(result).toEqual({ id: 'fallback-media-456' })
    })

    it('returns null when both DALL-E and fallback fail', async () => {
        process.env.OPENAI_API_KEY = 'test-key'

        const OpenAI = (await import('openai')).default as any
        OpenAI.mockImplementation(() => ({
            images: {
                generate: vi.fn().mockRejectedValue(new Error('DALL-E down')),
            },
        }))

        vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network error'))

        const result = await generateAndUploadHeroImage(businessInfo, 'tenant-1', mockPayload)

        expect(result).toBeNull()
    })
})
