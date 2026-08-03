// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import {
    createOpenAIWikimediaRater,
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

describe('[TC-F38-WIKI-01–08] Wikimedia adapter and OpenAI rating', () => {
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

    it('sends at most five inline validated previews and accepts only an input winner ID', async () => {
        // Arrange
        const candidates = Array.from({ length: 7 }, (_, index) => ({
            ...(wikiResponse() as unknown as object),
            provider: 'wikimedia' as const,
            providerImageId: String(index),
            previewUrl: 'https://upload.wikimedia.org/preview.jpg',
            downloadUrl: 'https://upload.wikimedia.org/original.jpg',
            sourceUrl: 'https://commons.wikimedia.org/wiki/File:X.jpg',
            creator: 'Jane',
            licenseName: 'CC BY 4.0',
            licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
            attribution: 'Jane',
            tags: ['bakery'],
            category: 'fnb',
            width: 1600,
            height: 900,
            aspect: 16 / 9,
            active: true,
        }))
        const loadPreview = vi.fn().mockResolvedValue({
            data: new Uint8Array([0xff, 0xd8, 0xff]),
            mimeType: 'image/jpeg',
        })
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            json: vi.fn().mockResolvedValue({
                choices: [{ message: { content: JSON.stringify({
                    winnerId: '2',
                    relevant: true,
                    alt: 'Bakery',
                    reason: 'Relevant',
                }) } }],
            }),
        })
        const rater = createOpenAIWikimediaRater({
            apiKey: 'secret-key',
            loadPreview,
            fetch: fetchMock,
        })

        // Act
        const result = await rater.rate(candidates, demand)

        // Assert
        expect(result?.winnerId).toBe('2')
        expect(loadPreview).toHaveBeenCalledTimes(5)
        const body = JSON.parse((fetchMock.mock.calls[0]![1] as RequestInit).body as string)
        expect(body.model).toBe('gpt-5.4-mini')
        expect(body.response_format.json_schema.schema.required).toEqual([
            'winnerId',
            'relevant',
            'alt',
            'reason',
        ])
        expect(fetchMock.mock.calls[0]![0]).toBe('https://api.openai.com/v1/chat/completions')
        expect((fetchMock.mock.calls[0]![1] as RequestInit).headers).toEqual(
            expect.objectContaining({ Authorization: 'Bearer secret-key' }),
        )
    })
})
