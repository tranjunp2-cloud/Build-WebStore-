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
        await expect(page).toHaveTitle(/Web Store|Login/i)
        await expect(page.locator('input[type="email"], input[name="email"]')).toBeVisible()
        await expect(page.locator('#password')).toHaveAttribute('placeholder', 'Enter your password')
    })

    test('[TC-F02.20] failed login does not clear password, focuses and selects it', async ({ page }) => {
        await page.goto('/login')
        await page.fill('input[type="email"], input[name="email"]', 'invalid-user@primeweb.app')
        await page.fill('#password', 'wrongpassword')
        await page.click('button[type="submit"]')

        const passwordInput = page.locator('#password')
        
        // Wait for input to be focused after error
        await expect(passwordInput).toBeFocused()

        // Verify password input value is still 'wrongpassword' (not cleared)
        const passwordValue = await passwordInput.inputValue()
        expect(passwordValue).toBe('wrongpassword')

        // Verify password selection is fully highlighted
        const selectionRange = await passwordInput.evaluate((el: HTMLInputElement) => {
            return { start: el.selectionStart, end: el.selectionEnd }
        })
        expect(selectionRange.start).toBe(0)
        expect(selectionRange.end).toBe('wrongpassword'.length)
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
