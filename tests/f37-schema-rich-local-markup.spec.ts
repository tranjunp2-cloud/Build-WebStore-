import { expect, test, type Browser } from '@playwright/test'
import { SCHEMA_SUBTYPE_OPTIONS } from '@/lib/seo/local-business-constants'
import { isValidOpeningTimeRange, normalizeHttpUrl } from '@/lib/seo/schema-helpers'

const AUTH_FILE = './e2e/.auth/user.json'
const hasE2EAccount = Boolean(
    process.env.TEST_EMAIL
    && process.env.TEST_PASSWORD
    && process.env.E2E_TEST_OTP_CODE,
)
const localSkipReason = 'Set TEST_EMAIL, TEST_PASSWORD, and E2E_TEST_OTP_CODE to discover the E2E account’s sole site'

type JsonLdNode = Record<string, unknown>

type FixtureSite = {
    id: string
    tenantSlug: string
    storefrontPath: string
    name: string
    phone: string
    schemaSubtype: string
    streetAddress: string
    city: string
    postcode: string
    country: string
    latitude: number
    longitude: number
    subpageSlug: string | null
}

const LOCAL_BUSINESS_TYPE_NAMES = new Set<string>([
    'LocalBusiness',
    ...SCHEMA_SUBTYPE_OPTIONS.map(option => option.value),
    // Legacy broad types emitted before the strict v2 subtype contract.
    'FoodEstablishment',
    'HealthAndBeautyBusiness',
    'HomeAndConstructionBusiness',
    'AutomotiveBusiness',
    'FinancialService',
])

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function nonEmptyString(value: unknown, label: string): string {
    expect(typeof value, `${label} must be a string`).toBe('string')
    const normalized = (value as string).trim()
    expect(normalized, `${label} must be non-empty`).not.toBe('')
    return normalized
}

function finiteNumber(value: unknown, label: string): number {
    expect(typeof value, `${label} must be a number`).toBe('number')
    expect(Number.isFinite(value), `${label} must be finite`).toBe(true)
    return value as number
}

function extractScriptPayloads(rawHtml: string): unknown[] {
    const payloads: unknown[] = []
    const pattern = /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/giu

    for (const match of rawHtml.matchAll(pattern)) {
        expect(match[1], 'JSON-LD script content must not be empty').toBeTruthy()
        payloads.push(JSON.parse(match[1]))
    }
    return payloads
}

function collectJsonLdNodes(value: unknown): JsonLdNode[] {
    if (Array.isArray(value)) return value.flatMap(collectJsonLdNodes)
    if (!isRecord(value)) return []
    if (Array.isArray(value['@graph'])) return value['@graph'].flatMap(collectJsonLdNodes)
    return [value]
}

function isLocalBusinessNode(node: JsonLdNode): boolean {
    const rawType = node['@type']
    const types = typeof rawType === 'string'
        ? [rawType]
        : (Array.isArray(rawType) ? rawType.filter((value): value is string => typeof value === 'string') : [])
    return types.some(type => LOCAL_BUSINESS_TYPE_NAMES.has(type))
}

function expectNoAggregateRating(value: unknown): void {
    if (Array.isArray(value)) {
        value.forEach(expectNoAggregateRating)
        return
    }
    if (!isRecord(value)) return
    expect(value).not.toHaveProperty('aggregateRating')
    Object.values(value).forEach(expectNoAggregateRating)
}

async function discoverFixture(browser: Browser, baseURL: string | undefined): Promise<FixtureSite> {
    const context = await browser.newContext({ storageState: AUTH_FILE, baseURL })
    try {
        const page = await context.newPage()
        await page.goto('/dashboard', { waitUntil: 'domcontentloaded' })
        const editorHrefs = await page.locator('a[href*="/editor/"]').evaluateAll(links =>
            links.map(link => link.getAttribute('href')).filter((href): href is string => Boolean(href)),
        )
        const siteIds = [...new Set(editorHrefs.flatMap(href => {
            const match = href.match(/\/editor\/(\d+)/)
            return match ? [match[1]] : []
        }))]
        expect(siteIds, 'E2E account must own exactly one site').toHaveLength(1)

        const siteId = siteIds[0]
        const editorResponse = await context.request.get(`/api/sites/${siteId}/editor-data`)
        expect(editorResponse.ok(), 'editor-data preflight must succeed').toBe(true)
        const editorPayload: unknown = await editorResponse.json()
        expect(isRecord(editorPayload) && isRecord(editorPayload.site), 'editor-data must contain site').toBe(true)
        const site = (editorPayload as { site: Record<string, unknown> }).site
        const localBusiness = isRecord(site.localBusiness) ? site.localBusiness : {}
        const contactInfo = isRecord(site.contactInfo) ? site.contactInfo : {}

        expect(site.status, 'fixture site must be published').toBe('published')
        const tenantSlug = nonEmptyString(site.tenantSlug, 'tenantSlug')
        expect(localBusiness.businessCategory).toBe('foodEstablishment')
        expect(localBusiness.schemaSubtype).toBe('Restaurant')

        const openingHours = Array.isArray(localBusiness.openingHours) ? localBusiness.openingHours : []
        expect(openingHours.some(row => (
            isRecord(row) && row.isClosed !== true && isValidOpeningTimeRange(row.opens, row.closes)
        )), 'fixture requires at least one complete open-hours row').toBe(true)

        const pagesResponse = await context.request.get(`/api/sites/${siteId}/pages`)
        expect(pagesResponse.ok(), 'pages preflight must succeed').toBe(true)
        const pagesPayload: unknown = await pagesResponse.json()
        const pages = isRecord(pagesPayload) && Array.isArray(pagesPayload.pages) ? pagesPayload.pages : []
        const subpage = pages.find(pageDocument => (
            isRecord(pageDocument)
            && pageDocument.isHomepage !== true
            && pageDocument.status === 'published'
            && typeof pageDocument.slug === 'string'
            && pageDocument.slug.trim() !== ''
        ))

        return {
            id: siteId,
            tenantSlug,
            storefrontPath: `/sites/${encodeURIComponent(tenantSlug)}`,
            name: nonEmptyString(site.name, 'site name'),
            phone: nonEmptyString(contactInfo.phone, 'phone'),
            schemaSubtype: nonEmptyString(localBusiness.schemaSubtype, 'schemaSubtype'),
            streetAddress: nonEmptyString(localBusiness.streetAddress, 'streetAddress'),
            city: nonEmptyString(localBusiness.city, 'city'),
            postcode: nonEmptyString(localBusiness.postcode, 'postcode'),
            country: nonEmptyString(localBusiness.country, 'country'),
            latitude: finiteNumber(localBusiness.latitude, 'latitude'),
            longitude: finiteNumber(localBusiness.longitude, 'longitude'),
            subpageSlug: isRecord(subpage) ? nonEmptyString(subpage.slug, 'subpage slug') : null,
        }
    } finally {
        await context.close()
    }
}

test.describe('[TC-F37-02-45] published storefront JSON-LD acceptance', () => {
    let fixture: FixtureSite | null = null

    test.beforeAll(async ({ browser, baseURL }) => {
        if (!hasE2EAccount) {
            if (process.env.CI) throw new Error(localSkipReason)
            return
        }
        fixture = await discoverFixture(browser, baseURL)
    })

    test('emits one strict LocalBusiness and one Organization without unsafe or duplicate markup', async ({ page, request }) => {
        test.skip(!fixture, localSkipReason)

        // Arrange — beforeAll discovered and validated the sole account site.

        // Act
        const response = await request.get(fixture!.storefrontPath)
        await page.goto(fixture!.storefrontPath, { waitUntil: 'domcontentloaded' })

        // Assert
        expect(response.ok(), 'public storefront raw response must succeed').toBe(true)
        const rawHtml = await response.text()
        expect(rawHtml).not.toContain('id="f37-jsonld-sentinel"')
        const payloads = extractScriptPayloads(rawHtml)
        expect(payloads.length, 'storefront must render JSON-LD scripts').toBeGreaterThan(0)
        payloads.forEach(expectNoAggregateRating)
        const nodes = payloads.flatMap(collectJsonLdNodes)
        const canonicalHref = nonEmptyString(
            await page.locator('link[rel="canonical"]').getAttribute('href'),
            'canonical URL',
        )
        const canonicalUrl = new URL(canonicalHref)
        expect(canonicalUrl.pathname, 'homepage canonical must not target a subpage').toBe('/')
        expect(canonicalUrl.search, 'homepage canonical must not contain a query').toBe('')
        expect(canonicalUrl.hash, 'homepage canonical must not contain a fragment').toBe('')
        const canonicalOrigin = canonicalUrl.origin

        const localBusinesses = nodes.filter(isLocalBusinessNode)
        expect(localBusinesses, 'homepage must contain one LocalBusiness node').toHaveLength(1)
        const localBusiness = localBusinesses[0]
        expect(localBusiness['@type']).toBe(fixture!.schemaSubtype)
        expect(localBusiness.name).toBe(fixture!.name)
        expect(localBusiness.telephone).toBe(fixture!.phone)
        const localBusinessUrl = nonEmptyString(localBusiness.url, 'LocalBusiness URL')
        expect(normalizeHttpUrl(localBusinessUrl)).toBe(localBusinessUrl)
        expect(localBusinessUrl).toBe(canonicalOrigin)
        expect(typeof localBusiness.priceRange).toBe('string')
        expect((localBusiness.priceRange as string).trim()).not.toBe('')

        expect(isRecord(localBusiness.address)).toBe(true)
        expect(localBusiness.address).toMatchObject({
            '@type': 'PostalAddress',
            streetAddress: fixture!.streetAddress,
            addressLocality: fixture!.city,
            postalCode: fixture!.postcode,
            addressCountry: fixture!.country,
        })
        expect(isRecord(localBusiness.geo)).toBe(true)
        expect(localBusiness.geo).toMatchObject({
            '@type': 'GeoCoordinates',
            latitude: fixture!.latitude,
            longitude: fixture!.longitude,
        })
        expect(Array.isArray(localBusiness.openingHoursSpecification)).toBe(true)
        expect((localBusiness.openingHoursSpecification as unknown[]).length).toBeGreaterThan(0)

        const organizations = nodes.filter(node => node['@type'] === 'Organization')
        expect(organizations, 'homepage must contain one Organization node').toHaveLength(1)
        expect(organizations[0].name).toBe(fixture!.name)
        const organizationUrl = nonEmptyString(organizations[0].url, 'Organization URL')
        expect(normalizeHttpUrl(organizationUrl)).toBe(organizationUrl)
        expect(organizationUrl).toBe(canonicalOrigin)

        expect(await page.locator('script[type="application/ld+json"]').count()).toBe(payloads.length)
        expect(await page.locator('#f37-jsonld-sentinel').count()).toBe(0)
        expect(await page.evaluate(() => Object.prototype.hasOwnProperty.call(window, '__f37JsonLdSentinel'))).toBe(false)
    })

    test('does not duplicate LocalBusiness on a published subpage', async ({ request }) => {
        test.skip(!fixture, localSkipReason)
        if (!fixture!.subpageSlug && process.env.CI) {
            throw new Error('The sole E2E site requires one published subpage')
        }
        test.skip(!fixture!.subpageSlug, 'The sole E2E site has no published subpage')

        // Arrange
        const subpagePath = fixture!.subpageSlug!.replace(/^\/+/, '')
        // Act
        const response = await request.get(`${fixture!.storefrontPath}/${subpagePath}`)
        // Assert
        expect(response.ok(), 'public subpage response must succeed').toBe(true)
        const payloads = extractScriptPayloads(await response.text())
        const localBusinesses = payloads.flatMap(collectJsonLdNodes).filter(isLocalBusinessNode)
        expect(localBusinesses.length, 'subpage must not duplicate LocalBusiness').toBeLessThanOrEqual(1)
    })
})
