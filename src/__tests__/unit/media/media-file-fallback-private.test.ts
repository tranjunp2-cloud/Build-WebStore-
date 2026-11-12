/**
 * TC-PERF-172 — `/api/media/file/<name>` fallback handler: a private file (payment receipt) that Payload's read
 * access let through is served `private, no-store` + `nosniff` from local disk (was `public, max-age=31536000,
 * immutable`), and redirected to the member-checked `/api/media/private/{id}` route instead of its public storage
 * URL. Public files keep the long public cache and the storage redirect.
 * Real: the Media collection's upload handler. Faked: `req.payload.find`; the local file lives in a temp media dir.
 */
import { mkdirSync, rmSync, writeFileSync } from 'fs'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { Media } from '@/collections/Media'

const DIR = '/tmp/media' // the handler's staticDir when VERCEL=1
const LOCAL = 'tc-perf-172-local.jpg'
const env = { VERCEL: process.env.VERCEL, S3_BUCKET: process.env.S3_BUCKET, S3_ENDPOINT: process.env.S3_ENDPOINT }
const find = vi.fn()
const handler = (Media.upload as { handlers: Array<(req: unknown) => Promise<Response>> }).handlers[0]!
const open = (filename: string) => handler({ routeParams: { filename }, payload: { find } })

beforeAll(() => {
    process.env.VERCEL = '1'
    process.env.S3_BUCKET = 'media-bucket'
    process.env.S3_ENDPOINT = 'https://s3.test'
    mkdirSync(DIR, { recursive: true })
    writeFileSync(`${DIR}/${LOCAL}`, Buffer.from([0xff, 0xd8, 0xff, 0xe0]))
})

afterAll(() => {
    rmSync(`${DIR}/${LOCAL}`, { force: true })
    for (const [key, value] of Object.entries(env)) {
        if (value === undefined) delete process.env[key]
        else process.env[key] = value
    }
})

beforeEach(() => {
    find.mockReset().mockResolvedValue({ docs: [] })
})

describe('/api/media/file fallback for private files [TC-PERF-172]', () => {
    it('serves a private local file uncacheable and nosniff', async () => {
        // Arrange
        find.mockResolvedValue({ docs: [{ id: 31 }] })

        // Act
        const res = await open(LOCAL)

        // Assert
        expect(res.status).toBe(200)
        expect(res.headers.get('cache-control')).toBe('private, no-store')
        expect(res.headers.get('x-content-type-options')).toBe('nosniff')
        expect(find).toHaveBeenCalledWith(expect.objectContaining({
            collection: 'media',
            where: { and: [{ filename: { equals: LOCAL } }, { private: { equals: true } }] },
        }))
    })

    it('keeps the long public cache for a public local file', async () => {
        const res = await open(LOCAL)

        expect(res.headers.get('cache-control')).toBe('public, max-age=31536000, immutable')
    })

    it('serves the local file uncacheable when the lookup fails', async () => {
        find.mockRejectedValue(new Error('db down'))

        const res = await open(LOCAL)

        expect(res.headers.get('cache-control')).toBe('private, no-store')
    })

    it('sends a private file in storage to the member-checked route, never its bucket URL', async () => {
        // Arrange
        find.mockResolvedValue({ docs: [{ id: 31 }] })

        // Act
        const res = await open('payment-proof-abc.jpg')

        // Assert
        expect(res.status).toBe(302)
        expect(res.headers.get('location')).toBe('/api/media/private/31')
        expect(res.headers.get('cache-control')).toBe('private, no-store')
    })

    it('still redirects a public file in storage to its bucket URL', async () => {
        const res = await open('hero.jpg')

        expect(res.status).toBe(302)
        expect(res.headers.get('location')).toBe('https://s3.test/media-bucket/hero.jpg')
    })
})
