import { expect, test } from '@playwright/test'

const source = process.env.E2E_STOREFRONT_SCROLL_SOURCE
const target = process.env.E2E_STOREFRONT_SCROLL_TARGET

test('new storefront page opens at the top after scrolling the previous page', async ({ page }) => {
    test.skip(!source || !target, 'Provide two published pages from the same storefront')
    await page.goto(source!, { waitUntil: 'networkidle' })
    const link = page.locator(`a[href="${target}"]`).first()
    await expect(link).toBeAttached()
    await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }))
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(100)

    // Activate the real link without Playwright scrolling it into view first.
    await link.evaluate((element: HTMLAnchorElement) => element.click())

    await expect(page).toHaveURL(new RegExp(`${target}$`))
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0)
})
