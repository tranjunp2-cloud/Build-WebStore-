/**
 * TC-AISEC-09 — url-scraper follows redirects by hand: every hop is validated (protocol, port,
 * credentials, resolved address) BEFORE it is requested. A hop that fails validation must stop the
 * scrape before the second fetch; more than MAX_REDIRECTS hops fail with "Too many redirects".
 * Real: url-scraper.ts. Faked: DNS (dns/promises) and the network (fetch).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const { mockLookup } = vi.hoisted(() => ({ mockLookup: vi.fn() }))

vi.mock('dns/promises', () => ({
    default: { lookup: (...args: unknown[]) => mockLookup(...args) },
    lookup: (...args: unknown[]) => mockLookup(...args),
}))
vi.mock('open-graph-scraper', () => ({ default: vi.fn().mockResolvedValue({ result: {} }) }))

import { fetchWithSafeguards } from '@/lib/ai/url-scraper'

const fetchMock = vi.fn()

// Hostname → resolved address. Anything not listed resolves to a public address.
const RESOLVES_TO: Record<string, string> = {
    '127.0.0.1': '127.0.0.1',
    'internal.example': '10.0.0.5',
    '[::ffff:a00:1]': '::ffff:10.0.0.1',
}

const redirect = (location: string) => new Response(null, { status: 302, headers: { location } })
const page = () => new Response('<html><body>Kedai Kopi</body></html>', { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } })
const START = new URL('https://kedai-kopi.example/')

beforeEach(() => {
    fetchMock.mockReset()
    mockLookup.mockReset().mockImplementation(async (hostname: string) => ({ address: RESOLVES_TO[hostname] ?? '93.184.216.34', family: 4 }))
    vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
    vi.unstubAllGlobals()
})

describe('url-scraper redirect validation [TC-AISEC-09]', () => {
    it('refuses a 302 to 127.0.0.1 before requesting it', async () => {
        fetchMock.mockResolvedValueOnce(redirect('http://127.0.0.1/admin'))

        await expect(fetchWithSafeguards(START)).rejects.toThrow('URL resolves to a blocked IP range')
        expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    it('refuses a 302 to a non-standard port before requesting it', async () => {
        fetchMock.mockResolvedValueOnce(redirect('http://example.com:9001/'))

        await expect(fetchWithSafeguards(START)).rejects.toThrow('Non-standard ports are not allowed')
        expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    it('refuses a 302 to an IPv4-mapped private IPv6 address before requesting it', async () => {
        fetchMock.mockResolvedValueOnce(redirect('http://[::ffff:10.0.0.1]/'))

        await expect(fetchWithSafeguards(START)).rejects.toThrow('URL resolves to a blocked IP range')
        expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    it('refuses a 302 to a name that resolves to a private address before requesting it', async () => {
        fetchMock.mockResolvedValueOnce(redirect('https://internal.example/'))

        await expect(fetchWithSafeguards(START)).rejects.toThrow('URL resolves to a blocked IP range')
        expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    it.each([
        ['100.64.0.1', 'carrier-grade NAT 100.64/10'],
        ['::', 'unspecified IPv6'],
        ['fd00::1', 'unique-local fc00::/7'],
        ['fe80::1', 'link-local fe80::/10'],
    ])('refuses a redirect that resolves to %s (%s) before requesting it', async (address) => {
        // hop 0 (START) is vetted too now, so key the blocked answer on the redirect target only
        mockLookup.mockImplementation(async (hostname: string) =>
            hostname === 'hop.example'
                ? { address, family: address.includes(':') ? 6 : 4 }
                : { address: '93.184.216.34', family: 4 })
        fetchMock.mockResolvedValueOnce(redirect('https://hop.example/'))

        await expect(fetchWithSafeguards(START)).rejects.toThrow('URL resolves to a blocked IP range')
        expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    it('refuses a 302 to a non-http scheme before requesting it', async () => {
        fetchMock.mockResolvedValueOnce(redirect('file:///etc/passwd'))

        await expect(fetchWithSafeguards(START)).rejects.toThrow('Invalid protocol')
        expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    it('refuses a 302 that carries credentials before requesting it', async () => {
        fetchMock.mockResolvedValueOnce(redirect('https://user:secret@kedai-kopi.example/'))

        await expect(fetchWithSafeguards(START)).rejects.toThrow('Credentials in URL are not allowed')
        expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    it('stops with "Too many redirects" after three hops', async () => {
        fetchMock
            .mockResolvedValueOnce(redirect('https://kedai-kopi.example/1'))
            .mockResolvedValueOnce(redirect('https://kedai-kopi.example/2'))
            .mockResolvedValueOnce(redirect('https://kedai-kopi.example/3'))
            .mockResolvedValueOnce(redirect('https://kedai-kopi.example/4'))

        await expect(fetchWithSafeguards(START)).rejects.toThrow('Too many redirects')
        expect(fetchMock).toHaveBeenCalledTimes(4)
    })

    it('follows a safe redirect manually and returns the page it lands on', async () => {
        fetchMock
            .mockResolvedValueOnce(redirect('https://kedai-kopi.example/home'))
            .mockResolvedValueOnce(page())

        const html = await fetchWithSafeguards(START)

        expect(html).toContain('Kedai Kopi')
        expect(fetchMock).toHaveBeenCalledTimes(2)
        expect(fetchMock.mock.calls[1]![0]).toBe('https://kedai-kopi.example/home')
        for (const call of fetchMock.mock.calls) {
            expect((call[1] as RequestInit).redirect).toBe('manual')
        }
    })
})
