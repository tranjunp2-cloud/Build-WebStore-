import { expect, test, type APIRequestContext, type APIResponse, type Page } from '@playwright/test'
import { lookup } from 'node:dns/promises'
import { BlockList, isIP } from 'node:net'

const AUTH_STATE_PATH = './e2e/.auth/user.json'
const EXPECTED_TEST_EMAIL = process.env.TEST_EMAIL
const PLATFORM_BASE_URL = process.env.BASE_URL

const NON_PUBLIC_ADDRESSES = new BlockList()
for (const [network, prefix] of [
    ['0.0.0.0', 8],
    ['10.0.0.0', 8],
    ['100.64.0.0', 10],
    ['127.0.0.0', 8],
    ['169.254.0.0', 16],
    ['172.16.0.0', 12],
    ['192.0.0.0', 24],
    ['192.0.2.0', 24],
    ['192.168.0.0', 16],
    ['198.18.0.0', 15],
    ['198.51.100.0', 24],
    ['203.0.113.0', 24],
    ['224.0.0.0', 4],
    ['240.0.0.0', 4],
] as const) {
    NON_PUBLIC_ADDRESSES.addSubnet(network, prefix, 'ipv4')
}
for (const [network, prefix] of [
    ['::', 128],
    ['::1', 128],
    ['::ffff:0:0', 96],
    ['64:ff9b:1::', 48],
    ['100::', 64],
    ['2001:db8::', 32],
    ['fc00::', 7],
    ['fe80::', 10],
    ['ff00::', 8],
] as const) {
    NON_PUBLIC_ADDRESSES.addSubnet(network, prefix, 'ipv6')
}

const APPROVED_ASSISTANTS = [
    'GPTBot',
    'ClaudeBot',
    'Google-Extended',
    'PerplexityBot',
    'CCBot',
] as const

const BLOCKED_SCRAPERS = [
    'Amazonbot',
    'Applebot-Extended',
    'Bytespider',
    'CloudflareBrowserRenderingCrawler',
    'meta-externalagent',
] as const

interface CustomDomain {
    domain?: string
    status?: string
    isPrimary?: boolean
}

interface TenantDocument {
    id: string | number
    slug?: string
    customDomains?: CustomDomain[]
}

type TenantReference = string | number | TenantDocument | null

interface TenantMembership {
    tenant?: TenantReference
    status?: string
}

interface CurrentUserResponse {
    email?: string
    tenants?: TenantMembership[]
    sites?: SiteDocument[]
}

interface SiteDocument {
    id: string | number
    tenant?: TenantReference
    status?: string
}

interface SiteFixture {
    tenant: TenantDocument
    siteId: string
    storefrontPath: string
    initiallyPublished: boolean
}

interface CustomDomainTarget {
    origin: string
    hostname: string
    address: string
    family: 4 | 6
}

interface DiscoveryFixtures {
    site: SiteFixture
    customDomainTargets: CustomDomainTarget[]
    customDomainError?: string
}

function requireStorefrontPath(name: string, value: string | undefined): string {
    if (!value?.startsWith('/sites/')) {
        throw new Error(`${name} must be a /sites/{slug} path for a stable staging fixture`)
    }
    return value.replace(/\/+$/, '')
}

function requireStorefrontOrigin(name: string, value: string | undefined): string {
    if (!value) {
        throw new Error(`${name} must be an absolute http(s) custom-domain origin`)
    }

    let url: URL
    try {
        url = new URL(value)
    } catch {
        throw new Error(`${name} must be an absolute http(s) custom-domain origin`)
    }

    if (
        !isHttpUrl(url.href) ||
        url.username ||
        url.password ||
        url.pathname !== '/' ||
        url.search ||
        url.hash
    ) {
        throw new Error(`${name} must be an absolute http(s) custom-domain origin without a path, query, or hash`)
    }

    return url.origin
}

async function resolvePublicCustomDomainTarget(
    value: string,
    platformOrigin: string,
): Promise<CustomDomainTarget> {
    const candidate = value.trim().toLowerCase()
    if (!candidate || candidate.includes('://')) {
        throw new Error('custom domain must be a hostname without a scheme')
    }

    const origin = requireStorefrontOrigin(
        'active custom domain owned by TEST_EMAIL',
        `https://${candidate}`,
    )
    const url = new URL(origin)
    if (url.port) throw new Error('custom domain must not include a port')

    const hostname = new URL(origin).hostname
    const platformHostname = new URL(platformOrigin).hostname

    if (hostname === platformHostname || hostname.endsWith(`.${platformHostname}`)) {
        throw new Error(
            'TEST_EMAIL must own a real custom domain, not the platform host or one of its subdomains',
        )
    }

    const normalizedHostname = hostname.replace(/^\[|\]$/g, '')
    if (
        isIP(normalizedHostname) !== 0
        || normalizedHostname === 'localhost'
        || normalizedHostname.endsWith('.localhost')
        || normalizedHostname.endsWith('.local')
        || normalizedHostname.endsWith('.internal')
        || normalizedHostname.endsWith('.home.arpa')
    ) {
        throw new Error('custom domain must use a public DNS hostname')
    }

    const addresses = await lookup(hostname, { all: true, verbatim: true })
    if (addresses.length === 0) throw new Error('custom domain has no DNS address')
    if (addresses.some(({ address, family }) =>
        NON_PUBLIC_ADDRESSES.check(address, family === 4 ? 'ipv4' : 'ipv6'))) {
        throw new Error('custom domain resolves to a non-public address')
    }

    const selectedAddress = addresses.find(({ family }) => family === 4) ?? addresses[0]
    return {
        origin,
        hostname,
        address: selectedAddress.address,
        family: selectedAddress.family as 4 | 6,
    }
}

function isHttpUrl(value: string): boolean {
    try {
        const url = new URL(value)
        return url.protocol === 'http:' || url.protocol === 'https:'
    } catch {
        return false
    }
}

function hydratedTenant(value: TenantReference | undefined): TenantDocument | null {
    if (!value || typeof value !== 'object') return null
    return typeof value.id === 'string' || typeof value.id === 'number' ? value : null
}

function relationshipId(value: TenantReference | undefined): string | null {
    if (typeof value === 'string' || typeof value === 'number') return String(value)
    const tenant = hydratedTenant(value)
    return tenant ? String(tenant.id) : null
}

function hasSafeStorefrontSlug(tenant: TenantDocument): boolean {
    const slug = tenant.slug?.trim()
    return Boolean(slug && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))
}

function activeDomainNames(tenant: TenantDocument): string[] {
    return (tenant.customDomains ?? [])
        .filter(domain => domain.status === 'active' && Boolean(domain.domain?.trim()))
        .map(domain => ({ ...domain, domain: domain.domain!.trim().toLowerCase() }))
        .sort(
            (a, b) =>
                Number(Boolean(b.isPrimary)) - Number(Boolean(a.isPrimary))
                || a.domain.localeCompare(b.domain),
        )
        .map(domain => domain.domain)
}

async function requireJson<T>(response: APIResponse, label: string): Promise<T> {
    if (!response.ok()) {
        throw new Error(`${label} failed with HTTP ${response.status()}`)
    }

    return await response.json() as T
}

function diagnosticDomain(value: string): string {
    return value.replace(/[^a-z0-9.-]/gi, '?').slice(0, 253)
}

async function findEligibleCustomDomainTargets(
    fixture: SiteFixture,
    platformOrigin: string,
): Promise<{ targets: CustomDomainTarget[]; error: string }> {
    const failures: string[] = []
    const targets: CustomDomainTarget[] = []

    for (const domain of activeDomainNames(fixture.tenant)) {
        try {
            targets.push(await resolvePublicCustomDomainTarget(domain, platformOrigin))
        } catch (error) {
            const message = error instanceof Error ? error.message : 'unknown validation error'
            failures.push(`${diagnosticDomain(domain)}: ${message}`)
        }
    }

    return {
        targets,
        error: targets.length === 0
            ? failures.join('; ') || 'no active custom domain exists on the owned tenant'
            : failures.join('; '),
    }
}

async function discoverFixtures(
    request: APIRequestContext,
    expectedEmail: string,
    platformOrigin: string,
): Promise<DiscoveryFixtures> {
    if (!expectedEmail) {
        throw new Error('TEST_EMAIL is required to discover the F37 staging fixtures')
    }

    const me = await requireJson<CurrentUserResponse>(
        await request.get('/api/users/me?include=site-status'),
        'Loading authenticated E2E user',
    )

    const actualEmail = me.email?.trim().toLowerCase()
    if (actualEmail !== expectedEmail.trim().toLowerCase()) {
        throw new Error('The saved E2E auth state does not belong to TEST_EMAIL')
    }

    const activeMemberships = (me.tenants ?? [])
        .filter(membership => membership.status === 'active')
    if (activeMemberships.length === 0) {
        throw new Error('TEST_EMAIL must have at least one active tenant membership')
    }

    if (activeMemberships.length !== 1) {
        throw new Error('The F37 test account must have exactly one active tenant membership')
    }

    const tenant = hydratedTenant(activeMemberships[0].tenant)
    if (!tenant) {
        throw new Error('/api/users/me must hydrate active tenant relationships for F37 fixture discovery')
    }
    if (!hasSafeStorefrontSlug(tenant)) {
        throw new Error('The active TEST_EMAIL tenant must have a valid storefront slug')
    }

    const ownedSites = (me.sites ?? []).filter(site =>
        relationshipId(site.tenant) === String(tenant.id))
    if (ownedSites.length !== 1) {
        throw new Error('The F37 test account must own exactly one site')
    }
    const [ownedSite] = ownedSites
    if (ownedSite.status !== 'published' && ownedSite.status !== 'draft') {
        throw new Error('The F37 test site status must be published or draft')
    }
    const fixture: SiteFixture = {
        tenant,
        siteId: String(ownedSite.id),
        storefrontPath: requireStorefrontPath(
            'TEST_EMAIL storefront',
            `/sites/${tenant.slug}`,
        ),
        initiallyPublished: ownedSite.status === 'published',
    }

    const customDomain = await findEligibleCustomDomainTargets(
        fixture,
        platformOrigin,
    )

    return {
        site: fixture,
        customDomainTargets: customDomain.targets,
        customDomainError: customDomain.error,
    }
}

async function setSitePublished(
    request: APIRequestContext,
    siteId: string,
    published: boolean,
): Promise<void> {
    const response = await request.patch('/api/e2e/site-status', {
        data: {
            siteId,
            status: published ? 'published' : 'draft',
        },
    })
    const result = await requireJson<{ data?: { status?: string } }>(
        response,
        `${published ? 'Publishing' : 'Unpublishing'} the F37 test site`,
    )
    const expectedStatus = published ? 'published' : 'draft'
    if (result.data?.status !== expectedStatus) {
        throw new Error(
            `E2E status transition returned ${result.data?.status ?? 'no status'} instead of ${expectedStatus}`,
        )
    }
}

async function readSitePublished(
    request: APIRequestContext,
    siteId: string,
): Promise<boolean> {
    const me = await requireJson<CurrentUserResponse>(
        await request.get('/api/users/me?include=site-status'),
        'Verifying the F37 test site status',
    )
    const site = (me.sites ?? []).find(candidate => String(candidate.id) === siteId)
    if (!site || (site.status !== 'published' && site.status !== 'draft')) {
        throw new Error('The F37 test site status could not be verified')
    }
    return site.status === 'published'
}

async function restoreSitePublished(
    request: APIRequestContext,
    fixture: SiteFixture,
): Promise<void> {
    let lastError: unknown
    for (let attempt = 1; attempt <= 3; attempt++) {
        try {
            if (await readSitePublished(request, fixture.siteId) === fixture.initiallyPublished) {
                return
            }
            await setSitePublished(request, fixture.siteId, fixture.initiallyPublished)
            if (await readSitePublished(request, fixture.siteId) === fixture.initiallyPublished) {
                return
            }
        } catch (error) {
            lastError = error
        }
        await new Promise(resolve => setTimeout(resolve, attempt * 250))
    }

    throw new Error('Failed to restore the F37 test site status after 3 attempts', {
        cause: lastError,
    })
}

async function withTemporarySiteStatus<T>(
    request: APIRequestContext,
    fixture: SiteFixture,
    desiredPublished: boolean,
    run: () => Promise<T>,
): Promise<T> {
    const changed = fixture.initiallyPublished !== desiredPublished
    let transitionAttempted = false
    let testError: unknown

    try {
        if (changed) {
            transitionAttempted = true
            await setSitePublished(request, fixture.siteId, desiredPublished)
            if (await readSitePublished(request, fixture.siteId) !== desiredPublished) {
                throw new Error('The temporary F37 test site status did not take effect')
            }
        }
        return await run()
    } catch (error) {
        testError = error
        throw error
    } finally {
        if (transitionAttempted) {
            try {
                await restoreSitePublished(request, fixture)
            } catch (restoreError) {
                if (testError) {
                    throw new AggregateError(
                        [testError, restoreError],
                        'F37 test failed and its original site status could not be restored',
                    )
                }
                throw restoreError
            }
        }
    }
}

function unescapeXml(value: string): string {
    return value
        .replaceAll('&amp;', '&')
        .replaceAll('&lt;', '<')
        .replaceAll('&gt;', '>')
}

function extractSitemapLinks(body: string): string[] {
    return Array.from(body.matchAll(/<loc>([^<]+)<\/loc>/g), match => unescapeXml(match[1]))
}

function extractLlmsLinks(body: string): string[] {
    return body
        .split('\n')
        .filter(line => line.startsWith('- http'))
        .map(line => line.slice(2))
}

function requireAdvertisedDetailLink(
    links: string[],
    origin: string,
    kind: 'product' | 'blog',
): string {
    const pathnamePattern = kind === 'product'
        ? /\/products\/[^/]+\/?$/
        : /\/blog\/[^/]+\/?$/
    const link = links.find(candidate => {
        if (!isHttpUrl(candidate)) return false
        const url = new URL(candidate)
        return url.origin === origin && pathnamePattern.test(url.pathname)
    })

    if (!link) {
        throw new Error(`Custom-domain fixture must advertise at least one ${kind} detail URL on ${origin}`)
    }

    return link
}

async function navigateToText(page: Page, path: string) {
    const response = await page.goto(path, { waitUntil: 'domcontentloaded' })
    expect(response, `Expected a navigation response for ${path}`).not.toBeNull()
    return {
        response: response!,
        body: await response!.text(),
    }
}

test.describe('F37-03 platform-managed AI discoverability', () => {
    let authenticatedRequest: APIRequestContext
    let siteFixture: SiteFixture
    let customDomainTargets: CustomDomainTarget[] = []
    let customDomainError: string | undefined

    test.beforeAll(async ({ playwright }) => {
        const baseURL = requireStorefrontOrigin('BASE_URL', PLATFORM_BASE_URL)
        authenticatedRequest = await playwright.request.newContext({
            baseURL,
            storageState: AUTH_STATE_PATH,
        })
        const fixtures = await discoverFixtures(
            authenticatedRequest,
            EXPECTED_TEST_EMAIL ?? '',
            baseURL,
        )
        siteFixture = fixtures.site
        customDomainTargets = fixtures.customDomainTargets
        customDomainError = fixtures.customDomainError
    })

    test.afterAll(async () => {
        await authenticatedRequest?.dispose()
    })

    test('[TC-F37-03-28] published storefront exposes all discovery endpoints', async ({ page }) => {
        // Arrange
        const publishedBasePath = siteFixture.storefrontPath
        const endpointPaths = {
            robots: `${publishedBasePath}/robots.txt`,
            sitemap: `${publishedBasePath}/sitemap.xml`,
            llms: `${publishedBasePath}/llms.txt`,
        }

        await withTemporarySiteStatus(authenticatedRequest, siteFixture, true, async () => {
            // Act
            const robots = await navigateToText(page, endpointPaths.robots)
            const sitemap = await navigateToText(page, endpointPaths.sitemap)
            const llms = await navigateToText(page, endpointPaths.llms)

            // Assert
            expect(robots.response.status()).toBe(200)
            for (const bot of APPROVED_ASSISTANTS) {
                expect(robots.body).toContain(`User-agent: ${bot}\nAllow: /`)
            }
            for (const bot of BLOCKED_SCRAPERS) {
                expect(robots.body).toContain(`User-agent: ${bot}\nDisallow: /`)
            }

            expect(sitemap.response.status()).toBe(200)
            expect(sitemap.response.headers()['content-type']).toContain('application/xml')
            expect(sitemap.body).toContain('<urlset')
            expect(sitemap.body).toContain('<loc>https://')
            expect(sitemap.body).not.toMatch(/\/(?:checkout|orders|admin)(?:\/|<)/)

            expect(llms.response.status()).toBe(200)
            expect(llms.response.headers()['content-type']).toContain('text/plain')
            expect(llms.body).toMatch(/^# .+/)
            expect(llms.body).toContain('## Key Pages')
            const publicLinks = extractLlmsLinks(llms.body)
            expect(publicLinks.length).toBeGreaterThan(0)
            expect(publicLinks.every(isHttpUrl)).toBe(true)
            expect(publicLinks.join('\n')).not.toMatch(/\/(?:checkout|orders|admin)(?:\/|$)/)
        })
    })

    test('[TC-F37-03-52] advertised discovery URLs remain reachable', async ({ playwright }) => {
        // Arrange
        if (customDomainTargets.length === 0) {
            throw new Error(
                `The F37 test account needs an active public custom domain advertising product and blog detail URLs: ${customDomainError ?? 'fixture unavailable'}`,
            )
        }
        await withTemporarySiteStatus(authenticatedRequest, siteFixture, true, async () => {
            const failures: string[] = []

            for (const target of customDomainTargets) {
                const resolverAddress = target.family === 6 ? `[${target.address}]` : target.address
                const browser = await playwright.chromium.launch({
                    args: [`--host-resolver-rules=MAP ${target.hostname} ${resolverAddress}`],
                })
                const context = await browser.newContext()
                await context.route('**/*', async route => {
                    const requestOrigin = new URL(route.request().url()).origin
                    if (requestOrigin !== target.origin) {
                        await route.abort('blockedbyclient')
                        return
                    }
                    await route.continue()
                })
                const page = await context.newPage()

                try {
                    const sitemap = await navigateToText(page, `${target.origin}/sitemap.xml`)
                    const llms = await navigateToText(page, `${target.origin}/llms.txt`)
                    expect(sitemap.response.status()).toBe(200)
                    expect(llms.response.status()).toBe(200)

                    const sitemapLinks = extractSitemapLinks(sitemap.body)
                    const llmsLinks = extractLlmsLinks(llms.body)
                    const advertisedLinks = Array.from(new Set([
                        requireAdvertisedDetailLink(sitemapLinks, target.origin, 'product'),
                        requireAdvertisedDetailLink(sitemapLinks, target.origin, 'blog'),
                        requireAdvertisedDetailLink(llmsLinks, target.origin, 'product'),
                        requireAdvertisedDetailLink(llmsLinks, target.origin, 'blog'),
                    ]))

                    expect(sitemapLinks.length).toBeGreaterThan(0)
                    expect(llmsLinks.length).toBeGreaterThan(0)

                    // Act + Assert
                    for (const link of advertisedLinks) {
                        const response = await page.goto(link, { waitUntil: 'domcontentloaded' })
                        expect(response, `Expected a navigation response for advertised URL ${link}`).not.toBeNull()
                        expect(response!.status(), `Expected advertised URL ${link} to return 200`).toBe(200)
                        expect(response!.url()).toBe(link)
                        expect(response!.request().redirectedFrom(), `Expected ${link} to render without redirecting`).toBeNull()
                    }
                    return
                } catch (error) {
                    const message = error instanceof Error ? error.message : 'unknown browser validation error'
                    failures.push(`${target.hostname}: ${message}`)
                } finally {
                    await browser.close()
                }
            }

            throw new Error(`No active custom domain passed pinned browser validation: ${failures.join('; ')}`)
        })
    })

    test('[TC-F37-03-29] unpublished storefront keeps crawler baseline but hides publish-only endpoints', async ({ page }) => {
        // Arrange
        const unpublishedBasePath = siteFixture.storefrontPath
        const endpointPaths = {
            robots: `${unpublishedBasePath}/robots.txt`,
            sitemap: `${unpublishedBasePath}/sitemap.xml`,
            llms: `${unpublishedBasePath}/llms.txt`,
        }

        await withTemporarySiteStatus(authenticatedRequest, siteFixture, false, async () => {
            // Act
            const robots = await navigateToText(page, endpointPaths.robots)
            const sitemap = await navigateToText(page, endpointPaths.sitemap)
            const llms = await navigateToText(page, endpointPaths.llms)

            // Assert
            expect(robots.response.status()).toBe(200)
            for (const bot of APPROVED_ASSISTANTS) {
                expect(robots.body).toContain(`User-agent: ${bot}\nAllow: /`)
            }
            expect(sitemap.response.status()).toBe(404)
            expect(llms.response.status()).toBe(404)
        })
    })
})
