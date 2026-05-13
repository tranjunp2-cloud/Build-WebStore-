import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { checkDnsRouting, checkHttpsConnectivity } from '@/lib/vercel/dns-check'

/**
 * Tests for checkDnsRouting — DNS routing check via Cloudflare DoH.
 *
 * TC-F19.11: DNS chưa trỏ → Verify → giữ Pending
 * TC-F19.12: DNS đúng Vercel → Verify → Connected
 * TC-F19.16: DNS trỏ sai IP → Verify thất bại
 * TC-F19.17: DNS sai → sửa lại → Verify lần 2 thành công
 */

const VERCEL_IP = '76.76.21.21'
const VERCEL_CNAME = 'cname.vercel-dns.com'

// Build a minimal DoH JSON response
function dohResponse(answers: string[], type: 'A' | 'CNAME' = 'A') {
    return {
        Status: answers.length ? 0 : 3,
        Answer: answers.map(data => ({
            name: 'example.com.',
            type: type === 'A' ? 1 : 5,
            TTL: 300,
            data,
        })),
    }
}

function mockFetch(...responses: unknown[]) {
    const mock = vi.fn()
    for (const body of responses) {
        mock.mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: async () => body,
        } as unknown as Response)
    }
    vi.stubGlobal('fetch', mock)
    return mock
}

beforeEach(() => {
    process.env.VERCEL_APEX_A_RECORD = VERCEL_IP
    process.env.VERCEL_CNAME_TARGET = VERCEL_CNAME
})

afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    delete process.env.VERCEL_APEX_A_RECORD
    delete process.env.VERCEL_CNAME_TARGET
})

// ── Apex domain ───────────────────────────────────────────────────────────────

describe('[TC-F19.12] Apex domain — A record points to Vercel IP', () => {
    it('returns ok:true when A record matches VERCEL_APEX_A_RECORD', async () => {
        mockFetch(dohResponse([VERCEL_IP], 'A'))

        const result = await checkDnsRouting('example.com', true)

        expect(result.ok).toBe(true)
        expect(result.message).toBeUndefined()
    })

    it('returns ok:true for any IP in comma-separated VERCEL_APEX_A_RECORD', async () => {
        process.env.VERCEL_APEX_A_RECORD = '76.76.21.21,76.76.21.22'
        mockFetch(dohResponse(['76.76.21.22'], 'A'))

        const result = await checkDnsRouting('example.com', true)

        expect(result.ok).toBe(true)
    })
})

describe('[TC-F19.16] Apex domain — A record wrong', () => {
    it('returns ok:false with expected vs actual when A record is wrong IP', async () => {
        mockFetch(dohResponse(['1.2.3.4'], 'A'))

        const result = await checkDnsRouting('example.com', true)

        expect(result.ok).toBe(false)
        expect(result.message).toContain(VERCEL_IP)
        expect(result.message).toContain('1.2.3.4')
    })
})

describe('[TC-F19.11] Apex domain — no DNS records', () => {
    it('returns ok:false with "currently: none" when no A record exists', async () => {
        mockFetch(dohResponse([], 'A'))

        const result = await checkDnsRouting('example.com', true)

        expect(result.ok).toBe(false)
        expect(result.message).toContain('none')
    })
})

// ── Subdomain — CNAME path ────────────────────────────────────────────────────

describe('[TC-F19.12] Subdomain — CNAME points to Vercel', () => {
    it('returns ok:true when CNAME matches VERCEL_CNAME_TARGET', async () => {
        // First call: CNAME query
        mockFetch(dohResponse([VERCEL_CNAME], 'CNAME'))

        const result = await checkDnsRouting('shop.example.com', false)

        expect(result.ok).toBe(true)
    })

    it('normalizes trailing dot in CNAME answer', async () => {
        mockFetch(dohResponse([`${VERCEL_CNAME}.`], 'CNAME'))

        const result = await checkDnsRouting('shop.example.com', false)

        expect(result.ok).toBe(true)
    })

    it('normalizes uppercase CNAME answer', async () => {
        mockFetch(dohResponse([VERCEL_CNAME.toUpperCase()], 'CNAME'))

        const result = await checkDnsRouting('shop.example.com', false)

        expect(result.ok).toBe(true)
    })
})

describe('[TC-F19.12] Subdomain — A record fallback (registrar no CNAME support)', () => {
    it('returns ok:true via A record fallback when CNAME is absent but A record = Vercel IP', async () => {
        // First call: CNAME → empty; Second call: A → Vercel IP
        mockFetch(
            dohResponse([], 'CNAME'),
            dohResponse([VERCEL_IP], 'A'),
        )

        const result = await checkDnsRouting('shop.example.com', false)

        expect(result.ok).toBe(true)
    })
})

describe('[TC-F19.16] Subdomain — DNS wrong', () => {
    it('returns ok:false when CNAME wrong and A record also wrong', async () => {
        mockFetch(
            dohResponse(['cdn.other-provider.com'], 'CNAME'),
            dohResponse(['1.2.3.4'], 'A'),
        )

        const result = await checkDnsRouting('shop.example.com', false)

        expect(result.ok).toBe(false)
        expect(result.message).toContain(VERCEL_CNAME)
    })
})

describe('[TC-F19.11] Subdomain — no DNS records', () => {
    it('returns ok:false with "currently: none" when no CNAME and no A record', async () => {
        mockFetch(
            dohResponse([], 'CNAME'),
            dohResponse([], 'A'),
        )

        const result = await checkDnsRouting('shop.example.com', false)

        expect(result.ok).toBe(false)
        expect(result.message).toContain('none')
    })
})

// ── Error handling ────────────────────────────────────────────────────────────

describe('DoH error handling', () => {
    it('returns ok:false with timeout message when fetch aborts', async () => {
        vi.stubGlobal('fetch', vi.fn().mockRejectedValueOnce(
            Object.assign(new Error('The operation was aborted.'), { name: 'AbortError' }),
        ))

        const result = await checkDnsRouting('example.com', true)

        expect(result.ok).toBe(false)
        expect(result.message).toContain('timed out')
    })

    it('returns ok:false with generic message when DoH returns HTTP 500', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({
            ok: false,
            status: 500,
            json: async () => ({}),
        } as unknown as Response))

        const result = await checkDnsRouting('example.com', true)

        expect(result.ok).toBe(false)
        expect(result.message).toContain('failed')
    })

    it('returns ok:false with generic message on network error', async () => {
        vi.stubGlobal('fetch', vi.fn().mockRejectedValueOnce(new Error('ECONNREFUSED')))

        const result = await checkDnsRouting('example.com', true)

        expect(result.ok).toBe(false)
        expect(result.message).toContain('failed')
    })
})

// ── checkHttpsConnectivity ────────────────────────────────────────────────────

describe('[TC-F19.12] HTTPS probe — domain responds → ok', () => {
    it('returns ok:true when domain responds with 200', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({ ok: true, status: 200 } as Response))

        const result = await checkHttpsConnectivity('example.com')

        expect(result.ok).toBe(true)
    })

    it('returns ok:true even for 4xx (any HTTP response = SSL provisioned + domain live)', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({ ok: false, status: 404 } as Response))

        const result = await checkHttpsConnectivity('example.com')

        expect(result.ok).toBe(true)
    })

    it('returns ok:true for 3xx redirect (redirect:manual does not throw — TLS handshake completed)', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({ ok: false, status: 301 } as Response))

        const result = await checkHttpsConnectivity('example.com')

        expect(result.ok).toBe(true)
    })
})

describe('[TC-F19.13] HTTPS probe — SSL provisioning in progress', () => {
    it('returns ok:false with SSL message when fetch throws SSL certificate error', async () => {
        vi.stubGlobal('fetch', vi.fn().mockRejectedValueOnce(new Error('unable to verify the first certificate')))

        const result = await checkHttpsConnectivity('example.com')

        expect(result.ok).toBe(false)
        expect(result.message).toContain('SSL')
    })

    it('returns ok:false with SSL message when error cause contains CERT code', async () => {
        const err = Object.assign(new Error('fetch failed'), { cause: new Error('CERT_UNTRUSTED') })
        vi.stubGlobal('fetch', vi.fn().mockRejectedValueOnce(err))

        const result = await checkHttpsConnectivity('example.com')

        expect(result.ok).toBe(false)
        expect(result.message).toContain('SSL')
    })
})

describe('[TC-F19.12] HTTPS probe — domain not yet accessible', () => {
    it('returns ok:false with timed out message on AbortError', async () => {
        vi.stubGlobal('fetch', vi.fn().mockRejectedValueOnce(
            Object.assign(new Error('The operation was aborted.'), { name: 'AbortError' }),
        ))

        const result = await checkHttpsConnectivity('example.com')

        expect(result.ok).toBe(false)
        expect(result.message).toContain('timed out')
    })

    it('returns ok:false with accessible message on connection error', async () => {
        vi.stubGlobal('fetch', vi.fn().mockRejectedValueOnce(new Error('ECONNREFUSED')))

        const result = await checkHttpsConnectivity('example.com')

        expect(result.ok).toBe(false)
        expect(result.message).toContain('accessible')
    })
})

// ── [TC-F19.17] Retry scenario ────────────────────────────────────────────────

describe('[TC-F19.17] DNS sai → sửa → Verify lần 2 pass', () => {
    it('first call fails (wrong IP), second call succeeds (correct IP)', async () => {
        // Simulate two separate verify attempts
        const fetchMock = vi.fn()
            .mockResolvedValueOnce({ ok: true, status: 200, json: async () => dohResponse(['1.2.3.4'], 'A') } as unknown as Response)
            .mockResolvedValueOnce({ ok: true, status: 200, json: async () => dohResponse([VERCEL_IP], 'A') } as unknown as Response)
        vi.stubGlobal('fetch', fetchMock)

        const first = await checkDnsRouting('example.com', true)
        const second = await checkDnsRouting('example.com', true)

        expect(first.ok).toBe(false)
        expect(second.ok).toBe(true)
    })
})
