import { expect, type Page } from '@playwright/test'

/**
 * Assert page has no server errors (500, Internal Server Error).
 * Uses title + visible text checks — does NOT grep raw body text
 * (which contains inline CSS with "500" font-weight etc).
 */
export async function expectNoServerError(page: Page) {
    await expect(page.locator('text=Internal Server Error')).not.toBeVisible()
    await expect(page.locator('text=Application error')).not.toBeVisible()
    await expect(page.locator('text=/^500$/')).not.toBeVisible()

    // Check page title for error indicators
    const title = await page.title()
    expect(title).not.toMatch(/^500:/)
    expect(title).not.toMatch(/Internal Server Error/i)
}

/**
 * Wait for page to fully load (networkidle) and verify no crash.
 */
export async function expectPageLoaded(page: Page) {
    await page.waitForLoadState('networkidle')
    await expectNoServerError(page)
    // Page should have meaningful content
    const body = await page.textContent('body')
    expect(body?.trim().length).toBeGreaterThan(0)
}

/**
 * Assert page is NOT a 404 Next.js not-found page.
 */
export async function expectNot404(page: Page) {
    const title = await page.title()
    expect(title).not.toMatch(/404:/)
    await expect(page.locator('text=This page could not be found')).not.toBeVisible()
}

/**
 * Assert current URL contains expected path.
 */
export function expectUrlContains(page: Page, path: string) {
    expect(page.url()).toContain(path)
}
