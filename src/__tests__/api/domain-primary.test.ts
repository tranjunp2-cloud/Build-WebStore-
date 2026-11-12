import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET } from '@/app/api/domain-primary/route'
import { NextRequest } from 'next/server'

// ── Payload mock ──────────────────────────────────────────────────────────────
let mockTenants: any[] = [
    {
        id: 'tenant-1',
        name: 'Coffee Shop',
        customDomains: [
            { domain: 'coffeeshop.com', status: 'active', isPrimary: true },
            { domain: 'coffee.co', status: 'active', isPrimary: false },
            { domain: 'old-domain.com', status: 'inactive', isPrimary: false },
        ],
    },
]

vi.mock('payload', () => ({
    getPayload: vi.fn().mockImplementation(async () => ({
        find: vi.fn().mockImplementation(async ({ collection, where }) => {
            if (collection === 'tenants') {
                // Basic domain matching
                const host = where?.['customDomains.domain']?.equals
                const matched = mockTenants.filter(t => {
                    const domains = t.customDomains || []
                    return host ? domains.some((d: any) => d.domain === host) : true
                })
                return { docs: matched }
            }
            return { docs: [] }
        }),
    })),
}))

vi.mock('@payload-config', () => ({ default: {} }))
// the route reads the cached, per-domain-tagged lookup (src/lib/cache/tenant.ts): no Next cache in unit tests
vi.mock('next/cache', () => ({ unstable_cache: (fn: (...args: unknown[]) => unknown) => fn, revalidateTag: vi.fn() }))

// ── Helpers ──────────────────────────────────────────────────────────────────
const makeGetReq = (host?: string) => {
    const url = host
        ? `http://localhost:3000/api/domain-primary?host=${encodeURIComponent(host)}`
        : 'http://localhost:3000/api/domain-primary'
    return new NextRequest(url, { method: 'GET' })
}

// ── TC-GH1519-05: GET /api/domain-primary ────────────────────────────────────
describe('[TC-GH1519-05] GET /api/domain-primary (status code contracts)', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockTenants = [
            {
                id: 'tenant-1',
                name: 'Coffee Shop',
                customDomains: [
                    { domain: 'coffeeshop.com', status: 'active', isPrimary: true },
                    { domain: 'coffee.co', status: 'active', isPrimary: false },
                    { domain: 'old-domain.com', status: 'inactive', isPrimary: false },
                ],
            },
        ]
    })

    it('TC-GH1519-05a: returns 400 when host parameter is missing', async () => {
        // Arrange
        const req = makeGetReq()

        // Act
        const res = await GET(req)
        const body = await res.json()

        // Assert
        expect(res.status).toBe(400)
        expect(body.error).toBeDefined()
        expect(body.error.code).toBe('MISSING_HOST')
        expect(body.error.message).toContain('host')
    })

    it('TC-GH1519-05b: returns 200 with isPrimary true when host is the primary domain', async () => {
        // Arrange
        const req = makeGetReq('coffeeshop.com')

        // Act
        const res = await GET(req)
        const body = await res.json()

        // Assert
        expect(res.status).toBe(200)
        expect(body.isPrimary).toBe(true)
        expect(body.primaryDomain).toBe('coffeeshop.com')
    })

    it('TC-GH1519-05c: returns 200 with isPrimary false when host is not the primary domain', async () => {
        // Arrange
        const req = makeGetReq('coffee.co')

        // Act
        const res = await GET(req)
        const body = await res.json()

        // Assert
        expect(res.status).toBe(200)
        expect(body.isPrimary).toBe(false)
        expect(body.primaryDomain).toBe('coffeeshop.com')
    })

    it('TC-GH1519-05d: returns 200 when domain does not exist in any tenant', async () => {
        // Arrange
        const req = makeGetReq('unknown-domain.com')

        // Act
        const res = await GET(req)
        const body = await res.json()

        // Assert
        expect(res.status).toBe(200)
        expect(body.isPrimary).toBe(true)
        expect(body.primaryDomain).toBeNull()
    })

    it('TC-GH1519-05e: returns 200 with null primaryDomain when no primary domain exists', async () => {
        // Arrange
        mockTenants = [
            {
                id: 'tenant-2',
                name: 'No Primary',
                customDomains: [
                    { domain: 'secondary.com', status: 'active', isPrimary: false },
                ],
            },
        ]
        const req = makeGetReq('secondary.com')

        // Act
        const res = await GET(req)
        const body = await res.json()

        // Assert
        expect(res.status).toBe(200)
        expect(body.isPrimary).toBe(false)
        expect(body.primaryDomain).toBeNull()
    })

    it('TC-GH1519-05f: ignores inactive domains when checking isPrimary', async () => {
        // Arrange
        const req = makeGetReq('old-domain.com')

        // Act
        const res = await GET(req)
        const body = await res.json()

        // Assert
        expect(res.status).toBe(200)
        // inactive domain should not be found
        expect(body.isPrimary).toBe(true)
        expect(body.primaryDomain).toBeNull()
    })

    it('TC-GH1519-05g: handles empty customDomains array gracefully', async () => {
        // Arrange
        mockTenants = [
            { id: 'tenant-3', name: 'Empty', customDomains: [] },
        ]
        const req = makeGetReq('any-domain.com')

        // Act
        const res = await GET(req)
        const body = await res.json()

        // Assert
        expect(res.status).toBe(200)
        expect(body.isPrimary).toBe(true)
        expect(body.primaryDomain).toBeNull()
    })

    it('TC-GH1519-05h: handles null customDomains gracefully', async () => {
        // Arrange
        mockTenants = [
            { id: 'tenant-4', name: 'Null Domains', customDomains: null },
        ]
        const req = makeGetReq('any-domain.com')

        // Act
        const res = await GET(req)
        const body = await res.json()

        // Assert
        expect(res.status).toBe(200)
        expect(body.isPrimary).toBe(true)
        expect(body.primaryDomain).toBeNull()
    })

    it('TC-GH1519-05i: returns 200 on Payload error (failsafe: traffic not blocked)', async () => {
        // Arrange
        const { getPayload } = await import('payload')
        vi.mocked(getPayload).mockResolvedValueOnce({
            find: vi.fn().mockRejectedValue(new Error('Database error')),
        } as any)
        const req = makeGetReq('example.com')

        // Act
        const res = await GET(req)
        const body = await res.json()

        // Assert
        expect(res.status).toBe(200)
        expect(body.isPrimary).toBe(true)
        expect(body.primaryDomain).toBeNull()
    })

    it('TC-GH1519-05j: handles empty host parameter as missing (returns 400)', async () => {
        // Arrange
        const url = 'http://localhost:3000/api/domain-primary?host='
        const req = new NextRequest(url, { method: 'GET' })

        // Act
        const res = await GET(req)
        const body = await res.json()

        // Assert
        expect(res.status).toBe(400)
        expect(body.error.code).toBe('MISSING_HOST')
    })

    it('TC-GH1519-05k: handles special characters in host parameter safely', async () => {
        // Arrange
        const req = makeGetReq('sub.domain-with-special.co.uk')

        // Act
        const res = await GET(req)
        const body = await res.json()

        // Assert
        expect(res.status).toBe(200)
        expect(body).toHaveProperty('isPrimary')
        expect(body).toHaveProperty('primaryDomain')
    })
})
