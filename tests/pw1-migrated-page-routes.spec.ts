import { test, expect } from '@playwright/test'

// Local migration pilot fixture: published store 253, including bare stored slugs.
test('[TC-F35.M27] migrated navigation opens published subpages anonymously', async ({ page }) => {
    await page.context().clearCookies()
    const root = 'http://localhost:3000/sites/pw1-253'
    for (const path of ['about-us', 'product-service', 'contact-us']) {
        const home = await page.goto(root)
        expect(home?.status()).toBe(200)
        const link = page.locator(`a[href="/sites/pw1-253/${path}"]`).filter({ visible: true }).first()
        await expect(link).toBeVisible()
        await link.click()
        await expect(page).toHaveURL(`${root}/${path}`)
        // Reload exercises the server lookup, rather than only client navigation.
        const response = await page.reload()
        expect(response?.status()).toBe(200)
    }
})
