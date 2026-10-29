/**
 * TC-AIREL-200..203 — generated pictures: ai-platform draws, this app keeps the bytes as a Payload `media` row owned by
 * the asking workspace (`aiGenerated`, `aiPrompt`) and answers `media:<id>`. Covers the storing (`saveGeneratedPicture`),
 * the facade's `media.save_generated`, the BFF's `POST /api/agent/media/generate` and the body-size limits (Vercel 4.5 MB).
 * Real: generated-images.ts, picture-ingest `createMediaRow`, media-access (the stored row is allowed for its workspace),
 *   handle-agent-tool routing, agent-proxy, upstream, real image bytes through sharp.
 * Faked: the Payload Local API (in memory), ai-platform (`fetch`), the agent flag and context.
 */
import sharp from 'sharp'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

type Row = Record<string, unknown>
type CreateArg = { collection: string; data: Row; file: { data: Buffer; mimetype: string; name: string; size: number } }
const store = vi.hoisted(() => ({ media: [] as Array<Record<string, unknown>> }))
const cms = {
    create: vi.fn(async (arg: CreateArg) => {
        const row = { id: 900 + store.media.length, ...arg.data, mimeType: arg.file.mimetype, filename: arg.file.name, url: `/api/media/file/${arg.file.name}` }
        store.media.push(row)
        return { id: row.id }
    }),
    findByID: vi.fn(async ({ id }: { id: number }) => store.media.find((row) => row.id === id)),
    find: vi.fn(async ({ collection, where }: { collection: string; where?: { id?: { in?: unknown[] } } }) => {
        const ids = (where?.id?.in ?? []).map(String)
        const docs = collection === 'media' ? store.media.filter((row) => ids.includes(String(row.id))) : []
        return { docs, totalDocs: docs.length }
    }),
}

vi.mock('payload', () => ({ getPayload: vi.fn(async () => cms) }))
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('@/lib/ai-platform/config', () => ({ isAiAgentEnabled: vi.fn(() => true), getAiPlatformUrl: vi.fn(() => 'http://ai-platform.test') }))
vi.mock('@/lib/ai-platform/context', () => ({
    AgentAccessError: class AgentAccessError extends Error {
        constructor(message: string, readonly status: number) { super(message) }
    },
    resolveAgentActor: vi.fn(async () => ({ user: { id: 3, email: 'owner@shop.my' }, tenantId: '4', organizationId: 'org_4', role: 'owner' })),
    signAgentContextToken: vi.fn(async () => 'ctx-token'),
}))
vi.mock('@/lib/ai-platform/agent-tools/tool-actor', () => ({ resolveToolActor: vi.fn(async () => ({ user: { id: 3 }, tenantId: '4', organizationId: 'org_4', role: 'owner' })) }))

import { handleAgentProxy } from '@/lib/ai-platform/agent-proxy'
import { handleAgentTool } from '@/lib/ai-platform/agent-tools/handle-agent-tool'
import { GENERATED_DATA_MAX_CHARS, pictureTitle, saveGeneratedPicture } from '@/lib/ai-platform/generated-images'
import { isMediaRefAllowed } from '@/lib/ai-platform/media-access'

const ACTOR = { tenantId: '4' }
const PROMPT = 'Indigo batik scarf on a linen table. Soft window light, no text.'
const canvas = () => sharp({ create: { width: 64, height: 48, channels: 3, background: { r: 30, g: 40, b: 140 } } })
let WEBP: Buffer
let PNG: Buffer
let JPEG: Buffer
const picture = (bytes: Buffer, mediaType = 'image/webp') => ({ mediaType, data: bytes.toString('base64') })
const created = () => cms.create.mock.calls.map(([arg]) => arg)
const isWebp = (bytes: Buffer) => bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WEBP'

beforeEach(async () => {
    store.media.length = 0
    cms.create.mockClear()
    cms.findByID.mockClear()
    cms.find.mockClear()
    ;[WEBP, PNG, JPEG] = await Promise.all([canvas().webp().toBuffer(), canvas().png().toBuffer(), canvas().jpeg().toBuffer()])
})

describe('keeping a drawn picture [TC-AIREL-200]', () => {
    it('stores WebP as it came, owned by the workspace, marked AI-generated with its prompt, and names it media:<id>', async () => {
        const saved = await saveGeneratedPicture(cms as never, ACTOR, picture(WEBP), PROMPT)

        const [arg] = created()
        expect(arg?.collection).toBe('media')
        expect(arg?.data).toEqual({
            alt: 'Indigo batik scarf on a linen table',
            aiGenerated: true,
            aiPrompt: PROMPT,
            sourceProvider: 'ai',
            tenant: 4,
        })
        expect(arg?.file).toMatchObject({ mimetype: 'image/webp', name: 'indigo-batik-scarf-on-a-linen-table.webp', size: WEBP.length })
        expect(arg?.file.data.equals(WEBP)).toBe(true)
        expect(saved).toEqual({ assetId: '900', ref: 'media:900', url: '/api/media/file/indigo-batik-scarf-on-a-linen-table.webp', name: 'Indigo batik scarf on a linen table' })
    })

    it('converts PNG and JPEG to WebP and checks what the bytes are, not what the type says', async () => {
        await saveGeneratedPicture(cms as never, ACTOR, picture(PNG, 'image/png'), PROMPT)
        await saveGeneratedPicture(cms as never, ACTOR, picture(JPEG, 'image/webp'), PROMPT)

        for (const arg of created()) {
            expect(arg.file.mimetype).toBe('image/webp')
            expect(isWebp(arg.file.data)).toBe(true)
        }
    })

    it('refuses bytes that are not a picture, empty data and an oversized picture, creating nothing', async () => {
        await expect(saveGeneratedPicture(cms as never, ACTOR, picture(Buffer.from('<svg onload=alert(1)>'), 'image/webp'), PROMPT)).rejects.toMatchObject({ status: 422 })
        await expect(saveGeneratedPicture(cms as never, ACTOR, { mediaType: 'image/webp', data: '' }, PROMPT)).rejects.toMatchObject({ status: 422 })
        await expect(saveGeneratedPicture(cms as never, ACTOR, { mediaType: 'image/webp', data: 'A'.repeat(GENERATED_DATA_MAX_CHARS + 1) }, PROMPT)).rejects.toMatchObject({ status: 413 })
        expect(cms.create).not.toHaveBeenCalled()
    })

    it('titles the picture from the prompt: first sentence, 80 characters at most, never empty', () => {
        expect(pictureTitle(PROMPT)).toBe('Indigo batik scarf on a linen table')
        expect(pictureTitle('x'.repeat(200))).toHaveLength(80)
        expect(pictureTitle('  ;  ')).toBe('Generated picture')
    })
})

describe('media.save_generated through the facade [TC-AIREL-201]', () => {
    const save = (body: unknown) => handleAgentTool(new Request('http://localhost:3000/api/agent-tools/media.save_generated', { method: 'POST', body: JSON.stringify(body) }), 'media.save_generated')

    it('keeps the picture and answers what ai-platform\'s SavedPicture needs; the ref is then usable by that workspace only', async () => {
        const res = await save({ prompt: PROMPT, picture: { ...picture(WEBP), revisedPrompt: 'A scarf' } })

        expect(res.status).toBe(200)
        expect(await res.json()).toEqual({ assetId: '900', ref: 'media:900', url: '/api/media/file/indigo-batik-scarf-on-a-linen-table.webp', name: 'Indigo batik scarf on a linen table' })
        expect(await isMediaRefAllowed(cms as never, '4', 'media:900')).toBe(true)
        expect(await isMediaRefAllowed(cms as never, '5', 'media:900')).toBe(false)
    })

    it('answers a picture it cannot read with 422 and its message, and creates nothing', async () => {
        const res = await save({ prompt: PROMPT, picture: picture(Buffer.from('not a picture')) })

        expect(res.status).toBe(422)
        expect(await res.json()).toMatchObject({ detail: 'The generated picture could not be read.' })
        expect(cms.create).not.toHaveBeenCalled()
    })

    it('refuses a malformed call (400) before touching the database', async () => {
        expect((await save({ prompt: '', picture: picture(WEBP) })).status).toBe(400)
        expect((await save({ prompt: PROMPT })).status).toBe(400)
        expect(cms.create).not.toHaveBeenCalled()
    })
})

describe('POST /api/agent/media/generate [TC-AIREL-202]', () => {
    const fetchMock = vi.fn()
    const generate = (body: unknown) =>
        handleAgentProxy(
            new NextRequest('http://localhost:3000/api/agent/media/generate', { method: 'POST', headers: { host: 'localhost:3000', 'content-type': 'application/json' }, body: JSON.stringify(body) }),
            ['media', 'generate'],
        )
    const platform = (status: number, body: unknown) => fetchMock.mockResolvedValueOnce(typeof body === 'string' ? new Response(body, { status }) : Response.json(body, { status }))

    beforeEach(() => {
        fetchMock.mockReset()
        vi.stubGlobal('fetch', fetchMock)
    })

    it('draws one picture, keeps it in the shop\'s library and answers its media: ref (a small body)', async () => {
        platform(200, { images: [picture(WEBP)] })

        const res = await generate({ prompt: PROMPT, aspect: 'landscape' })

        expect(res.status).toBe(200)
        const body = await res.json()
        expect(body).toEqual({ assets: [{ id: '900', ref: 'media:900', url: '/api/media/file/indigo-batik-scarf-on-a-linen-table.webp', name: 'Indigo batik scarf on a linen table' }] })
        expect(JSON.stringify(body).length).toBeLessThan(1000)
        const [url, init] = fetchMock.mock.calls[0]!
        expect(String(url)).toBe('http://ai-platform.test/v1/images')
        expect(init.headers.authorization).toBe('Bearer ctx-token')
        expect(JSON.parse(init.body)).toEqual({ prompt: PROMPT, aspect: 'landscape', count: 1 })
        expect(created()[0]?.data).toMatchObject({ tenant: 4, aiGenerated: true, aiPrompt: PROMPT })
    })

    it('asks for one picture whatever the caller asks for, and keeps only the first it gets back', async () => {
        platform(200, { images: [picture(WEBP), picture(PNG, 'image/png')] })

        const res = await generate({ prompt: PROMPT, count: 2 })

        expect(JSON.parse(fetchMock.mock.calls[0]![1].body)).toMatchObject({ count: 1, aspect: 'square' })
        expect((await res.json()).assets).toHaveLength(1)
        expect(cms.create).toHaveBeenCalledTimes(1)
    })

    it('passes the platform\'s daily-limit and not-set-up messages through as written', async () => {
        platform(429, { title: 'Picture failed', status: 429, detail: "Your workspace reached today's picture limit. Try again tomorrow." })
        platform(503, { title: 'Picture failed', status: 503, detail: 'Picture generation is not set up in this environment.' })

        const limit = await generate({ prompt: PROMPT })
        const off = await generate({ prompt: PROMPT })

        expect(limit.status).toBe(429)
        expect(await limit.json()).toMatchObject({ detail: "Your workspace reached today's picture limit. Try again tomorrow." })
        expect(off.status).toBe(503)
        expect(await off.json()).toMatchObject({ detail: 'Picture generation is not set up in this environment.' })
        expect(cms.create).not.toHaveBeenCalled()
    })

    it('says what a timeout or an oversized answer from the platform in front of ai-platform means', async () => {
        platform(504, 'An error occurred with your deployment')
        platform(413, 'Request Entity Too Large')

        const slow = await generate({ prompt: PROMPT })
        const big = await generate({ prompt: PROMPT })

        expect(slow.status).toBe(504)
        expect(await slow.json()).toMatchObject({ detail: 'The picture took too long. Try again.' })
        expect(big.status).toBe(413)
        expect(await big.json()).toMatchObject({ detail: 'The picture is too large to keep. Try again.' })
    })

    it('refuses a missing prompt (400) without calling the platform, and an empty or unreadable answer without creating a row', async () => {
        expect((await generate({ prompt: 'x' })).status).toBe(400)
        expect((await generate({ aspect: 'square' })).status).toBe(400)
        expect(fetchMock).not.toHaveBeenCalled()

        platform(200, { images: [] })
        platform(200, { images: [picture(Buffer.from('not a picture'))] })
        expect((await generate({ prompt: PROMPT })).status).toBe(502)
        expect((await generate({ prompt: PROMPT })).status).toBe(422)
        expect(cms.create).not.toHaveBeenCalled()
    })
})

describe('bodies stay under Vercel\'s 4.5 MB [TC-AIREL-203]', () => {
    it('allows a picture as base64 only up to a size that fits one request with its prompt around it', () => {
        const VERCEL_BODY_LIMIT = 4.5 * 1024 * 1024
        expect(GENERATED_DATA_MAX_CHARS + 2000 /* prompt, revised prompt, JSON */ + 1000).toBeLessThan(VERCEL_BODY_LIMIT)
    })

    it('refuses a bigger picture at the facade (400) and stores nothing', async () => {
        const res = await handleAgentTool(
            new Request('http://localhost:3000/api/agent-tools/media.save_generated', {
                method: 'POST',
                body: JSON.stringify({ prompt: PROMPT, picture: { mediaType: 'image/webp', data: 'A'.repeat(GENERATED_DATA_MAX_CHARS + 1) } }),
            }),
            'media.save_generated',
        )

        expect(res.status).toBe(400)
        expect(cms.create).not.toHaveBeenCalled()
    })
})
