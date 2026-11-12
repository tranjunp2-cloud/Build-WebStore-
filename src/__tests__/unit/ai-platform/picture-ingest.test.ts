/**
 * TC-AIREL-76/77 — pictures the copilot places become Payload `media` rows (the section stores the row id).
 * Stock (pixabay:) and chat attachments (attachment:) are the sources that create rows; stock rows carry system provenance
 * (provider, license, source, credit); every new row is owned by the workspace (tenant); anything else (asset:, a URL)
 * is refused before a row exists. `media:` library picks are covered in media-access.test.ts (TC-AIREL-135).
 * Real: picture-ingest.ts, media-tools.downloadMedia routing, the media create lock.
 * Faked: the Payload Local API (in memory), the Pixabay download.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ChangeSetApplyError } from '@/lib/ai-platform/appliers/errors'
import { ingestPicture, isIngestableRef } from '@/lib/ai-platform/appliers/picture-ingest'
import { downloadPhotoBuffer } from '@/lib/ai/pixabay-client'

vi.mock('@/lib/ai/pixabay-client', () => ({
    hasPixabayKey: vi.fn(() => true),
    searchPhotos: vi.fn(),
    downloadPhotoBuffer: vi.fn(),
}))

type CreateArg = { collection: string; data: Record<string, unknown>; file: { data: Buffer; mimetype: string; name: string; size: number } }

const cms = {
    create: vi.fn<(arg: CreateArg) => Promise<{ id: number }>>(),
    findByID: vi.fn(async ({ id }: { id: number }) => ({ id, url: `/api/media/file/${id}.jpg` })),
}
const asCms = cms as unknown as Parameters<typeof ingestPicture>[0]
const TENANT = '7'
const ingest = (image: Parameters<typeof ingestPicture>[1], alt: string, load?: Parameters<typeof ingestPicture>[3]) => ingestPicture(asCms, image, alt, load, TENANT)

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4, 5, 6, 7, 8])
const PIXABAY = { ref: 'pixabay:11', url: 'https://cdn.pixabay.com/photo/11.jpg', credit: 'Pixabay · Mei' }

beforeEach(() => {
    cms.create.mockReset().mockResolvedValue({ id: 91 })
    cms.findByID.mockClear()
    vi.mocked(downloadPhotoBuffer).mockReset().mockResolvedValue({ buffer: JPEG, mimetype: 'image/jpeg' } as never)
})

describe('stock photo into media [TC-AIREL-76]', () => {
    it('creates a media row with the stock provenance and returns it read back (with its public url)', async () => {
        const doc = await ingest(PIXABAY, 'Batik cloth')

        expect(doc).toEqual({ id: 91, url: '/api/media/file/91.jpg' })
        const arg = cms.create.mock.calls[0]![0]
        expect(arg.collection).toBe('media')
        expect(arg.data).toEqual({
            alt: 'Batik cloth',
            aiGenerated: false,
            tenant: 7,
            sourceProvider: 'pixabay',
            licenseName: 'Pixabay Content License',
            licenseUrl: 'https://pixabay.com/service/license-summary/',
            sourceUrl: PIXABAY.url,
            attribution: 'Pixabay · Mei',
        })
        expect(arg.file).toMatchObject({ name: 'pixabay-11.jpg', mimetype: 'image/jpeg', size: JPEG.length })
    })

    it('names the file by what the bytes are (png stays png)', async () => {
        vi.mocked(downloadPhotoBuffer).mockResolvedValue({ buffer: JPEG, mimetype: 'image/png' } as never)

        await ingest(PIXABAY, 'x')

        expect(cms.create.mock.calls[0]![0].file.name).toBe('pixabay-11.png')
    })

    it('keeps no source url that is not a Pixabay address, and a missing alt becomes "Picture"', async () => {
        await ingest({ ref: 'pixabay:11', url: 'https://evil.example/x.jpg' }, '   ')

        const data = cms.create.mock.calls[0]![0].data
        expect(data).not.toHaveProperty('sourceUrl')
        expect(data).not.toHaveProperty('attribution')
        expect(data.alt).toBe('Picture')
    })

    it('cuts the alt text to 200 characters', async () => {
        await ingest(PIXABAY, 'a'.repeat(300))

        expect((cms.create.mock.calls[0]![0].data.alt as string).length).toBe(200)
    })

    it('tries a failed create once more, then gives up with the error', async () => {
        cms.create.mockRejectedValueOnce(new Error('storage hiccup')).mockResolvedValueOnce({ id: 92 })
        expect((await ingest(PIXABAY, 'x')).id).toBe(92)

        cms.create.mockReset().mockRejectedValue(new Error('storage down'))
        await expect(ingest(PIXABAY, 'x')).rejects.toThrow('storage down')
        expect(cms.create).toHaveBeenCalledTimes(2)
    })
})

// TC-AIWB-130 — Approve all applies blog cards one after the other while the page refreshes: a media create can
// resolve with an id whose row the drizzle race rolled back (GH-1185). The picture is created once more, not dropped.
describe('a media row lost after its create [TC-AIWB-130]', () => {
    const notFound = () => Object.assign(new Error('Not Found'), { name: 'NotFound', status: 404 })

    it('creates the picture again when the row it was given is gone, and returns the new row', async () => {
        // Arrange
        cms.create.mockReset().mockResolvedValueOnce({ id: 134 }).mockResolvedValueOnce({ id: 136 })
        cms.findByID.mockImplementationOnce(async () => { throw notFound() })

        // Act
        const doc = await ingest(PIXABAY, 'Coffee powder')

        // Assert
        expect(cms.create).toHaveBeenCalledTimes(2)
        expect(doc).toEqual({ id: 136, url: '/api/media/file/136.jpg' })
    })

    it('gives up with the error when the second row is lost too', async () => {
        // Arrange
        cms.create.mockReset().mockResolvedValueOnce({ id: 134 }).mockResolvedValueOnce({ id: 135 })
        cms.findByID.mockImplementationOnce(async () => { throw notFound() }).mockImplementationOnce(async () => { throw notFound() })

        // Act + Assert
        await expect(ingest(PIXABAY, 'Coffee powder')).rejects.toMatchObject({ name: 'NotFound' })
        expect(cms.create).toHaveBeenCalledTimes(2)
    })

    it('does not create again for any other read error', async () => {
        // Arrange
        cms.findByID.mockImplementationOnce(async () => { throw new Error('connection reset') })

        // Act + Assert
        await expect(ingest(PIXABAY, 'Coffee powder')).rejects.toThrow('connection reset')
        expect(cms.create).toHaveBeenCalledTimes(1)
    })
})

describe('chat attachment into media, and refused sources [TC-AIREL-77]', () => {
    it('stores the merchant\'s own upload with no stock provenance', async () => {
        const load = vi.fn(async () => ({ buffer: JPEG, mime: 'image/webp', name: 'att_1.webp' }))

        await ingest({ ref: 'attachment:att_1', name: 'shop.webp' }, 'The shop', load)

        expect(load).toHaveBeenCalledWith('att_1')
        const arg = cms.create.mock.calls[0]![0]
        expect(arg.data).toEqual({ alt: 'The shop', aiGenerated: false, tenant: 7 })
        expect(arg.file.name).toBe('att_1.webp')
        expect(downloadPhotoBuffer).not.toHaveBeenCalled()
    })

    it('refuses a file that is not a JPG, PNG or WebP picture (422), creating nothing', async () => {
        const load = vi.fn(async () => ({ buffer: Buffer.from('%PDF'), mime: 'application/pdf', name: 'a.pdf' }))

        const failure = await ingest({ ref: 'attachment:att_2' }, 'x', load).catch((e: unknown) => e)

        expect(failure).toBeInstanceOf(ChangeSetApplyError)
        expect(failure).toMatchObject({ status: 422 })
        expect(cms.create).not.toHaveBeenCalled()
    })

    it.each([
        { ref: 'asset:dam-9' },
        { ref: 'https://evil.example/x.jpg', url: 'https://evil.example/x.jpg' },
        { ref: 'attachment:att_3' }, // no loader given
        { ref: 'pixabay:11' }, // no url given
    ])('refuses %j: nothing is fetched, no row is created', async (image) => {
        await expect(ingest(image, 'x')).rejects.toBeInstanceOf(ChangeSetApplyError)

        expect(cms.create).not.toHaveBeenCalled()
        expect(downloadPhotoBuffer).not.toHaveBeenCalled()
    })

    it('says which refs can be ingested at all', () => {
        expect(['pixabay:11', 'attachment:att_1', 'media:5'].every(isIngestableRef)).toBe(true)
        expect(['media:', 'media:5x', 'asset:x', 'pixabay:', 'pixabay:a b', 'https://x'].some(isIngestableRef)).toBe(false)
    })
})
