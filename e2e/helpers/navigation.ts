import { type Page } from '@playwright/test'

/**
 * Navigate to a page and wait for full load.
 */
export async function navigateTo(page: Page, path: string) {
    await page.goto(path)
    await page.waitForLoadState('networkidle')
}

/**
 * Wait for redirect to dashboard (after login/OTP).
 */
export async function waitForDashboard(page: Page) {
    await page.waitForURL(url => {
        const p = url.pathname
        return p.includes('/dashboard') || p.includes('/builder') || p.includes('/onboarding')
    }, { timeout: 20_000 })
}

/**
 * Get first siteId from the sites page by extracting from site card editor links.
 * Falls back to /dashboard if /sites yields nothing.
 * Returns null if no sites found.
 */
export async function getFirstSiteId(page: Page): Promise<string | null> {
    for (const path of ['/sites', '/dashboard']) {
        await navigateTo(page, path)

        const editorLinks = page.locator('a[href*="/editor/"]')
        const count = await editorLinks.count()
        if (count === 0) continue

        const href = await editorLinks.first().getAttribute('href')
        if (!href) continue

        const match = href.match(/\/editor\/(\d+)/)
        if (match) return match[1]
    }
    return null
}

/**
 * Get first site slug from dashboard site cards.
 * Returns null if no sites found.
 */
export async function getFirstSiteSlug(page: Page): Promise<string | null> {
    await navigateTo(page, '/dashboard')

    // Look for site links containing /sites/
    const siteLinks = page.locator('a[href*="/sites/"]')
    const count = await siteLinks.count()
    if (count === 0) return null

    const href = await siteLinks.first().getAttribute('href')
    if (!href) return null

    const match = href.match(/\/sites\/([^/]+)/)
    return match ? match[1] : null
}
