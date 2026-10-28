/**
 * TC-AIWB-86 — url-scraper checks ALL resolved addresses (v4 + v6), not just the first one.
 * TC-AIWB-87 — the connection is pinned to the vetted addresses: the socket never re-resolves the
 *              hostname, so a rebinding DNS answer after the check cannot reach an internal host.
 * Real: url-scraper.ts, undici Agent, global fetch, a local HTTP server. Faked: DNS (dns/promises).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import http from 'node:http'
import type { AddressInfo } from 'node:net'

const { mockLookup } = vi.hoisted(() => ({ mockLookup: vi.fn() }))

vi.mock('dns/promises', () => ({
    default: { lookup: (...args: unknown[]) => mockLookup(...args) },
    lookup: (...args: unknown[]) => mockLookup(...args),
}))
vi.mock('open-graph-scraper', () => ({ default: vi.fn().mockResolvedValue({ result: {} }) }))

import { createPinnedAgent, resolvePublicAddresses, resolveAndValidate, fetchWithSafeguards } from '@/lib/ai/url-scraper'

beforeEach(() => {
    mockLookup.mockReset()
})

describe('url-scraper multi-address validation [TC-AIWB-86]', () => {
    it('asks DNS for every address, not only the first', async () => {
        mockLookup.mockResolvedValue([{ address: '93.184.216.34', family: 4 }])
        await resolvePublicAddresses('shop.example')
        expect(mockLookup).toHaveBeenCalledWith('shop.example', { all: true })
    })

    it.each([
        ['private v4 behind a public v4', [{ address: '93.184.216.34', family: 4 }, { address: '10.0.0.5', family: 4 }]],
        ['loopback v4 as the second record', [{ address: '8.8.8.8', family: 4 }, { address: '127.0.0.1', family: 4 }]],
        ['unique-local v6 behind a public v4', [{ address: '93.184.216.34', family: 4 }, { address: 'fd00::1', family: 6 }]],
        ['link-local v6 first', [{ address: 'fe80::1', family: 6 }, { address: '93.184.216.34', family: 4 }]],
        ['IPv4-mapped v6 of a private address', [{ address: '93.184.216.34', family: 4 }, { address: '::ffff:10.0.0.1', family: 6 }]],
        ['cloud metadata address', [{ address: '93.184.216.34', family: 4 }, { address: '169.254.169.254', family: 4 }]],
    ])('rejects a host with %s', async (_label, records) => {
        mockLookup.mockResolvedValue(records)
        await expect(resolveAndValidate('rebind.example')).rejects.toThrow('URL resolves to a blocked IP range')
    })

    it('accepts a host whose every address is public and returns them all', async () => {
        const records = [{ address: '93.184.216.34', family: 4 }, { address: '2606:2800:220:1:248:1893:25c8:1946', family: 6 }]
        mockLookup.mockResolvedValue(records)
        await expect(resolvePublicAddresses('shop.example')).resolves.toEqual(records)
    })

    it('fails closed on an empty answer and on a lookup error', async () => {
        mockLookup.mockResolvedValueOnce([])
        await expect(resolvePublicAddresses('empty.example')).rejects.toThrow('Could not resolve hostname')
        mockLookup.mockRejectedValueOnce(new Error('ENOTFOUND'))
        await expect(resolvePublicAddresses('gone.example')).rejects.toThrow('Could not resolve hostname')
    })

    it('does not send a request when any address of the first hop is internal', async () => {
        const fetchMock = vi.fn()
        vi.stubGlobal('fetch', fetchMock)
        mockLookup.mockResolvedValue([{ address: '93.184.216.34', family: 4 }, { address: '192.168.1.10', family: 4 }])
        try {
            await expect(fetchWithSafeguards(new URL('https://rebind.example/'))).rejects.toThrow('blocked IP range')
            expect(fetchMock).not.toHaveBeenCalled()
        } finally {
            vi.unstubAllGlobals()
        }
    })
})

describe('url-scraper pinned connection [TC-AIWB-87]', () => {
    let server: http.Server
    let port: number

    beforeEach(async () => {
        server = http.createServer((req, res) => {
            res.writeHead(200, { 'content-type': 'text/html' })
            res.end(`<html><body>host=${req.headers.host}</body></html>`)
        })
        await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
        port = (server.address() as AddressInfo).port
    })

    afterEach(async () => {
        await new Promise<void>((resolve) => server.close(() => resolve()))
    })

    it('connects to the vetted address and never calls the system resolver for the hostname', async () => {
        // "pinned.invalid" can only be reached through the pinned lookup; a real resolve would ENOTFOUND.
        const agent = createPinnedAgent([{ address: '127.0.0.1', family: 4 }])
        try {
            const res = await fetch(`http://pinned.invalid:${port}/`, { dispatcher: agent } as RequestInit)
            expect(await res.text()).toContain(`host=pinned.invalid:${port}`)
        } finally {
            await agent.close()
        }
    })

    it('does a second lookup per redirect hop and pins each hop independently', async () => {
        const fetchMock = vi.fn()
            .mockResolvedValueOnce(new Response(null, { status: 302, headers: { location: 'https://second.example/' } }))
            .mockResolvedValueOnce(new Response('<html><body>ok</body></html>', { status: 200, headers: { 'content-type': 'text/html' } }))
        vi.stubGlobal('fetch', fetchMock)
        mockLookup.mockImplementation(async (host: string) =>
            host === 'first.example' ? [{ address: '93.184.216.34', family: 4 }] : [{ address: '8.8.8.8', family: 4 }])
        try {
            await fetchWithSafeguards(new URL('https://first.example/'))
            expect(mockLookup.mock.calls.map((c) => c[0])).toEqual(['first.example', 'second.example'])
            const dispatchers = fetchMock.mock.calls.map((c) => (c[1] as { dispatcher?: unknown }).dispatcher)
            expect(dispatchers[0]).toBeDefined()
            expect(dispatchers[1]).toBeDefined()
            expect(dispatchers[0]).not.toBe(dispatchers[1])
        } finally {
            vi.unstubAllGlobals()
        }
    })
})
