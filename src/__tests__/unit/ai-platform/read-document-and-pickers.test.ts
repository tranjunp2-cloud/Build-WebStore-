/**
 * TC-AIREL-78/79/80 — documents attached to the chat are read to text on the server (PDF through pdf.js, which is
 * handed its worker module so it also works inside the bundled server), the attach menu's grid serves stock
 * photos only, and the proxy's same-origin check.
 * Real: read-document.ts (a real one-page PDF is built here), attachments.ts pick/list, csrf.ts.
 * Faked: the agent flag, the merchant (context), Pixabay, the platform fetch.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/ai-platform/config', () => ({ isAiAgentEnabled: vi.fn(() => true), getAiPlatformUrl: vi.fn(() => 'http://ai-platform.test') }))
vi.mock('@/lib/ai-platform/context', () => ({
    AgentAccessError: class AgentAccessError extends Error {
        constructor(message: string, readonly status: number) { super(message) }
    },
    resolveAgentActor: vi.fn(async () => ({ user: { id: 3, email: 'owner@shop.my' }, tenantId: '1', organizationId: 'org_1', role: 'owner' })),
    signAgentContextToken: vi.fn(async () => 'ctx-token'),
}))
vi.mock('@/lib/ai/pixabay-client', () => ({
    hasPixabayKey: vi.fn(() => true),
    searchPhotos: vi.fn(async () => [{ id: 11, url: 'https://cdn.pixabay.com/photo/11.jpg', alt: 'batik cloth', photographer: 'Mei', width: 800, height: 600 }]),
    downloadPhotoBuffer: vi.fn(async () => ({ buffer: Buffer.alloc(2000, 1), mimetype: 'image/jpeg' })),
}))

import { readDocumentText } from '@/lib/ai-platform/agent-tools/read-document'
import { handleAgentProxy } from '@/lib/ai-platform/agent-proxy'
import { validateCsrf } from '@/lib/ai-platform/csrf'

/** A one-page PDF with `text` drawn in Helvetica. */
function textPdf(text: string): Buffer {
    const objects = [
        '<< /Type /Catalog /Pages 2 0 R >>',
        '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
        '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 200] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
        `<< /Length ${`BT /F1 18 Tf 20 100 Td (${text}) Tj ET`.length} >>\nstream\nBT /F1 18 Tf 20 100 Td (${text}) Tj ET\nendstream`,
        '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    ]
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

describe('document text [TC-AIREL-78]', () => {
    it('reads the text of a PDF', async () => {
        const text = await readDocumentText(textPdf('Size chart S M L'), 'application/pdf')

        expect(text).toContain('Size chart S M L')
    })

    it('hands pdf.js its worker module up front, so it needs no worker file next to the bundle', async () => {
        await readDocumentText(textPdf('x'), 'application/pdf')

        expect((globalThis as { pdfjsWorker?: { WorkerMessageHandler?: unknown } }).pdfjsWorker?.WorkerMessageHandler).toBeDefined()
    })

    it('reads a CSV as it is, drops NUL bytes, and returns nothing for other types', async () => {
        expect(await readDocumentText(Buffer.from('size,price\nS,10\u0000\n'), 'text/csv')).toBe('size,price\nS,10\n')
        expect(await readDocumentText(Buffer.from('x'), 'application/zip')).toBe('')
    })

    it('rejects bytes that are not a PDF', async () => {
        await expect(readDocumentText(Buffer.from('not a pdf at all'), 'application/pdf')).rejects.toThrow()
    })
})

describe('the attach menu: stock photos here, the library in media-access.test.ts [TC-AIREL-79]', () => {
    const fetchMock = vi.fn()
    beforeEach(() => {
        fetchMock.mockReset().mockResolvedValue(Response.json({ id: 'att_1', kind: 'image', origin: 'stock', name: 'Photo', mime: 'image/jpeg', size: 2000 }, { status: 201 }))
        vi.stubGlobal('fetch', fetchMock)
    })
    afterEach(() => vi.unstubAllGlobals())

    const get = (query: string) =>
        handleAgentProxy(new NextRequest(`http://localhost:3000/api/agent/media${query}`, { headers: { host: 'localhost:3000' } }), ['media'])
    const pick = (body: unknown) =>
        handleAgentProxy(
            new NextRequest('http://localhost:3000/api/agent/attachments/pick', { method: 'POST', headers: { host: 'localhost:3000', 'content-type': 'application/json' }, body: JSON.stringify(body) }),
            ['attachments', 'pick'],
        )

    it('lists stock photos (stock is the default source) with their pixabay: ref and credit', async () => {
        const res = await get('?q=batik')

        expect(res.status).toBe(200)
        expect(await res.json()).toEqual([expect.objectContaining({ id: 'pixabay:11', origin: 'stock', name: 'batik cloth', credit: 'Pixabay · Mei' })])
    })

    it('answers 400 for an unknown source (the shop library: media-access.test.ts, product photos: shop-media-gaps.test.ts)', async () => {
        expect((await get('?source=nope')).status).toBe(400)
    })

    it('turns a picked stock photo into an attachment', async () => {
        const res = await pick({ origin: 'stock', ref: 'pixabay:11', url: 'https://cdn.pixabay.com/photo/11.jpg', name: 'Batik', credit: 'Pixabay · Mei' })

        expect(res.status).toBe(201)
        expect(JSON.parse(String(fetchMock.mock.calls[0]![1].body))).toMatchObject({ origin: 'stock', ref: 'pixabay:11', mime: 'image/jpeg' })
    })

    it.each([
        { origin: 'media', ref: 'pixabay:5', url: 'https://x.test/a.jpg' },
        { origin: 'stock', ref: 'media:5' },
        { origin: 'product', ref: 'asset:dam-1' },
        { origin: 'stock', ref: 'https://evil.example/a.jpg', url: 'https://evil.example/a.jpg' },
        { origin: 'stock', ref: 'pixabay:11' },
    ])('refuses to pick %j (400) and sends nothing to the platform', async (body) => {
        expect((await pick(body)).status).toBe(400)
        expect(fetchMock).not.toHaveBeenCalled()
    })
})

describe('same-origin check [TC-AIREL-80]', () => {
    const req = (headers: Record<string, string>) => new NextRequest('http://localhost:3000/api/agent/runs', { method: 'POST', headers })

    it('lets the same host through by Origin or by Referer', () => {
        expect(validateCsrf(req({ host: 'shop.test', origin: 'https://shop.test' }))).toBe(true)
        expect(validateCsrf(req({ host: 'shop.test', referer: 'https://shop.test/editor/1' }))).toBe(true)
    })

    it('refuses another host, and a malformed Origin or Referer', () => {
        expect(validateCsrf(req({ host: 'shop.test', origin: 'https://evil.test' }))).toBe(false)
        expect(validateCsrf(req({ host: 'shop.test', referer: 'https://evil.test/x' }))).toBe(false)
        expect(validateCsrf(req({ host: 'shop.test', origin: 'not a url' }))).toBe(false)
        expect(validateCsrf(req({ host: 'shop.test', referer: '::' }))).toBe(false)
    })

    it('lets a client with neither header through (a non-browser caller still needs the session)', () => {
        expect(validateCsrf(req({ host: 'shop.test' }))).toBe(true)
    })
})
