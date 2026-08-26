import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { POST } from '@/app/api/sites/[siteId]/seed-images/route'

vi.mock('@payload-config', () => ({ default: {} }))

const { mockFindByID, mockSeedImageLibraryForSite, mockResolveImageLibraryS3Map } = vi.hoisted(() => ({
    mockFindByID: vi.fn(),
    mockSeedImageLibraryForSite: vi.fn(),
    mockResolveImageLibraryS3Map: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({
    getCurrentUser: vi.fn().mockResolvedValue({
        id: 'user-1',
        email: 'owner@example.com',
        tenants: [{ tenant: 'tenant-1' }],
    }),
}))

vi.mock('payload', () => ({
    getPayload: vi.fn().mockResolvedValue({
        findByID: mockFindByID,
    }),
}))

vi.mock('@/lib/images/image-library-seeder', () => ({
    seedImageLibraryForSite: mockSeedImageLibraryForSite,
}))

vi.mock('@/lib/images/image-library-resolver', () => ({
    resolveImageLibraryS3Map: mockResolveImageLibraryS3Map,
}))

const makeReq = (siteId: string) =>
    new NextRequest(`http://localhost:3000/api/sites/${siteId}/seed-images`, {
        method: 'POST',
    })

const makeParams = (siteId: string) => ({ params: Promise.resolve({ siteId }) })

describe('POST /api/sites/[siteId]/seed-images', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockSeedImageLibraryForSite.mockResolvedValue({ hero: [], gallery: [], about: null, team: [], features: [] })
        mockResolveImageLibraryS3Map.mockResolvedValue({ 'gallery[0]': 'https://cdn.example.test/gallery-0.jpg' })
    })

    it('passes product terms reconstructed from aiGenerationMetadata.originalPrompt to the gallery seeder', async () => {
        mockFindByID.mockResolvedValue({
            id: 'site-1',
            tenant: 'tenant-1',
            siteType: 'creative',
            aiGenerationMetadata: {
                originalPrompt: 'hoạt hình | Portfolio | hoat hinh chibi | hoạt hình chibi',
            },
        })

        const res = await POST(makeReq('site-1'), makeParams('site-1'))

        expect(res.status).toBe(200)
        expect(mockSeedImageLibraryForSite).toHaveBeenCalledWith(
            expect.anything(),
            'tenant-1',
            'site-1',
            'creative',
            expect.any(Function),
            'hoạt hình chibi',
        )
    })

    it('falls back to tracked SEO keywords when originalPrompt has no product segment', async () => {
        mockFindByID.mockResolvedValue({
            id: 'site-2',
            tenant: 'tenant-1',
            siteType: 'creative',
            aiGenerationMetadata: { originalPrompt: '' },
            seo: {
                trackedKeywords: [
                    { keyword: 'chibi animation' },
                    { keyword: 'cartoon mascot' },
                ],
            },
        })

        const res = await POST(makeReq('site-2'), makeParams('site-2'))

        expect(res.status).toBe(200)
        expect(mockSeedImageLibraryForSite).toHaveBeenCalledWith(
            expect.anything(),
            'tenant-1',
            'site-2',
            'creative',
            expect.any(Function),
            'chibi animation cartoon mascot',
        )
    })
})
