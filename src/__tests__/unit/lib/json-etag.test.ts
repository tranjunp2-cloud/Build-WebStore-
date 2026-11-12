/**
 * TC-PERF-080 — conditional GET helper shared by the polled / reloaded dashboard reads
 * (notifications, orders list + metrics, discounts list).
 */
import { describe, expect, it } from 'vitest'
import { etagMatches, jsonEtag, jsonWithEtag } from '@/lib/api/json-etag'

const get = (headers: Record<string, string> = {}) => new Request('http://localhost/api/x', { headers })

describe('jsonWithEtag [TC-PERF-080]', () => {
    it('answers 200 with the JSON body, a weak ETag of it and private revalidation', async () => {
        // Act
        const res = jsonWithEtag({ a: 1 }, get())

        // Assert
        expect(res.status).toBe(200)
        expect(await res.json()).toEqual({ a: 1 })
        expect(res.headers.get('ETag')).toBe(jsonEtag('{"a":1}'))
        expect(res.headers.get('ETag')).toMatch(/^W\/"[A-Za-z0-9_-]+"$/)
        expect(res.headers.get('Cache-Control')).toBe('private, max-age=0')
        expect(res.headers.get('Content-Type')).toBe('application/json')
    })

    it('answers 304 with no body when If-None-Match names the same body (weak or strong form, in a list)', async () => {
        // Arrange
        const etag = jsonEtag(JSON.stringify({ a: 1 }))
        const strong = etag.replace(/^W\//, '')

        // Act
        const weak = jsonWithEtag({ a: 1 }, get({ 'if-none-match': etag }))
        const listed = jsonWithEtag({ a: 1 }, get({ 'if-none-match': `W/"other", ${strong}` }))

        // Assert
        expect(weak.status).toBe(304)
        expect(await weak.text()).toBe('')
        expect(weak.headers.get('ETag')).toBe(etag)
        expect(listed.status).toBe(304)
    })

    it('answers 200 again once the body changed', () => {
        // Arrange
        const before = jsonEtag(JSON.stringify({ a: 1 }))

        // Act
        const res = jsonWithEtag({ a: 2 }, get({ 'if-none-match': before }))

        // Assert
        expect(res.status).toBe(200)
        expect(res.headers.get('ETag')).not.toBe(before)
    })

    it('matches `*` and nothing for a missing header', () => {
        // Assert
        expect(etagMatches('*', 'W/"x"')).toBe(true)
        expect(etagMatches(null, 'W/"x"')).toBe(false)
        expect(etagMatches('W/"y"', 'W/"x"')).toBe(false)
    })

    it('keeps a caller status and headers, ETag last', () => {
        // Act
        const res = jsonWithEtag({ ok: true }, get(), { status: 202, headers: { 'X-Test': '1', ETag: 'bogus' } })

        // Assert
        expect(res.status).toBe(202)
        expect(res.headers.get('X-Test')).toBe('1')
        expect(res.headers.get('ETag')).toBe(jsonEtag('{"ok":true}'))
    })
})
