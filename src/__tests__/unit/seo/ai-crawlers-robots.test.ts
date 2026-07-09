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
 * Tests the robots.txt route behavior when aiCrawlersEnabled toggle
 * is true (default), false, or undefined. Also verifies scraper bots
 * are always blocked regardless of toggle state.
 */
describe('[TC-F37-03] robots.txt with AI crawler toggle', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    // ────────────────────────────────────────────────────────────────
    // TC-F37-03-01: Default allow (toggle ON)
    // ────────────────────────────────────────────────────────────────
    it('TC-F37-03-01: allows AI crawlers when aiCrawlersEnabled=true', async () => {
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
    // TC-F37-03-02: Default allow (toggle UNDEFINED)
    // ────────────────────────────────────────────────────────────────
    it('TC-F37-03-02: allows AI crawlers when aiCrawlersEnabled undefined (defaults to true)', async () => {
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
    // TC-F37-03-03: Opt-out (toggle OFF)
    // ────────────────────────────────────────────────────────────────
    it('TC-F37-03-03: blocks AI crawlers when aiCrawlersEnabled=false', async () => {
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

        // Each AI bot should have Disallow: /
        expect(body).toMatch(/User-agent: GPTBot\nDisallow: \//)
        expect(body).toMatch(/User-agent: ClaudeBot\nDisallow: \//)
        expect(body).toMatch(/User-agent: Google-Extended\nDisallow: \//)
        expect(body).toMatch(/User-agent: PerplexityBot\nDisallow: \//)
        expect(body).toMatch(/User-agent: CCBot\nDisallow: \//)
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
    // TC-F37-03-06: Scraper bots always blocked (toggle ON)
    // ────────────────────────────────────────────────────────────────
    it('TC-F37-03-06: always blocks scraper bots when toggle ON', async () => {
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

        // Assert — all scraper bots should have Disallow: / regardless of toggle
        expect(body).toMatch(/User-agent: Amazonbot\nDisallow: \//)
        expect(body).toMatch(/User-agent: Applebot-Extended\nDisallow: \//)
        expect(body).toMatch(/User-agent: Bytespider\nDisallow: \//)
        expect(body).toMatch(/User-agent: CloudflareBrowserRenderingCrawler\nDisallow: \//)
        expect(body).toMatch(/User-agent: meta-externalagent\nDisallow: \//)
    })

    // ────────────────────────────────────────────────────────────────
    // TC-F37-03-07: Scraper bots always blocked (toggle OFF)
    // ────────────────────────────────────────────────────────────────
    it('TC-F37-03-07: always blocks scraper bots when toggle OFF', async () => {
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
    // TC-F37-03-09: Default allow when published site not found (BR-03)
    // ────────────────────────────────────────────────────────────────
    it('TC-F37-03-09: defaults to allow when published site not found (BR-03)', async () => {
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
})
