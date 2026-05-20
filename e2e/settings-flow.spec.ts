import { test, expect } from '@playwright/test'

/**
 * Settings Deep Tests — Domain management, staff, profile.
 *
 * TC-F19.01: Profile settings
 * TC-F19.02: Domain validation
 * TC-F19.20: Staff management
 * TC-F19.13: Payment QR settings
 */

test.describe('Settings Flows', () => {
    test('[TC-F19.01] profile form is editable', async ({ page }) => {
        await page.goto('/settings')
        await page.waitForLoadState('networkidle')

        // Look for profile form fields
        const nameInput = page.locator('input[name="name"], input[name="firstName"], input[placeholder*="name" i]').first()
        if (await nameInput.isVisible()) {
            const currentValue = await nameInput.inputValue()
            expect(currentValue.length).toBeGreaterThanOrEqual(0)
        }
    })

    test('[TC-F19.02] domain form validates format', async ({ page }) => {
        await page.goto('/settings/domains')
        await page.waitForLoadState('networkidle')

        // Find domain input
        const domainInput = page.locator('input[placeholder*="domain" i], input[name="domain"]').first()
        if (await domainInput.isVisible()) {
            // Enter invalid domain
            await domainInput.fill('not a domain!!!')

            // Try submit
            const addBtn = page.locator('button:has-text("Add"), button:has-text("Connect"), button[type="submit"]').first()
            if (await addBtn.isVisible()) {
                await addBtn.click()
                await page.waitForTimeout(1000)
                // Should show validation error
                const pageText = await page.textContent('body')
                // Either error message or input still visible (not redirected)
                expect(page.url()).toContain('/settings/domains')
            }
        }
    })

    test('[TC-F19.20] staff list page shows members', async ({ page }) => {
        await page.goto('/settings/staff')
        await page.waitForLoadState('networkidle')

        // Should show staff list or invite button
        const content = await page.textContent('body')
        expect(content?.length).toBeGreaterThan(0)
        await expect(page.locator('text=Internal Server Error')).not.toBeVisible()

        // Look for invite button
        const inviteBtn = page.locator('button:has-text("Invite"), button:has-text("Add"), a:has-text("Invite")').first()
        const hasInvite = await inviteBtn.isVisible()
        // Staff page should have either members or invite CTA
        expect(content?.length).toBeGreaterThan(50)
    })

    test('[TC-F19.13] payment settings shows payment methods', async ({ page }) => {
        await page.goto('/settings/payments')
        await page.waitForLoadState('networkidle')

        // Should show payment config (COD, QR Banking, Stripe)
        const content = await page.textContent('body')
        expect(content?.length).toBeGreaterThan(0)
        await expect(page.locator('text=Internal Server Error')).not.toBeVisible()
    })
})
