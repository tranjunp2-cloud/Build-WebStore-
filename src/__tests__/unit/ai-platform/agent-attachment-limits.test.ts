/**
 * TC-AIREL-43/44/45 — attachments toward an ai-platform on Vercel: a file above 3,000,000 bytes and a
 * forwarded body above 4.4 MB are refused here with a 413 and a clear message (nothing is sent), the
 * platform's own 413 problem reaches the browser with its message, and the proxy route may run 300 s.
 * Real: agent-proxy routing, attachments.ts, upstream.ts (fetch is stubbed, not the module).
 * Faked: the agent flag + platform URL, the merchant (context), Pixabay.
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
    searchPhotos: vi.fn(async () => []),
    downloadPhotoBuffer: vi.fn(async () => ({ buffer: Buffer.alloc(3_000_001, 1), mimetype: 'image/jpeg' })),
}))

import { ATTACHMENT_BODY_MAX_BYTES, ATTACHMENT_FILE_MAX_BYTES } from '@/lib/ai-platform/attachments'
import { handleAgentProxy } from '@/lib/ai-platform/agent-proxy'

const stored = { id: 'att_1', kind: 'image', origin: 'upload', name: 'photo.png', mime: 'image/png', size: 10 }
const fetchMock = vi.fn()

function upload(file: File) {
    const form = new FormData()
    form.append('file', file, file.name)
    return handleAgentProxy(new NextRequest('http://localhost:3000/api/agent/attachments', { method: 'POST', headers: { host: 'localhost:3000' }, body: form }), ['attachments'])
}

function pick(body: unknown) {
    return handleAgentProxy(
        new NextRequest('http://localhost:3000/api/agent/attachments/pick', {
            method: 'POST',
            headers: { host: 'localhost:3000', 'content-type': 'application/json' },
            body: JSON.stringify(body),
        }),
        ['attachments', 'pick'],
    )
}

const png = (bytes: number, name = 'photo.png') => new File([new Uint8Array(bytes).fill(7)], name, { type: 'image/png' })

beforeEach(() => {
    fetchMock.mockReset().mockResolvedValue(new Response(JSON.stringify(stored), { status: 201, headers: { 'content-type': 'application/json' } }))
    vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => vi.unstubAllGlobals())

describe('attachment size limits toward ai-platform [TC-AIREL-43]', () => {
    it('uses the Vercel numbers of ai-platform: 3,000,000 bytes a file, 4.4 MB a body', () => {
        expect(ATTACHMENT_FILE_MAX_BYTES).toBe(3_000_000)
        expect(ATTACHMENT_BODY_MAX_BYTES).toBe(4_400_000)
    })

    it('forwards a file of exactly 3,000,000 bytes (about 4.0 MB of base64, inside the body limit)', async () => {
        // Act
        const res = await upload(png(3_000_000))

        // Assert
        expect(res.status).toBe(201)
        expect(fetchMock).toHaveBeenCalledTimes(1)
        const sent = String(fetchMock.mock.calls[0]?.[1]?.body)
        expect(Buffer.byteLength(sent)).toBeLessThanOrEqual(ATTACHMENT_BODY_MAX_BYTES)
        expect(fetchMock.mock.calls[0]?.[1]?.headers).toMatchObject({ 'content-type': 'application/vnd.ech.attachment+json' })
    })

    it('refuses one byte more with a 413 that names the file and the limit, and sends nothing', async () => {
        // Act
        const res = await upload(png(3_000_001, 'banner.png'))

        // Assert
        expect(res.status).toBe(413)
        expect(await res.json()).toMatchObject({ status: 413, detail: 'banner.png is larger than 3 MB. Choose a smaller file.' })
        expect(fetchMock).not.toHaveBeenCalled()
    })

    it('refuses a document whose base64 plus its extracted text would pass the 4.4 MB body, with a 413 and no upload', async () => {
        // Arrange: a 2.9 MB file whose first 200,000 characters (all the text that is kept) are control
        // characters: JSON writes each as \u0001, so the text alone adds 1.2 MB to the 3.9 MB of base64
        const csv = new File([`${'\u0001'.repeat(200_000)}${'a'.repeat(2_700_000)}`], 'stock.csv', { type: 'text/csv' })

        // Act
        const res = await upload(csv)

        // Assert
        expect(csv.size).toBeLessThan(ATTACHMENT_FILE_MAX_BYTES)
        expect(res.status).toBe(413)
        expect(((await res.json()) as { detail: string }).detail).toMatch(/^stock\.csv is too large to attach together with its text/)
        expect(fetchMock).not.toHaveBeenCalled()
    })

    it('applies the same file limit to a picture picked from stock photos', async () => {
        // Act
        const res = await pick({ origin: 'stock', ref: 'pixabay:5', url: 'https://cdn.pixabay.com/photo/5.jpg', name: 'Batik' })

        // Assert
        expect(res.status).toBe(413)
        expect(((await res.json()) as { detail: string }).detail).toBe('Batik is larger than 3 MB. Choose a smaller file.')
        expect(fetchMock).not.toHaveBeenCalled()
    })
})

describe("ai-platform's 413 reaches the browser [TC-AIREL-44]", () => {
    it("passes the platform's problem detail through with status 413", async () => {
        // Arrange: ai-platform's own refusal (src/agent/attachment.service.ts) in its problem shape
        fetchMock.mockResolvedValue(
            new Response(JSON.stringify({ title: 'Payload Too Large', status: 413, detail: 'photo.png is larger than 3 MB. Choose a smaller file.' }), {
                status: 413,
                headers: { 'content-type': 'application/json' },
            }),
        )

        // Act
        const res = await upload(png(1_000))

        // Assert
        expect(res.status).toBe(413)
        expect(await res.json()).toMatchObject({ status: 413, detail: 'photo.png is larger than 3 MB. Choose a smaller file.' })
    })

    it('turns the Vercel platform\'s bare 413 (no JSON) into a message the merchant can act on', async () => {
        // Arrange
        fetchMock.mockResolvedValue(new Response('Request Entity Too Large', { status: 413, headers: { 'content-type': 'text/plain' } }))

        // Act
        const res = await upload(png(1_000, 'wide.png'))

        // Assert
        expect(res.status).toBe(413)
        expect(await res.json()).toMatchObject({ status: 413, detail: 'wide.png is too large to attach. Choose a smaller file.' })
    })

    it('still passes other platform refusals through unchanged', async () => {
        // Arrange
        fetchMock.mockResolvedValue(new Response(JSON.stringify({ title: 'Bad Request', status: 400, detail: 'Unsupported file type.' }), { status: 400, headers: { 'content-type': 'application/json' } }))

        // Act
        const res = await upload(png(1_000))

        // Assert
        expect(res.status).toBe(400)
        expect(await res.json()).toMatchObject({ detail: 'Unsupported file type.' })
    })
})

describe('agent proxy route duration [TC-AIREL-45]', () => {
    it('may run 300 s, as long as ai-platform on Vercel', async () => {
        vi.resetModules()
        vi.doMock('@/lib/ai-platform/agent-proxy', () => ({ handleAgentProxy: vi.fn() }))
        const route = await import('@/app/api/agent/[...path]/route')

        expect(route.maxDuration).toBe(300)
        expect(route.runtime).toBe('nodejs')
        expect(route.dynamic).toBe('force-dynamic')
    })
})
