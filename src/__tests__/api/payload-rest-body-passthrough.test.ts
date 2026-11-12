/**
 * TC-F15.26 — the Payload REST catch-all (src/app/(payload)/api/[...slug]/route.ts) converts
 * multipart `_payload` bodies to JSON, and must hand every other body to Payload unread.
 * Payload's admin sends long list/relationship queries as POST + X-Payload-HTTP-Method-Override: GET
 * with a urlencoded body; reading it in the wrapper left Payload with "Body has already been read" (500).
 */
import { describe, expect, it, vi } from 'vitest'

vi.mock('@payload-config', () => ({ default: {} }))

vi.mock('@payloadcms/next/routes', () => {
    const echo = () => async (req: Request) =>
        Response.json({
            method: req.method,
            contentType: req.headers.get('content-type'),
            override: req.headers.get('x-payload-http-method-override'),
            body: await req.text(),
        })
    return { REST_GET: echo, REST_DELETE: echo, REST_POST: echo, REST_PATCH: echo }
})

import { NextRequest } from 'next/server'
import { POST } from '@/app/(payload)/api/[...slug]/route'

const args = { params: Promise.resolve({ slug: ['pages'] }) }

describe('Payload REST catch-all body handling [TC-F15.26]', () => {
    it('passes a method-override urlencoded query to Payload with its body intact', async () => {
        const req = new NextRequest('http://localhost/api/pages', {
            method: 'POST',
            headers: {
                'content-type': 'application/x-www-form-urlencoded',
                'x-payload-http-method-override': 'GET',
            },
            body: 'depth=0&limit=1&where[title][like]=home',
        })

        const res = await POST(req, args)

        expect(res.status).toBe(200)
        expect(await res.json()).toEqual({
            method: 'POST',
            contentType: 'application/x-www-form-urlencoded',
            override: 'GET',
            body: 'depth=0&limit=1&where[title][like]=home',
        })
    })

    it('still turns a multipart _payload body without files into JSON', async () => {
        const form = new FormData()
        form.set('_payload', JSON.stringify({ title: 'Home' }))
        const req = new NextRequest('http://localhost/api/pages', { method: 'POST', body: form })

        const res = await POST(req, args)
        const seen = await res.json()

        expect(seen.contentType).toBe('application/json')
        expect(JSON.parse(seen.body)).toEqual({ title: 'Home' })
    })
})
