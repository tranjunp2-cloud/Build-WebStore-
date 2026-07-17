import { expect, test } from '@playwright/test'
import { expectPageLoaded } from './helpers/assertions'
import { navigateTo } from './helpers/navigation'

test.describe('F36 EasyParcel settings — GH-1652', () => {
    test('[TC-F36.201] query parameter opens the EasyParcel tab', async ({ page }) => {
        await navigateTo(page, '/settings/shipping?tab=easyparcel')
        await expectPageLoaded(page)

        await expect(page.getByRole('tab', { name: /EasyParcel/i })).toHaveAttribute('data-state', 'active')
    })

    for (const width of [375, 390]) {
        test(`[TC-F36.206] shipping settings has no horizontal overflow at ${width}px`, async ({ page }) => {
            await page.setViewportSize({ width, height: 844 })
            await navigateTo(page, '/settings/shipping?tab=easyparcel')
            await expectPageLoaded(page)

            const hasOverflow = await page.evaluate(() => (
                document.documentElement.scrollWidth > document.documentElement.clientWidth
            ))
            expect(hasOverflow).toBe(false)
        })
    }
})
