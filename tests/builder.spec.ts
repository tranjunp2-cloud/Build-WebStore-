import { test, expect } from '@playwright/test'

test.describe('Builder Flow', () => {
    const email = `builder-${Date.now()}@example.com`
    const password = 'Password@123'

    test.beforeEach(async ({ page }) => {
        // Register a new test user for the builder test
        await page.goto('/register')
        await page.fill('#firstName', 'Builder')
        await page.fill('#lastName', 'User')
        await page.fill('#email', email)
        await page.fill('#password', password)
        await page.fill('#confirmPassword', password)
        await page.click('button:has-text("Create account")')
        await page.waitForURL(/\/onboarding|\/login/)

        // Login explicitly to ensure session is active
        await page.goto('/login')
        await page.fill('#email', email)
        await page.fill('#password', password)
        await page.click('button:has-text("Sign in")')
        await page.waitForURL(/\/dashboard|\/onboarding/)
    })

    test('should open editor and generate site', async ({ page }) => {
        await page.goto('/builder/new')

        // Fill business name
        await page.locator('input[placeholder*="The Coffee House"]').fill('E2E Tech Startup')

        // Select industry (Tech / IT / SaaS)
        await page.click('button:has-text("Tech")')

        // Products / Services
        await page.locator('textarea[placeholder*="coffee,"]').fill('SaaS products, Web Applications')

        // Click Continue
        await page.click('button:has-text("Continue")')

        // Wait for generation to start or finish.
        // During streaming, we should see "Creating website..." or loader.
        const loaderOrSuccess = page.locator('text=Creating website...|Website created successfully')
        await expect(loaderOrSuccess).toBeVisible({ timeout: 15000 })
    })
})
