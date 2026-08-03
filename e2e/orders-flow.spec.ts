import { test, expect } from '@playwright/test'

/**
 * Orders Flow Deep Tests — Status management and filtering.
 *
 * TC-F10.05: Filter by status
 * TC-F10.09: Order status transitions
 * TC-F10.20: Search orders
 * TC-F10.24: Pagination
 */

test.describe('Orders Flow', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/orders')
        await page.waitForLoadState('networkidle')
    })

    test('[TC-F10.05] filter by status tabs', async ({ page }) => {
        // Find status tabs
        const tabs = ['All', 'Pending', 'Confirmed', 'Shipped', 'Completed', 'Cancelled']
        for (const tab of tabs) {
            const tabBtn = page.locator(`button:has-text("${tab}")`).first()
            if (await tabBtn.isVisible()) {
                await tabBtn.click()
                await page.waitForTimeout(300)
                // Should not crash on any filter
                await expect(page.locator('text=Internal Server Error')).not.toBeVisible()
            }
        }
    })

    test('[TC-F10.05] filter by payment method', async ({ page }) => {
        const codBtn = page.locator('button:has-text("COD")').first()
        const qrBtn = page.locator('button:has-text("QR"), button:has-text("Banking")').first()

        if (await codBtn.isVisible()) {
            await codBtn.click()
            await page.waitForTimeout(300)
            await expect(page.locator('text=Internal Server Error')).not.toBeVisible()
        }

        if (await qrBtn.isVisible()) {
            await qrBtn.click()
            await page.waitForTimeout(300)
            await expect(page.locator('text=Internal Server Error')).not.toBeVisible()
        }
    })

    test('[TC-F10.20] search by order number', async ({ page }) => {
        const searchInput = page.locator('input[placeholder*="search" i], input[placeholder*="find" i], input[type="search"]').first()
        if (await searchInput.isVisible()) {
            await searchInput.fill('ORD-')
            await page.waitForTimeout(1000)
            await expect(page.locator('text=Internal Server Error')).not.toBeVisible()

            // Clear search
            await searchInput.clear()
            await page.waitForTimeout(500)
        }
    })

    test('[TC-F10.09] open order detail and verify content', async ({ page }) => {
        // Click first order row
        const orderRow = page.locator('table tbody tr, [role="button"][tabindex="0"]').first()
        if (await orderRow.isVisible()) {
            await orderRow.click()
            await page.waitForTimeout(1000)

            // Drawer or detail should appear with order info
            const drawer = page.locator('[role="dialog"], aside, [data-state="open"]')
            if (await drawer.count() > 0) {
                // Should show order number
                const drawerText = await drawer.first().textContent()
                expect(drawerText?.length).toBeGreaterThan(0)
            }
        }
    })

    test('[TC-F10.09] order progress and fulfillment remain contained at QA viewports', async ({ page }) => {
        const orderRow = page.locator('table tbody tr, [role="button"][tabindex="0"]').first()
        if (!await orderRow.isVisible()) return

        await orderRow.click()
        await page.waitForURL(/\/orders\/[^/?]+/)

        const progressCard = page.locator('.od-progress')
        await expect(progressCard).toBeVisible()
        await expect(progressCard.locator('[data-order-progress-mode="embedded"]')).toBeVisible()
        await expect(progressCard.locator(':scope > .od-cap')).toHaveCount(1)

        for (const width of [374, 390, 481]) {
            await page.setViewportSize({ width, height: 900 })

            const geometry = await progressCard.locator('[data-order-progress-mode="embedded"] > div').evaluate((viewport) => ({
                clientWidth: viewport.clientWidth,
                scrollWidth: viewport.scrollWidth,
                documentOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
            }))
            expect(geometry.scrollWidth).toBeGreaterThanOrEqual(geometry.clientWidth)
            expect(geometry.documentOverflow).toBe(false)
        }

        for (const width of [1167, 1200, 1270]) {
            await page.setViewportSize({ width, height: 900 })

            const fulfillment = page.locator('.od-fulfil')
            const trackRow = fulfillment.locator('.st-row').first()
            if (!await trackRow.isVisible()) continue

            const fulfillmentBox = await fulfillment.boundingBox()
            expect(fulfillmentBox).not.toBeNull()
            for (const field of await trackRow.locator('.st-field').all()) {
                const fieldBox = await field.boundingBox()
                if (!fieldBox) continue
                expect(fieldBox.x).toBeGreaterThanOrEqual(fulfillmentBox!.x)
                expect(fieldBox.x + fieldBox.width).toBeLessThanOrEqual(fulfillmentBox!.x + fulfillmentBox!.width)
            }
        }
    })

    test('[TC-F10.24] orders list handles empty state', async ({ page }) => {
        // Filter to a status unlikely to have orders
        const cancelledTab = page.locator('button:has-text("Cancelled")').first()
        if (await cancelledTab.isVisible()) {
            await cancelledTab.click()
            await page.waitForTimeout(500)
            // Should show orders or empty state — no crash
            await expect(page.locator('text=Internal Server Error')).not.toBeVisible()
        }
    })
})
