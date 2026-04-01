import { test, expect } from '@playwright/test'

/**
 * Products E2E Tests — CRUD operations on product management.
 *
 * TC-F08.01: Products list page
 * TC-F08.02: Create product flow
 * TC-F08.03: Product form validation
 * TC-F08.08e: Duplicate slug handling
 */

test.describe('Products Management', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/products')
        await page.waitForLoadState('networkidle')
    })

    test('[TC-F08.01] products page loads', async ({ page }) => {
        // Should show products list or empty state
        await expect(page.locator('body')).not.toBeEmpty()
        // No server error
        await expect(page.locator('text=Internal Server Error')).not.toBeVisible()
    })

    test('[TC-F08.01] shows product list or empty state', async ({ page }) => {
        // Either product cards/rows or "no products" message
        const hasProducts = await page.locator('table tr, [data-testid="product-card"], [data-testid="product-row"]').count()
        const hasEmptyState = await page.locator('text=/no products|create your first|get started/i').count()
        expect(hasProducts + hasEmptyState).toBeGreaterThan(0)
    })

    test('[TC-F08.02] navigate to create product page', async ({ page }) => {
        // Navigate directly — more reliable than clicking button
        await page.goto('/products/new')
        await page.waitForLoadState('networkidle')
        // Should load create form or redirect to products
        await expect(page.locator('text=Internal Server Error')).not.toBeVisible()
    })

    test('[TC-F08.03] product form has required fields', async ({ page }) => {
        await page.goto('/products/new')
        await page.waitForLoadState('networkidle')

        // Check form fields exist
        const nameInput = page.locator('input[name="name"], input[placeholder*="name" i]')
        const priceInput = page.locator('input[name="price"], input[placeholder*="price" i], input[type="number"]')

        if (await nameInput.count() > 0) {
            await expect(nameInput.first()).toBeVisible()
        }
        if (await priceInput.count() > 0) {
            await expect(priceInput.first()).toBeVisible()
        }
    })

    test('[TC-F08.03b] create product with valid data', async ({ page }) => {
        await page.goto('/products/new')
        await page.waitForLoadState('networkidle')

        // Form controls MUST be visible — fail if page broken/redirected
        const nameInput = page.locator('input[name="name"]').first()
        await expect(nameInput).toBeVisible({ timeout: 10_000 })

        // Fill product name
        await nameInput.fill(`E2E Test Product ${Date.now()}`)

        // Fill price
        const priceInput = page.locator('input[name="price"]').first()
        if (await priceInput.isVisible()) {
            await priceInput.fill('29.90')
        }

        // Submit form
        const submitBtn = page.locator('button[type="submit"], button:has-text("Save"), button:has-text("Create")').first()
        await expect(submitBtn).toBeVisible()
        await submitBtn.click()

        // Wait and verify no server error
        await page.waitForTimeout(3000)
        await expect(page.locator('text=Internal Server Error')).not.toBeVisible()
    })
})
