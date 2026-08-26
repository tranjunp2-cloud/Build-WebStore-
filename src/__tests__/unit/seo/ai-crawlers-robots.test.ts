import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Mocks (top-level, before imports) ─────────────────────────────────

const mockFind = vi.fn()
vi.mock('payload', () => ({
    getPayload: vi.fn(() => Promise.resolve({
        find: mockFind,
    })),
}))
vi.mock('@payload-config', () => ({ default: {} }))

import { GET as getRobotsTxt } from '@/app/sites/[slug]/robots.txt/route'

// ─── Test Suite ────────────────────────────────────────────────────────

/**
 * TC-F37-03: AI Crawler Permissions in robots.txt
 *
 * Tests the platform-managed crawler invariant, including legacy site values
 * that must no longer influence robots output. Scraper bots remain blocked.
 */
describe('[TC-F37-03] platform-managed robots.txt', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        // The route no longer consumes the legacy sites lookup. Reset queued
        // one-time results so an unused site fixture cannot leak into the next
        // test's tenant lookup.
        mockFind.mockReset()
    })

    // ────────────────────────────────────────────────────────────────
    // TC-F37-03-01: Approved AI assistants are always allowed
    // ────────────────────────────────────────────────────────────────
    it('TC-F37-03-01: always allows approved AI crawlers', async () => {
        // Arrange
        const mockTenant = { id: 'tenant-1', slug: 'mycafe' }
        const mockSite = {
            id: 'site-1',
            tenant: 'tenant-1',
            aiCrawlersEnabled: true,
            status: 'published',
        }

        mockFind
            .mockResolvedValueOnce({ docs: [mockTenant] })  // tenants query
            .mockResolvedValueOnce({ docs: [mockSite] })    // sites query

        // Act
        const response = await getRobotsTxt(
            {
                headers: new Map([['x-tenant-hostname', '']]) as any,
            } as any,
            { params: Promise.resolve({ slug: 'mycafe' }) }
        )
        const body = await response.text()

        // Assert
        expect(response.status).toBe(200)
        expect(response.headers.get('Content-Type')).toBe('text/plain')

        // Each AI bot should have Allow: /
        expect(body).toContain('User-agent: GPTBot')
        expect(body).toMatch(/User-agent: GPTBot\nAllow: \//)

        expect(body).toContain('User-agent: ClaudeBot')
        expect(body).toMatch(/User-agent: ClaudeBot\nAllow: \//)

        expect(body).toContain('User-agent: Google-Extended')
        expect(body).toMatch(/User-agent: Google-Extended\nAllow: \//)

        expect(body).toContain('User-agent: PerplexityBot')
        expect(body).toMatch(/User-agent: PerplexityBot\nAllow: \//)

        expect(body).toContain('User-agent: CCBot')
        expect(body).toMatch(/User-agent: CCBot\nAllow: \//)
    })

    // ────────────────────────────────────────────────────────────────
    // TC-F37-03-02: Legacy undefined value is non-authoritative
    // ────────────────────────────────────────────────────────────────
    it('TC-F37-03-02: allows AI crawlers when the legacy value is undefined', async () => {
        // Arrange — site without explicit toggle (legacy data)
        const mockTenant = { id: 'tenant-1', slug: 'oldshop' }
        const mockSite = {
            id: 'site-2',
            tenant: 'tenant-1',
            status: 'published',
            // aiCrawlersEnabled intentionally omitted
        }

        mockFind
            .mockResolvedValueOnce({ docs: [mockTenant] })
            .mockResolvedValueOnce({ docs: [mockSite] })

        // Act
        const response = await getRobotsTxt(
            {
                headers: new Map([['x-tenant-hostname', '']]) as any,
            } as any,
            { params: Promise.resolve({ slug: 'oldshop' }) }
        )
        const body = await response.text()

        // Assert
        expect(response.status).toBe(200)
        expect(body).toMatch(/User-agent: GPTBot\nAllow: \//)
        expect(body).toMatch(/User-agent: ClaudeBot\nAllow: \//)
    })

    // ────────────────────────────────────────────────────────────────
    // TC-F37-03-03: Persisted legacy false cannot block approved assistants
    // ────────────────────────────────────────────────────────────────
    it('TC-F37-03-03: ignores a persisted legacy aiCrawlersEnabled=false value', async () => {
        // Arrange
        const mockTenant = { id: 'tenant-1', slug: 'private-shop' }
        const mockSite = {
            id: 'site-3',
            tenant: 'tenant-1',
            aiCrawlersEnabled: false,
            status: 'published',
        }

        mockFind
            .mockResolvedValueOnce({ docs: [mockTenant] })
            .mockResolvedValueOnce({ docs: [mockSite] })

        // Act
        const response = await getRobotsTxt(
            {
                headers: new Map([['x-tenant-hostname', '']]) as any,
            } as any,
            { params: Promise.resolve({ slug: 'private-shop' }) }
        )
        const body = await response.text()

        // Assert
        expect(response.status).toBe(200)
        expect(mockFind).toHaveBeenCalledTimes(1)

        // Legacy state is inert: all approved assistants keep the platform policy.
        expect(body).toMatch(/User-agent: GPTBot\nAllow: \//)
        expect(body).toMatch(/User-agent: ClaudeBot\nAllow: \//)
        expect(body).toMatch(/User-agent: Google-Extended\nAllow: \//)
        expect(body).toMatch(/User-agent: PerplexityBot\nAllow: \//)
        expect(body).toMatch(/User-agent: CCBot\nAllow: \//)
    })

    // ────────────────────────────────────────────────────────────────
    // TC-F37-03-04: Googlebot unaffected (not in AI or scraper lists)
    // ────────────────────────────────────────────────────────────────
    it('TC-F37-03-04: does not explicitly block or allow Googlebot (uses default User-agent: *)', async () => {
        // Arrange
        const mockTenant = { id: 'tenant-1', slug: 'mycafe' }
        const mockSite = {
            id: 'site-1',
            tenant: 'tenant-1',
            aiCrawlersEnabled: false,
            status: 'published',
        }

        mockFind
            .mockResolvedValueOnce({ docs: [mockTenant] })
            .mockResolvedValueOnce({ docs: [mockSite] })

        // Act
        const response = await getRobotsTxt(
            {
                headers: new Map([['x-tenant-hostname', '']]) as any,
            } as any,
            { params: Promise.resolve({ slug: 'mycafe' }) }
        )
        const body = await response.text()

        // Assert — Googlebot should NOT appear in explicit rules (not an AI bot, not a scraper)
        expect(body).not.toContain('User-agent: Googlebot')
        // Should only have the generic User-agent: * rule which Googlebot falls under
        expect(body).toContain('User-agent: *')
        expect(body).toContain('Allow: /')
    })

    // ────────────────────────────────────────────────────────────────
    // TC-F37-03-05: PerplexityBot in AI bots list
    // ────────────────────────────────────────────────────────────────
    it('TC-F37-03-05: includes PerplexityBot in AI crawlers list', async () => {
        // Arrange
        const mockTenant = { id: 'tenant-1', slug: 'mycafe' }
        const mockSite = {
            id: 'site-1',
            tenant: 'tenant-1',
            aiCrawlersEnabled: true,
            status: 'published',
        }

        mockFind
            .mockResolvedValueOnce({ docs: [mockTenant] })
            .mockResolvedValueOnce({ docs: [mockSite] })

        // Act
        const response = await getRobotsTxt(
            {
                headers: new Map([['x-tenant-hostname', '']]) as any,
            } as any,
            { params: Promise.resolve({ slug: 'mycafe' }) }
        )
        const body = await response.text()

        // Assert
        expect(body).toContain('User-agent: PerplexityBot')
        expect(body).toMatch(/User-agent: PerplexityBot\nAllow: \//)
    })

    // ────────────────────────────────────────────────────────────────
    // TC-F37-03-06: Scraper bots remain blocked with legacy true
    // ────────────────────────────────────────────────────────────────
    it('TC-F37-03-06: blocks scraper bots when the legacy value is true', async () => {
        // Arrange
        const mockTenant = { id: 'tenant-1', slug: 'mycafe' }
        const mockSite = {
            id: 'site-1',
            tenant: 'tenant-1',
            aiCrawlersEnabled: true,
            status: 'published',
        }

        mockFind
            .mockResolvedValueOnce({ docs: [mockTenant] })
            .mockResolvedValueOnce({ docs: [mockSite] })

        // Act
        const response = await getRobotsTxt(
            {
                headers: new Map([['x-tenant-hostname', '']]) as any,
            } as any,
            { params: Promise.resolve({ slug: 'mycafe' }) }
        )
        const body = await response.text()

        // Assert — all scraper bots remain outside the approved assistant policy.
        expect(body).toMatch(/User-agent: Amazonbot\nDisallow: \//)
        expect(body).toMatch(/User-agent: Applebot-Extended\nDisallow: \//)
        expect(body).toMatch(/User-agent: Bytespider\nDisallow: \//)
        expect(body).toMatch(/User-agent: CloudflareBrowserRenderingCrawler\nDisallow: \//)
        expect(body).toMatch(/User-agent: meta-externalagent\nDisallow: \//)
    })

    // ────────────────────────────────────────────────────────────────
    // TC-F37-03-07: Scraper bots remain blocked with legacy false
    // ────────────────────────────────────────────────────────────────
    it('TC-F37-03-07: blocks scraper bots when the legacy value is false', async () => {
        // Arrange
        const mockTenant = { id: 'tenant-1', slug: 'private' }
        const mockSite = {
            id: 'site-2',
            tenant: 'tenant-1',
            aiCrawlersEnabled: false,
            status: 'published',
        }

        mockFind
            .mockResolvedValueOnce({ docs: [mockTenant] })
            .mockResolvedValueOnce({ docs: [mockSite] })

        // Act
        const response = await getRobotsTxt(
            {
                headers: new Map([['x-tenant-hostname', '']]) as any,
            } as any,
            { params: Promise.resolve({ slug: 'private' }) }
        )
        const body = await response.text()

        // Assert
        expect(body).toMatch(/User-agent: Amazonbot\nDisallow: \//)
        expect(body).toMatch(/User-agent: Bytespider\nDisallow: \//)
        expect(body).toMatch(/User-agent: meta-externalagent\nDisallow: \//)
    })

    // ────────────────────────────────────────────────────────────────
    // TC-F37-03-08: 404 when no tenant found
    // ────────────────────────────────────────────────────────────────
    it('TC-F37-03-08: returns 404 when tenant not found', async () => {
        // Arrange
        mockFind.mockResolvedValueOnce({ docs: [] })  // no tenant

        // Act
        const response = await getRobotsTxt(
            {
                headers: new Map([['x-tenant-hostname', '']]) as any,
            } as any,
            { params: Promise.resolve({ slug: 'nonexistent' }) }
        )

        // Assert
        expect(response.status).toBe(404)
    })

    // ────────────────────────────────────────────────────────────────
    // TC-F37-03-09: Default allow when published site not found
    // ────────────────────────────────────────────────────────────────
    it('TC-F37-03-09: defaults to allow when published site not found', async () => {
        // Arrange
        const mockTenant = { id: 'tenant-1', slug: 'mycafe' }
        mockFind
            .mockResolvedValueOnce({ docs: [mockTenant] })
            .mockResolvedValueOnce({ docs: [] })  // no site

        // Act
        const response = await getRobotsTxt(
            {
                headers: new Map([['x-tenant-hostname', '']]) as any,
            } as any,
            { params: Promise.resolve({ slug: 'mycafe' }) }
        )
        const body = await response.text()

        // Assert — missing site defaults to allow (safe default per BR-03)
        expect(response.status).toBe(200)
        // AI bots should have Allow: / (default when site missing)
        expect(body).toMatch(/User-agent: GPTBot\nAllow: \//)
        expect(body).toMatch(/User-agent: ClaudeBot\nAllow: \//)
    })

    // ────────────────────────────────────────────────────────────────
    // TC-F37-03-10: Sitemap URL in robots.txt
    // ────────────────────────────────────────────────────────────────
    it('TC-F37-03-10: includes correct Sitemap URL for subdomain', async () => {
        // Arrange
        const mockTenant = { id: 'tenant-1', slug: 'mycafe' }
        const mockSite = {
            id: 'site-1',
            tenant: 'tenant-1',
            aiCrawlersEnabled: true,
            status: 'published',
        }

        mockFind
            .mockResolvedValueOnce({ docs: [mockTenant] })
            .mockResolvedValueOnce({ docs: [mockSite] })

        process.env.NEXT_PUBLIC_PLATFORM_DOMAIN = 'primeweb.app'

        // Act
        const response = await getRobotsTxt(
            {
                headers: new Map([['x-tenant-hostname', '']]) as any,
            } as any,
            { params: Promise.resolve({ slug: 'mycafe' }) }
        )
        const body = await response.text()

        // Assert
        expect(body).toContain('Sitemap: https://mycafe.primeweb.app/sitemap.xml')
    })

    // ────────────────────────────────────────────────────────────────
    // TC-F37-03-11: Default User-agent: * rules preserved
    // ────────────────────────────────────────────────────────────────
    it('TC-F37-03-11: preserves default User-agent: * rules (Allow: /, Disallow: /api, /admin)', async () => {
        // Arrange
        const mockTenant = { id: 'tenant-1', slug: 'mycafe' }
        const mockSite = {
            id: 'site-1',
            tenant: 'tenant-1',
            aiCrawlersEnabled: true,
            status: 'published',
        }

        mockFind
            .mockResolvedValueOnce({ docs: [mockTenant] })
            .mockResolvedValueOnce({ docs: [mockSite] })

        // Act
        const response = await getRobotsTxt(
            {
                headers: new Map([['x-tenant-hostname', '']]) as any,
            } as any,
            { params: Promise.resolve({ slug: 'mycafe' }) }
        )
        const body = await response.text()

        // Assert
        const lines = body.split('\n')
        const userAgentStarIndex = lines.findIndex(l => l === 'User-agent: *')
        expect(userAgentStarIndex).toBeGreaterThanOrEqual(0)
        expect(lines[userAgentStarIndex + 1]).toBe('Allow: /')
        expect(body).toContain('Disallow: /api/')
        expect(body).toContain('Disallow: /admin/')
    })

    // ────────────────────────────────────────────────────────────────
    // TC-F37-03-36: AI-bot groups repeat /api//admin/ exclusions when allowed
    // (RFC 9309 §2.2.1 — a crawler applies only its own most-specific group,
    // ignoring User-agent: * entirely, so the exclusions must be per-group)
    // ────────────────────────────────────────────────────────────────
    it('TC-F37-03-36: AI bot groups include Disallow: /api/ and /admin/ when allowed', async () => {
        // Arrange
        const mockTenant = { id: 'tenant-1', slug: 'mycafe' }
        const mockSite = {
            id: 'site-1',
            tenant: 'tenant-1',
            aiCrawlersEnabled: true,
            status: 'published',
        }

        mockFind
            .mockResolvedValueOnce({ docs: [mockTenant] })
            .mockResolvedValueOnce({ docs: [mockSite] })

        // Act
        const response = await getRobotsTxt(
            {
                headers: new Map([['x-tenant-hostname', '']]) as any,
            } as any,
            { params: Promise.resolve({ slug: 'mycafe' }) }
        )
        const body = await response.text()

        // Assert — each AI bot's own group must carry the same exclusions as User-agent: *
        expect(body).toMatch(/User-agent: GPTBot\nAllow: \/\nDisallow: \/api\/\nDisallow: \/admin\//)
        expect(body).toMatch(/User-agent: ClaudeBot\nAllow: \/\nDisallow: \/api\/\nDisallow: \/admin\//)
        expect(body).toMatch(/User-agent: Google-Extended\nAllow: \/\nDisallow: \/api\/\nDisallow: \/admin\//)
        expect(body).toMatch(/User-agent: PerplexityBot\nAllow: \/\nDisallow: \/api\/\nDisallow: \/admin\//)
        expect(body).toMatch(/User-agent: CCBot\nAllow: \/\nDisallow: \/api\/\nDisallow: \/admin\//)
    })
})
