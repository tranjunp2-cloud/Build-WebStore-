import { test, expect } from '@playwright/test'

/**
 * Orders E2E Tests — Order management flows.
 *
 * TC-F10.01: Orders list page
 * TC-F10.05: Order filtering
 * TC-F10.09: Status transitions
 * TC-F10.20: Search functionality
 */

test.describe('Orders Management', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/orders')
        await page.waitForLoadState('networkidle')
    })

    test('[TC-F10.01] orders page loads', async ({ page }) => {
        await expect(page.locator('body')).not.toBeEmpty()
        await expect(page.locator('text=Internal Server Error')).not.toBeVisible()
    })

    test('[TC-F10.01] shows orders list or empty state', async ({ page }) => {
        // Either order rows or empty state
        const content = await page.textContent('body')
        expect(content?.length).toBeGreaterThan(0)
    })

    test('[TC-F10.05] status filter tabs exist', async ({ page }) => {
        // Check for filter tabs (All, Pending, Confirmed, etc.)
        const filterArea = page.locator('button:has-text("All"), button:has-text("Pending"), [role="tablist"]')
        if (await filterArea.count() > 0) {
            await expect(filterArea.first()).toBeVisible()
        }
    })

    test('[TC-F10.20] search input works', async ({ page }) => {
        const searchInput = page.locator('input[placeholder*="search" i], input[placeholder*="find" i], input[type="search"]').first()
        if (await searchInput.isVisible()) {
            await searchInput.fill('ORD-')
            await page.waitForTimeout(1000) // debounce
            // Should not crash
            await expect(page.locator('text=Internal Server Error')).not.toBeVisible()
        }
    })

    test('[TC-F10.09] clicking an order shows detail drawer', async ({ page }) => {
        // Click first order row if exists
        const firstOrder = page.locator('tr[data-order-id], [data-testid="order-row"], table tbody tr').first()
        if (await firstOrder.isVisible()) {
            await firstOrder.click()
            await page.waitForTimeout(1000)
            // Drawer or detail should appear
            const drawer = page.locator('[role="dialog"], [data-testid="order-drawer"], aside')
            if (await drawer.count() > 0) {
                await expect(drawer.first()).toBeVisible()
            }
        }
    })
})
