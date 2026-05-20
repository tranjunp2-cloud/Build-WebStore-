import { test, expect } from '@playwright/test'

/**
 * Smoke Tests — Verify critical pages load without errors.
 * Run on every staging deploy to catch server-side crashes.
 *
 * TC-F03.01: Dashboard loads
 * TC-F02.01: Login page renders
 */

test.describe('Smoke Tests', () => {
    test('[TC-F02.01] login page loads', async ({ page }) => {
        await page.goto('/login')
        await expect(page).toHaveTitle(/PrimeWeb|Login/i)
        await expect(page.locator('input[type="email"], input[name="email"]')).toBeVisible()
    })

    test('[TC-F03.01] dashboard loads after auth', async ({ page }) => {
        await page.goto('/dashboard')

        // Should either show dashboard content or redirect to login
        const url = page.url()
        if (url.includes('/login')) {
            await expect(page.locator('input[type="email"]')).toBeVisible()
        } else {
            await expect(page.locator('body')).not.toBeEmpty()
        }
    })

    test('homepage loads', async ({ page }) => {
        await page.goto('/')
        const title = await page.title()
        expect(title.length).toBeGreaterThan(0)
    })

    test('[TC-F02.01] register page loads', async ({ page }) => {
        await page.goto('/register')
        await expect(page.locator('body')).not.toBeEmpty()
    })

    test('API health check responds', async ({ request }) => {
        const response = await request.get('/api/health')
        expect(response.ok()).toBeTruthy()
    })
})
