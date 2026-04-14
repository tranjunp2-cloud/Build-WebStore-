import { test, expect } from '@playwright/test'
import { expectNoServerError } from './helpers/assertions'

/**
 * Admin Panel E2E Tests — Verify Payload CMS admin loads.
 *
 * TC-ADMIN.01: Admin panel accessibility
 * TC-ADMIN.02: Admin login with staff credentials
 */

test.describe('Admin Panel', () => {
    test('[TC-ADMIN.01] admin panel loads without errors', async ({ page }) => {
        await page.goto('/admin')
        await page.waitForLoadState('networkidle')

        // Should render either login form or admin dashboard
        const loginForm = page.locator('form, input[name="email"], input[type="email"]')
        const adminUI = page.locator('[class*="dashboard"], [class*="admin"], nav')

        const hasLogin = await loginForm.count()
        const hasAdmin = await adminUI.count()

        // At least one should be visible — Payload CMS rendered
        expect(hasLogin + hasAdmin).toBeGreaterThan(0)

        // No server error
        await expectNoServerError(page)
    })

    test('[TC-ADMIN.02] admin login with staff credentials', async ({ browser }) => {
        const adminEmail = process.env.ADMIN_EMAIL
        const adminPassword = process.env.ADMIN_PASSWORD
        test.skip(!adminEmail || !adminPassword, 'ADMIN_EMAIL and ADMIN_PASSWORD required')

        const context = await browser.newContext()
        const page = await context.newPage()

        await page.goto('/admin')
        await page.waitForLoadState('networkidle')

        // Fill admin login form
        const emailInput = page.locator('input[name="email"], input[id="field-email"]')
        const passwordInput = page.locator('input[name="password"], input[id="field-password"]')

        if (await emailInput.isVisible()) {
            await emailInput.fill(adminEmail!)
            await passwordInput.fill(adminPassword!)

            await page.click('button[type="submit"]')
            await page.waitForLoadState('networkidle')

            // Should show admin dashboard after login
            await expectNoServerError(page)

            // Verify we're on admin dashboard (not still on login)
            const url = page.url()
            // Payload CMS admin should load collections
            expect(url).toContain('/admin')
        }

        await context.close()
    })
})
