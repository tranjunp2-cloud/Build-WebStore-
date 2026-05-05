import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
    addProjectDomain,
    assertVercelEnv,
    getProjectDomain,
    removeProjectDomain,
    verifyProjectDomain,
} from '@/lib/vercel/domains'
import { VercelDomain, VercelDomainsError } from '@/lib/vercel/domains.types'

/**
 * Tests for the Vercel Domains API wrapper.
 *
 * Uses `vi.stubGlobal('fetch', …)` to intercept HTTP calls — no real network.
 * Each test resets env + mocks in `beforeEach`/`afterEach` so ordering is safe.
 */

const TEAM_ID = 'team_test'
const PROJECT_ID = 'prj_test'
const TOKEN = 'test-token'

type FetchMock = ReturnType<typeof vi.fn>

function mockFetchOnce(response: {
    ok?: boolean
    status?: number
    statusText?: string
    body?: unknown | string
    headers?: Record<string, string>
}): FetchMock {
    const {
        ok = true,
        status = 200,
        statusText = 'OK',
        body = {},
        headers = {},
    } = response

    const text = typeof body === 'string' ? body : JSON.stringify(body)

    const headerMap = new Map<string, string>(
        Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]),
    )

    const fakeResponse: Partial<Response> = {
        ok,
        status,
        statusText,
        headers: {
            get: (name: string) => headerMap.get(name.toLowerCase()) ?? null,
        } as unknown as Headers,
        text: async () => text,
    }

    const fetchMock = vi.fn().mockResolvedValueOnce(fakeResponse as Response)
    vi.stubGlobal('fetch', fetchMock)
    return fetchMock
}

function makeDomain(overrides: Partial<VercelDomain> = {}): VercelDomain {
    return {
        name: 'example.com',
        apexName: 'example.com',
        projectId: PROJECT_ID,
        verified: true,
        createdAt: 1_700_000_000_000,
        updatedAt: 1_700_000_000_000,
        ...overrides,
    }
}

beforeEach(() => {
    process.env.VERCEL_TOKEN = TOKEN
    process.env.VERCEL_TEAM_ID = TEAM_ID
    process.env.VERCEL_PROJECT_ID = PROJECT_ID
})

afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    delete process.env.VERCEL_TOKEN
    delete process.env.VERCEL_TEAM_ID
    delete process.env.VERCEL_PROJECT_ID
})

describe('assertVercelEnv', () => {
    it('throws naming missing var when VERCEL_TOKEN absent', () => {
        delete process.env.VERCEL_TOKEN
        try {
            assertVercelEnv()
            throw new Error('expected assertVercelEnv to throw')
        } catch (err) {
            expect(err).toBeInstanceOf(VercelDomainsError)
            const e = err as VercelDomainsError
            expect(e.code).toBe('missing_env')
            expect(e.message).toContain('VERCEL_TOKEN')
        }
    })
})

describe('addProjectDomain', () => {
    it('happy path — returns verified:true domain', async () => {
        const fetchMock = mockFetchOnce({
            body: makeDomain({ verified: true }),
        })

        const result = await addProjectDomain('example.com')

        expect(result.verified).toBe(true)
        expect(result.name).toBe('example.com')
        expect(fetchMock).toHaveBeenCalledTimes(1)

        const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
        expect(url).toBe(
            `https://api.vercel.com/v10/projects/${PROJECT_ID}/domains?teamId=${TEAM_ID}`,
        )
        expect(init.method).toBe('POST')
        expect(init.body).toBe(JSON.stringify({ name: 'example.com', gitBranch: 'main' }))
        const headers = init.headers as Record<string, string>
        expect(headers.Authorization).toBe(`Bearer ${TOKEN}`)
        expect(headers['Content-Type']).toBe('application/json')
    })

    it('returns verification[] when verified=false (TXT challenge)', async () => {
        const fetchMock = mockFetchOnce({
            body: makeDomain({
                verified: false,
                verification: [
                    {
                        type: 'TXT',
                        domain: '_vercel.example.com',
                        value: 'vc-domain-verify=example.com,abc123',
                        reason: 'pending_domain_verification',
                    },
                ],
            }),
        })

        const result = await addProjectDomain('example.com')

        expect(result.verified).toBe(false)
        expect(result.verification).toHaveLength(1)
        expect(result.verification?.[0]?.type).toBe('TXT')
        expect(result.verification?.[0]?.domain).toBe('_vercel.example.com')
        expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    it('throws VercelDomainsError{status:409, code:domain_already_in_use} on 409', async () => {
        mockFetchOnce({
            ok: false,
            status: 409,
            statusText: 'Conflict',
            body: {
                error: {
                    code: 'domain_already_in_use',
                    message: 'The domain is already in use by another project',
                },
            },
        })

        try {
            await addProjectDomain('example.com')
            throw new Error('expected addProjectDomain to throw')
        } catch (err) {
            expect(err).toBeInstanceOf(VercelDomainsError)
            const e = err as VercelDomainsError
            expect(e.status).toBe(409)
            expect(e.code).toBe('domain_already_in_use')
            expect(e.message).toContain('already in use')
        }
    })
})

describe('verifyProjectDomain', () => {
    it('success — returns verified:true', async () => {
        mockFetchOnce({
            body: makeDomain({ verified: true }),
        })

        const result = await verifyProjectDomain('example.com')
        expect(result.verified).toBe(true)
    })

    it('throws on 400 missing_txt_record', async () => {
        mockFetchOnce({
            ok: false,
            status: 400,
            statusText: 'Bad Request',
            body: {
                error: {
                    code: 'missing_txt_record',
                    message: 'TXT record not found at _vercel.example.com',
                },
            },
        })

        try {
            await verifyProjectDomain('example.com')
            throw new Error('expected verifyProjectDomain to throw')
        } catch (err) {
            expect(err).toBeInstanceOf(VercelDomainsError)
            const e = err as VercelDomainsError
            expect(e.status).toBe(400)
            expect(e.code).toBe('missing_txt_record')
        }
    })
})

describe('getProjectDomain', () => {
    it('returns fresh verification array', async () => {
        const fetchMock = mockFetchOnce({
            body: makeDomain({
                verified: false,
                verification: [
                    {
                        type: 'TXT',
                        domain: '_vercel.example.com',
                        value: 'vc-domain-verify=example.com,def456',
                        reason: 'pending_domain_verification',
                    },
                ],
            }),
        })

        const result = await getProjectDomain('example.com')

        expect(result.verified).toBe(false)
        expect(result.verification).toHaveLength(1)
        expect(result.verification?.[0]?.value).toContain('def456')

        const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
        expect(url).toBe(
            `https://api.vercel.com/v9/projects/${PROJECT_ID}/domains/example.com?teamId=${TEAM_ID}`,
        )
        expect(init.method).toBe('GET')
    })
})

describe('removeProjectDomain', () => {
    it('calls DELETE with correct path + teamId query', async () => {
        const fetchMock = mockFetchOnce({ body: {} })

        await removeProjectDomain('example.com')

        expect(fetchMock).toHaveBeenCalledTimes(1)
        const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
        expect(url).toBe(
            `https://api.vercel.com/v9/projects/${PROJECT_ID}/domains/example.com?teamId=${TEAM_ID}`,
        )
        expect(init.method).toBe('DELETE')
    })
})

describe('error handling', () => {
    it('429 response populates retryAfter from Retry-After header', async () => {
        mockFetchOnce({
            ok: false,
            status: 429,
            statusText: 'Too Many Requests',
            body: {
                error: {
                    code: 'rate_limited',
                    message: 'Rate limit exceeded',
                },
            },
            headers: { 'Retry-After': '60' },
        })

        try {
            await addProjectDomain('example.com')
            throw new Error('expected addProjectDomain to throw')
        } catch (err) {
            expect(err).toBeInstanceOf(VercelDomainsError)
            const e = err as VercelDomainsError
            expect(e.status).toBe(429)
            expect(e.code).toBe('rate_limited')
            expect(e.retryAfter).toBe(60)
        }
    })

    it('non-JSON error response (502 HTML) falls back to statusText, no crash', async () => {
        mockFetchOnce({
            ok: false,
            status: 502,
            statusText: 'Bad Gateway',
            body: '<html><body>502 Bad Gateway</body></html>',
        })

        try {
            await getProjectDomain('example.com')
            throw new Error('expected getProjectDomain to throw')
        } catch (err) {
            expect(err).toBeInstanceOf(VercelDomainsError)
            const e = err as VercelDomainsError
            expect(e.status).toBe(502)
            expect(e.code).toBe('http_502')
            expect(e.message).toBe('Bad Gateway')
            expect(e.retryAfter).toBeUndefined()
        }
    })
})
