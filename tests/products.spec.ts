import { test, expect } from '@playwright/test'

test.describe('Products Management Flow', () => {
    const email = `product-${Date.now()}@example.com`
    const password = 'Password@123'

    test.beforeEach(async ({ page }) => {
        // Register a test user
        await page.goto('/register')
        await page.fill('#firstName', 'Prod')
        await page.fill('#lastName', 'User')
        await page.fill('#email', email)
        await page.fill('#password', password)
        await page.fill('#confirmPassword', password)
        await page.click('button:has-text("Create account")')
        await page.waitForURL(/\/onboarding|\/login/)

        // Login
        await page.goto('/login')
        await page.fill('#email', email)
        await page.fill('#password', password)
        await page.click('button:has-text("Sign in")')
        await page.waitForURL(/\/dashboard|\/onboarding/)
    })

    test('should create a new product from dashboard', async ({ page }) => {
        // Navigate to products
        await page.goto('/dashboard/products')

        // Need to click Add Product button
        // Looking for the link with text "Add Product"
        await page.click('a:has-text("Add Product")')

        // Wait to be on the new product page
        await page.waitForURL(/\/dashboard\/products\/new/)

        const productName = `E2E Product ${Date.now()}`

        // Fill product name
        await page.locator('input[placeholder*="Premium Nasi Lemak"]').fill(productName)

        // Fill price (first number input for price)
        await page.locator('input[type="number"]').first().fill('99.99')

        // Save Product
        await page.click('button:has-text("Save Product")')

        // Wait to be back at products list
        await page.waitForURL(/\/dashboard\/products$/)

        // Verify the newly created product is visible
        await expect(page.locator(`text=${productName}`)).toBeVisible({ timeout: 10000 })
    })
})
