import { expect, test } from '@playwright/test'

// [TC-F09.38] Mobile PDP sticky add-to-cart bar. Reuses an existing published PDP URL; skipped when absent.
const pdpUrl = process.env.E2E_STOREFRONT_PDP_URL

test.describe('[TC-F09.38] PDP sticky add-to-cart bar', () => {
    test.skip(!pdpUrl, 'Provide a published product page URL (E2E_STOREFRONT_PDP_URL)')

    test('mobile: bar stays fixed at the bottom after scrolling past the inline button', async ({ page }) => {
        await page.setViewportSize({ width: 375, height: 812 })
        await page.goto(pdpUrl!, { waitUntil: 'networkidle' })
        await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }))
        const bar = page.getByTestId('pd-sticky-add-to-cart')
        await expect(bar).toBeVisible()
        const box = await bar.boundingBox()
        expect(box).not.toBeNull()
        expect(Math.round(box!.y + box!.height)).toBe(812)
    })

    test('desktop: bar is not rendered visible', async ({ page }) => {
        await page.setViewportSize({ width: 1280, height: 800 })
        await page.goto(pdpUrl!, { waitUntil: 'networkidle' })
        await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }))
        await expect(page.getByTestId('pd-sticky-add-to-cart')).toBeHidden()
    })
})
