// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import {
    createWikimediaAdapter,
    type PlannedReservoir,
} from '@/lib/ai/image-sourcing'

const demand: PlannedReservoir = {
    kind: 'landscape',
    count: 1,
    subject: 'bakery',
    category: 'fnb',
    aspect: 'landscape',
    orientation: 'horizontal',
    perPage: 200,
    aiEligible: true,
}

function wikiResponse(licenseName = 'CC BY-SA 4.0') {
    return {
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({
            query: {
                pages: [{
                    pageid: 7,
                    title: 'File:Bakery.jpg',
                    imageinfo: [{
                        thumburl: 'https://upload.wikimedia.org/preview.jpg',
                        url: 'https://upload.wikimedia.org/original.jpg',
                        descriptionurl: 'https://commons.wikimedia.org/wiki/File:Bakery.jpg',
                        width: 1600,
                        height: 900,
                        extmetadata: {
                            Artist: { value: '<b>Jane</b>' },
                            LicenseShortName: { value: licenseName },
                            LicenseUrl: { value: 'https://creativecommons.org/licenses/by-sa/4.0/' },
                            Attribution: { value: 'Jane / Wikimedia Commons' },
                            ImageDescription: { value: 'Bakery counter' },
                        },
                    }],
                }],
            },
        }),
    } as unknown as Response
}

describe('[TC-F38-WIKI-01–08] Wikimedia adapter (AI rating moved out of prime-web with the OpenAI rater)', () => {
    it('uses namespace 6, max 20, user agent and maps complete reusable provenance', async () => {
        // Arrange
        const fetchMock = vi.fn().mockResolvedValue(wikiResponse())
        const adapter = createWikimediaAdapter({ userAgent: 'PrimeWeb/1.0 contact@example.com', fetch: fetchMock })

        // Act
        const result = await adapter.search(demand)

        // Assert
        expect(result.ok).toBe(true)
        if (!result.ok) return
        expect(result.candidates[0]).toMatchObject({
            provider: 'wikimedia',
            providerImageId: '7',
            creator: 'Jane',
            licenseName: 'CC BY-SA 4.0',
            attribution: 'Jane / Wikimedia Commons',
        })
        const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit]
        expect(url.searchParams.get('gsrnamespace')).toBe('6')
        expect(url.searchParams.get('gsrlimit')).toBe('50')
        expect(url.searchParams.get('iiurlwidth')).toBe('512')
        expect((init.headers as Record<string, string>)['User-Agent']).toContain('PrimeWeb')
    })

    it('rejects NC/ND and incomplete license metadata before rating', async () => {
        // Arrange
        const adapter = createWikimediaAdapter({
            userAgent: 'PrimeWeb/1.0',
            fetch: vi.fn().mockResolvedValue(wikiResponse('CC BY-NC-ND 4.0')),
        })

        // Act
        const result = await adapter.search(demand)

        // Assert
        expect(result).toEqual({ ok: true, candidates: [] })
    })

    it('overfetches raw results but caps the validated candidate pool at 20', async () => {
        // Arrange
        const base = await wikiResponse().json() as {
            query: { pages: Array<Record<string, unknown>> }
        }
        const page = base.query.pages[0]!
        const pages = Array.from({ length: 30 }, (_, index) => ({
            ...page,
            pageid: index + 1,
        }))
        const adapter = createWikimediaAdapter({
            userAgent: 'PrimeWeb/1.0',
            fetch: vi.fn().mockResolvedValue({
                ok: true,
                status: 200,
                json: vi.fn().mockResolvedValue({ query: { pages } }),
            }),
        })

        // Act
        const result = await adapter.search(demand)

        // Assert
        expect(result.ok && result.candidates).toHaveLength(20)
    })

    it('TC-F38-SEC-03: rejects a reusable-looking license on an untrusted host', async () => {
        // Arrange
        const response = wikiResponse()
        const json = await response.json() as {
            query: { pages: Array<{ imageinfo: Array<{ extmetadata: Record<string, { value: string }> }> }> }
        }
        json.query.pages[0]!.imageinfo[0]!.extmetadata.LicenseUrl = {
            value: 'https://attacker.example/licenses/by-sa/4.0/',
        }
        const adapter = createWikimediaAdapter({
            userAgent: 'PrimeWeb/1.0',
            fetch: vi.fn().mockResolvedValue({
                ...response,
                json: vi.fn().mockResolvedValue(json),
            }),
        })

        // Act
        const result = await adapter.search(demand)

        // Assert
        expect(result).toEqual({ ok: true, candidates: [] })
    })
})
