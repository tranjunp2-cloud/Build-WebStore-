import { expect, test, type Page } from '@playwright/test'

const PUBLISHED_SITE_PATH = process.env.E2E_F37_PUBLISHED_SITE_PATH
const UNPUBLISHED_SITE_PATH = process.env.E2E_F37_UNPUBLISHED_SITE_PATH

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

function requireStorefrontPath(name: string, value: string | undefined): string {
    if (!value?.startsWith('/sites/')) {
        throw new Error(`${name} must be a /sites/{slug} path for a stable staging fixture`)
    }
    return value.replace(/\/+$/, '')
}

function isHttpUrl(value: string): boolean {
    try {
        const url = new URL(value)
        return url.protocol === 'http:' || url.protocol === 'https:'
    } catch {
        return false
    }
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
    let publishedPath: string
    let unpublishedPath: string

    test.beforeAll(() => {
        publishedPath = requireStorefrontPath(
            'E2E_F37_PUBLISHED_SITE_PATH',
            PUBLISHED_SITE_PATH,
        )
        unpublishedPath = requireStorefrontPath(
            'E2E_F37_UNPUBLISHED_SITE_PATH',
            UNPUBLISHED_SITE_PATH,
        )
    })

    test('[TC-F37-03-28] published storefront exposes all discovery endpoints', async ({ page }) => {
        // Arrange
        const endpointPaths = {
            robots: `${publishedPath}/robots.txt`,
            sitemap: `${publishedPath}/sitemap.xml`,
            llms: `${publishedPath}/llms.txt`,
        }

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
        const publicLinks = llms.body
            .split('\n')
            .filter(line => line.startsWith('- http'))
            .map(line => line.slice(2))
        expect(publicLinks.length).toBeGreaterThan(0)
        expect(publicLinks.every(isHttpUrl)).toBe(true)
        expect(publicLinks.join('\n')).not.toMatch(/\/(?:checkout|orders|admin)(?:\/|$)/)
    })

    test('[TC-F37-03-29] unpublished storefront keeps crawler baseline but hides publish-only endpoints', async ({ page }) => {
        // Arrange
        const endpointPaths = {
            robots: `${unpublishedPath}/robots.txt`,
            sitemap: `${unpublishedPath}/sitemap.xml`,
            llms: `${unpublishedPath}/llms.txt`,
        }

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
