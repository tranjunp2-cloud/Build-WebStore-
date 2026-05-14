import { test, expect } from '@playwright/test'

/**
 * Settings E2E Tests — Store configuration pages.
 *
 * TC-F19.01: Settings page loads
 * TC-F19.02: Domain management
 * TC-F19.20: Staff management
 * TC-F19.29: Staff table header has border separator (BUG-985)
 * TC-F13.03: Payment settings
 */

test.describe('Settings', () => {
    test('[TC-F19.01] settings page loads', async ({ page }) => {
        await page.goto('/settings')
        await page.waitForLoadState('networkidle')

        await expect(page.locator('body')).not.toBeEmpty()
        await expect(page.locator('text=Internal Server Error')).not.toBeVisible()
    })

    test('[TC-F19.02] domains settings page loads', async ({ page }) => {
        await page.goto('/settings/domains')
        await page.waitForLoadState('networkidle')

        await expect(page.locator('body')).not.toBeEmpty()
    })

    test('[TC-F19.20] staff settings page loads', async ({ page }) => {
        await page.goto('/settings/staff')
        await page.waitForLoadState('networkidle')

        await expect(page.locator('body')).not.toBeEmpty()
    })

    test('[TC-F19.29] staff table header cells have border separator (regression BUG-985)', async ({ page }) => {
        await page.goto('/settings/staff')
        await page.waitForLoadState('networkidle')

        const headerCells = page.locator('table thead th')
        // Table must be present — fail fast if staff table didn't render
        await expect(headerCells).not.toHaveCount(0)
        // Verify border-bottom inline style applied to th (not relying on Tailwind divide utility)
        await expect(headerCells.first()).toHaveCSS('border-bottom-style', 'solid')
    })

    test('[TC-F13.03] payment settings page loads', async ({ page }) => {
        await page.goto('/settings/payments')
        await page.waitForLoadState('networkidle')

        await expect(page.locator('body')).not.toBeEmpty()
    })
})
