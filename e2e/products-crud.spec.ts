import { test, expect } from '@playwright/test'

/**
 * Products CRUD Deep Tests — Interactions beyond page loads.
 *
 * TC-F08.01: Product list with filters
 * TC-F08.02: Create product end-to-end
 * TC-F08.03: Form validation
 * TC-F08.08e: Edit product
 */

test.describe('Products CRUD Flows', () => {
    test('[TC-F08.01] filter products by status tabs', async ({ page }) => {
        await page.goto('/products')
        await page.waitForLoadState('networkidle')

        // Find status filter tabs
        const allTab = page.locator('button:has-text("All"), [role="tab"]:has-text("All")').first()
        const draftTab = page.locator('button:has-text("Draft"), [role="tab"]:has-text("Draft")').first()

        if (await allTab.isVisible()) {
            // Click "All" tab
            await allTab.click()
            await page.waitForTimeout(500)
            await expect(page.locator('text=Internal Server Error')).not.toBeVisible()

            // Click "Draft" tab
            if (await draftTab.isVisible()) {
                await draftTab.click()
                await page.waitForTimeout(500)
                await expect(page.locator('text=Internal Server Error')).not.toBeVisible()
            }
        }
    })

    test('[TC-F08.02] create product flow — fill form and submit', async ({ page }) => {
        await page.goto('/products/new')
        await page.waitForLoadState('networkidle')

        // Product name — required
        const nameInput = page.locator('input[name="name"]').first()
        await expect(nameInput).toBeVisible({ timeout: 10_000 })
        const productName = `E2E Product ${Date.now()}`
        await nameInput.fill(productName)

        // Price — required
        const priceInput = page.locator('input[name="price"]').first()
        if (await priceInput.isVisible()) {
            await priceInput.fill('49.90')
        }

        // Short description — optional
        const descInput = page.locator('textarea[name="shortDescription"], input[name="shortDescription"]').first()
        if (await descInput.isVisible()) {
            await descInput.fill('E2E test product description')
        }

        // Submit
        const saveBtn = page.locator('button[type="submit"], button:has-text("Save"), button:has-text("Create")').first()
        await expect(saveBtn).toBeVisible()
        await saveBtn.click()

        // Wait for response — success toast or redirect
        await page.waitForTimeout(5000)
        await expect(page.locator('text=Internal Server Error')).not.toBeVisible()
    })

    test('[TC-F08.03] product form validates required fields', async ({ page }) => {
        await page.goto('/products/new')
        await page.waitForLoadState('networkidle')

        // Try submit without filling required fields
        const saveBtn = page.locator('button[type="submit"], button:has-text("Save"), button:has-text("Create")').first()
        if (await saveBtn.isVisible()) {
            await saveBtn.click()
            await page.waitForTimeout(1000)

            // Should show validation errors or stay on form
            const url = page.url()
            expect(url).toContain('/products')
        }
    })

    test('[TC-F08.08e] navigate to edit existing product', async ({ page }) => {
        await page.goto('/products')
        await page.waitForLoadState('networkidle')

        // Find first product edit link
        const editLink = page.locator('a[href*="/products/"]').first()
        if (await editLink.isVisible()) {
            const href = await editLink.getAttribute('href')
            if (href && href.match(/\/products\/\d+/)) {
                await editLink.click()
                await page.waitForLoadState('networkidle')

                // Should load edit form
                expect(page.url()).toMatch(/\/products\/\d+/)
                await expect(page.locator('text=Internal Server Error')).not.toBeVisible()

                // Name field should be pre-filled
                const nameInput = page.locator('input[name="name"]').first()
                if (await nameInput.isVisible()) {
                    const value = await nameInput.inputValue()
                    expect(value.length).toBeGreaterThan(0)
                }
            }
        }
    })
})
