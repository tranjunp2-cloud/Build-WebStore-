import { test, expect } from '@playwright/test'

/**
 * Settings E2E Tests — Store configuration pages.
 *
 * TC-F19.01: Settings page loads
 * TC-F19.02: Domain management
 * TC-F19.20: Staff management
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

    test('[TC-F13.03] payment settings page loads', async ({ page }) => {
        await page.goto('/settings/payments')
        await page.waitForLoadState('networkidle')

        await expect(page.locator('body')).not.toBeEmpty()
    })
})
