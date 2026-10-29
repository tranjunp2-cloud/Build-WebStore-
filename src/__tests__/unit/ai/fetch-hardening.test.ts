// @vitest-environment node
/**
 * TC-AISEC-050 — URL extract: the page body is counted while it arrives, on the decoded bytes, and the request is
 * aborted past 5 MB (a few KB of gzip / brotli can no longer fill the function's memory); it asks for
 * `Accept-Encoding: identity`.
 * TC-AISEC-051 — allowlisted downloads (stock photos, library pictures) never let fetch follow a redirect: at most 2
 * hops, each re-checked against the host allowlist and https before it is requested; the body is capped while it
 * arrives (10 MB stock, 8 MB library).
 * TC-AISEC-052 — reading a PDF attachment has a 10 s budget (checked between pages, the parse gives the event loop a
 * turn) and reads at most 50 pages.
 * Real: fetch-capped.ts, url-scraper.ts, pixabay-client.ts, media-tools.ts, read-document.ts, gzip (node:zlib +
 * DecompressionStream). Faked: DNS, the network (fetch), Payload (unused here), the clock in one PDF case.
 */
import { gzipSync } from 'node:zlib'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { mockLookup } = vi.hoisted(() => ({ mockLookup: vi.fn() }))

vi.mock('dns/promises', () => ({
    default: { lookup: (...args: unknown[]) => mockLookup(...args) },
    lookup: (...args: unknown[]) => mockLookup(...args),
}))
vi.mock('open-graph-scraper', () => ({ default: vi.fn().mockResolvedValue({ result: {} }) }))
vi.mock('payload', () => ({ getPayload: vi.fn() }))
vi.mock('@payload-config', () => ({ default: {} }))

import { readBodyCapped } from '@/lib/ai/fetch-capped'
import { downloadPhotoBuffer } from '@/lib/ai/pixabay-client'
import { fetchWithSafeguards } from '@/lib/ai/url-scraper'
import { downloadLibraryPicture } from '@/lib/ai-platform/agent-tools/media-tools'
import { DocumentReadTimeoutError, PDF_PAGES_MAX, readDocumentText } from '@/lib/ai-platform/agent-tools/read-document'

const MB = 1024 * 1024
const fetchMock = vi.fn()

/** A body that never ends: counts what was pulled and whether the reader cancelled it. */
function endlessBody(chunkBytes = 64 * 1024) {
    const state = { pulled: 0, cancelled: false }
    const chunk = new Uint8Array(chunkBytes).fill(0x61)
    const stream = new ReadableStream<Uint8Array>({
        pull(controller) {
            state.pulled += chunk.byteLength
            controller.enqueue(chunk)
        },
        cancel() {
            state.cancelled = true
        },
    })
    return { stream, state }
}
const redirect = (location: string) => new Response(null, { status: 302, headers: { location } })
const picture = (bytes = 2000) => new Response(Buffer.alloc(bytes, 1), { status: 200, headers: { 'content-type': 'image/jpeg' } })

/** A PDF with `pages` pages, page i saying "Page i". */
function pagesPdf(pages: number): Buffer {
    const font = pages * 2 + 3
    const objects = ['<< /Type /Catalog /Pages 2 0 R >>', `<< /Type /Pages /Kids [${Array.from({ length: pages }, (_, i) => `${i * 2 + 3} 0 R`).join(' ')}] /Count ${pages} >>`]
    for (let i = 0; i < pages; i += 1) {
        const content = `BT /F1 18 Tf 20 100 Td (Page ${i + 1}) Tj ET`
        objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 200] /Contents ${i * 2 + 4} 0 R /Resources << /Font << /F1 ${font} 0 R >> >> >>`)
        objects.push(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`)
    }
    objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>')
    let out = '%PDF-1.4\n'
    const offsets: number[] = []
    objects.forEach((body, i) => {
        offsets.push(out.length)
        out += `${i + 1} 0 obj\n${body}\nendobj\n`
    })
    const xref = out.length
    out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`
    out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`
    return Buffer.from(out, 'latin1')
}

beforeEach(() => {
    fetchMock.mockReset()
    mockLookup.mockReset().mockResolvedValue({ address: '93.184.216.34', family: 4 })
    vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
})

describe('URL extract body cap on decoded bytes [TC-AISEC-050]', () => {
    it('stops reading an endless page past 5 MB and cancels it, instead of buffering it all', async () => {
        // Arrange
        const { stream, state } = endlessBody()
        fetchMock.mockResolvedValue(new Response(stream, { status: 200, headers: { 'content-type': 'text/html' } }))

        // Act
        const scraping = fetchWithSafeguards(new URL('https://kedai-kopi.example/'))

        // Assert
        await expect(scraping).rejects.toThrow('Response too large (exceeds 5 MB)')
        expect(state.cancelled).toBe(true)
        expect(state.pulled).toBeLessThan(5 * MB + 4 * 64 * 1024)
    })

    it('asks for an uncompressed page and still reads a normal one', async () => {
        // Arrange
        fetchMock.mockResolvedValue(new Response('<html><body>Kedai Kopi</body></html>', { status: 200, headers: { 'content-type': 'text/html' } }))

        // Act
        const html = await fetchWithSafeguards(new URL('https://kedai-kopi.example/'))

        // Assert
        expect(html).toContain('Kedai Kopi')
        expect(fetchMock.mock.calls[0]![1].headers).toMatchObject({ 'Accept-Encoding': 'identity' })
    })

    it('counts after decompression: 20 MB of zeros gzipped to a few KB is refused at the 5 MB cap', async () => {
        // Arrange
        const bomb = gzipSync(Buffer.alloc(20 * MB))
        const decoded = new Response(bomb).body!.pipeThrough(new DecompressionStream('gzip'))

        // Act
        const reading = readBodyCapped(new Response(decoded), 5 * MB)

        // Assert
        expect(bomb.byteLength).toBeLessThan(100 * 1024)
        await expect(reading).rejects.toMatchObject({ code: 'TOO_LARGE' })
    })
})

describe('allowlisted downloads and redirects [TC-AISEC-051]', () => {
    it('stock photo: fetch never follows by itself; one hop to another allowlisted https host is followed', async () => {
        // Arrange
        fetchMock.mockResolvedValueOnce(redirect('https://cdn.pixabay.com/photo/1.jpg')).mockResolvedValueOnce(picture())

        // Act
        const out = await downloadPhotoBuffer('https://pixabay.com/get/1_1280.jpg')

        // Assert
        expect(out.size).toBe(2000)
        expect(fetchMock.mock.calls.map(([url, init]) => [String(url), init.redirect])).toEqual([
            ['https://pixabay.com/get/1_1280.jpg', 'manual'],
            ['https://cdn.pixabay.com/photo/1.jpg', 'manual'],
        ])
    })

    it.each([
        ['another host', 'http://169.254.169.254/latest/meta-data'],
        ['plain http on an allowlisted host', 'http://cdn.pixabay.com/photo/1.jpg'],
        ['another port', 'https://cdn.pixabay.com:8443/photo/1.jpg'],
    ])('stock photo: a redirect to %s is refused before it is requested', async (_case, location) => {
        // Arrange
        fetchMock.mockResolvedValueOnce(redirect(location))

        // Act + Assert
        await expect(downloadPhotoBuffer('https://pixabay.com/get/1_1280.jpg')).rejects.toMatchObject({ code: 'SSRF_BLOCKED' })
        expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    it('stock photo: a third redirect is refused, even between allowlisted hosts', async () => {
        // Arrange
        fetchMock
            .mockResolvedValueOnce(redirect('https://cdn.pixabay.com/a.jpg'))
            .mockResolvedValueOnce(redirect('https://pixabay.com/b.jpg'))
            .mockResolvedValueOnce(redirect('https://cdn.pixabay.com/c.jpg'))

        // Act + Assert
        await expect(downloadPhotoBuffer('https://pixabay.com/get/1_1280.jpg')).rejects.toMatchObject({ code: 'SSRF_BLOCKED' })
        expect(fetchMock).toHaveBeenCalledTimes(3)
    })

    it('stock photo: a body over 10 MB is stopped while it arrives', async () => {
        // Arrange
        const { stream, state } = endlessBody()
        fetchMock.mockResolvedValueOnce(new Response(stream, { status: 200, headers: { 'content-type': 'image/jpeg' } }))

        // Act + Assert
        await expect(downloadPhotoBuffer('https://cdn.pixabay.com/photo/1.jpg')).rejects.toMatchObject({ code: 'TOO_LARGE' })
        expect(state.cancelled).toBe(true)
        expect(state.pulled).toBeLessThan(10_000_000 + 4 * 64 * 1024)
    })

    describe('library picture', () => {
        const saved = { ...process.env }
        beforeEach(() => {
            process.env.S3_BUCKET = 'media'
            process.env.NEXT_PUBLIC_S3_ENDPOINT = 'https://store.example'
        })
        afterEach(() => {
            process.env = { ...saved }
        })

        it('follows the file route\'s redirect to the media storage host', async () => {
            // Arrange
            fetchMock.mockResolvedValueOnce(redirect('https://store.example/media/p1.jpg')).mockResolvedValueOnce(picture(3000))

            // Act
            const out = await downloadLibraryPicture({ url: '/api/media/file/p1.jpg' }, 'https://app.example')

            // Assert
            expect(out).toMatchObject({ mime: 'image/jpeg' })
            expect(out.buffer.length).toBe(3000)
            expect(fetchMock.mock.calls.map(([url, init]) => [String(url), init.redirect])).toEqual([
                ['https://app.example/api/media/file/p1.jpg', 'manual'],
                ['https://store.example/media/p1.jpg', 'manual'],
            ])
        })

        it('refuses a redirect anywhere else without requesting it', async () => {
            // Arrange
            fetchMock.mockResolvedValueOnce(redirect('https://evil.example/p1.jpg'))

            // Act + Assert
            await expect(downloadLibraryPicture({ url: '/api/media/file/p1.jpg' }, 'https://app.example')).rejects.toThrow("The picture is stored somewhere this can't read.")
            expect(fetchMock).toHaveBeenCalledTimes(1)
        })

        it('stops a picture over 8 MB while it arrives', async () => {
            // Arrange
            const { stream, state } = endlessBody()
            fetchMock.mockResolvedValueOnce(new Response(stream, { status: 200, headers: { 'content-type': 'image/jpeg' } }))

            // Act + Assert
            await expect(downloadLibraryPicture({ url: '/api/media/file/p1.jpg' }, 'https://app.example')).rejects.toThrow('The picture is too large.')
            expect(state.cancelled).toBe(true)
        })
    })
})

describe('PDF time budget and page cap [TC-AISEC-052]', () => {
    it(`reads at most ${PDF_PAGES_MAX} pages`, async () => {
        // Act
        const text = await readDocumentText(pagesPdf(60), 'application/pdf')

        // Assert
        expect(text).toContain(`Page ${PDF_PAGES_MAX}`)
        expect(text).not.toContain(`Page ${PDF_PAGES_MAX + 1}`)
    })

    it('gives up once 10 s are spent, between pages, with a timeout error', async () => {
        // Arrange — every clock read moves 3 s on: the budget runs out after a few pages
        let now = 0
        vi.spyOn(Date, 'now').mockImplementation(() => (now += 3000))

        // Act + Assert
        await expect(readDocumentText(pagesPdf(20), 'application/pdf')).rejects.toBeInstanceOf(DocumentReadTimeoutError)
    })

    it('honours a shorter budget passed by the caller', async () => {
        // Arrange
        let now = 0
        vi.spyOn(Date, 'now').mockImplementation(() => (now += 10))

        // Act + Assert
        await expect(readDocumentText(pagesPdf(20), 'application/pdf', { pdfBudgetMs: 25 })).rejects.toThrow('The document took too long to read.')
    })
})
