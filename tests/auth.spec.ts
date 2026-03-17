import { test, expect } from '@playwright/test'

test.describe('Auth Flow', () => {
    const email = `test-${Date.now()}@example.com`
    const password = 'Password@123'

    test('should register a new user and login successfully', async ({ page }) => {
        // Navigate to register
        await page.goto('/register')

        // Fill registration form
        await page.fill('#firstName', 'Test')
        await page.fill('#lastName', 'User')
        await page.fill('#email', email)
        await page.fill('#password', password)
        await page.fill('#confirmPassword', password)

        // Submit registration
        // NOTE: the button has text like 'Create account'
        await page.click('button:has-text("Create account")')

        // Wait for redirect to happen (onboarding or login)
        await page.waitForURL(/\/onboarding|\/login/)

        // Go to login page explicitly to test login flow
        await page.goto('/login')

        // Fill login form
        await page.fill('#email', email)
        await page.fill('#password', password)
        await page.click('button:has-text("Sign in")')

        // Wait for dashboard or any authenticated route
        await page.waitForURL(url => url.pathname.includes('/dashboard') || url.pathname.includes('/onboarding'))

        // Verify some content indicating login success
        // Just checking URL is enough for now
        expect(page.url()).toMatch(/\/dashboard|\/onboarding/)
    })

    test('should show error for invalid login', async ({ page }) => {
        await page.goto('/login')
        await page.fill('#email', 'invalid-nonexistent@example.com')
        await page.fill('#password', 'wrongpassword')
        await page.click('button:has-text("Sign in")')

        // Should see error message
        await expect(page.locator('text=Incorrect email or password')).toBeVisible({ timeout: 5000 })
    })
})
