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
        test(`[TC-F36.206] shipping settings stays visible and usable at ${width}px`, async ({ page }) => {
            await page.setViewportSize({ width, height: 844 })
            await navigateTo(page, '/settings/shipping?tab=easyparcel')
            await expectPageLoaded(page)

            const activeTab = page.getByRole('tab', { name: /EasyParcel/i })
            const statePanel = page.locator('[data-easyparcel-state]').first()
            await expect(activeTab).toBeVisible()
            await expect(statePanel).toBeVisible()

            const hasOverflow = await page.evaluate(() => (
                document.documentElement.scrollWidth > document.documentElement.clientWidth
            ))
            expect(hasOverflow).toBe(false)

            for (const locator of [activeTab, statePanel]) {
                const box = await locator.boundingBox()
                expect(box).not.toBeNull()
                expect(box!.x).toBeGreaterThanOrEqual(0)
                expect(box!.x + box!.width).toBeLessThanOrEqual(width)
            }

            const visibleControls = statePanel.locator('button:visible, input:visible, [role="switch"]:visible')
            expect(await visibleControls.count()).toBeGreaterThan(0)
            for (let index = 0; index < await visibleControls.count(); index += 1) {
                const box = await visibleControls.nth(index).boundingBox()
                if (!box) continue
                expect(box.x).toBeGreaterThanOrEqual(0)
                expect(box.x + box.width).toBeLessThanOrEqual(width)
            }
        })
    }

    test('[TC-F36.206] active EasyParcel state exposes its expected primary controls', async ({ page }) => {
        await page.setViewportSize({ width: 390, height: 844 })
        await navigateTo(page, '/settings/shipping?tab=easyparcel')
        await expectPageLoaded(page)

        const statePanel = page.locator('[data-easyparcel-state]').first()
        const state = await statePanel.getAttribute('data-easyparcel-state')
        expect(['disconnected', 'setup', 'management']).toContain(state)

        if (state === 'disconnected') {
            await expect(statePanel.getByRole('button')).toBeVisible()
            const brandMark = statePanel.getByTestId('easyparcel-brand-mark')
            const box = await brandMark.boundingBox()
            expect(box).not.toBeNull()
            expect(box!.width).toBe(42)
            expect(box!.height).toBe(42)
        } else if (state === 'setup') {
            await expect(statePanel.locator('[aria-current="step"]')).toBeVisible()
            await expect(statePanel.getByRole('button', { name: /next/i })).toBeVisible()
        } else {
            await expect(statePanel.locator('[role="switch"]')).toBeVisible()
            await expect(statePanel.getByRole('button', { name: /sync/i })).toBeVisible()
            const brandMark = statePanel.getByTestId('easyparcel-brand-mark')
            const box = await brandMark.boundingBox()
            expect(box).not.toBeNull()
            expect(box!.width).toBe(42)
            expect(box!.height).toBe(42)
        }
    })
})
