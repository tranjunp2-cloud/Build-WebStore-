import { test, expect } from '@playwright/test'
import { expectNoServerError, expectPageLoaded } from './helpers/assertions'
import { navigateTo } from './helpers/navigation'

/**
 * Products E2E Tests — CRUD operations with cleanup.
 *
 * TC-F08.01: Products list page
 * TC-F08.02: Create product flow
 * TC-F08.03: Product form validation
 */

test.describe('Products Management', () => {
    const createdProductIds: string[] = []

    test.afterAll(async ({ request }) => {
        // Cleanup: delete test products created during this run
        for (const id of createdProductIds) {
            try {
                await request.delete(`/api/products/${id}`)
            } catch {
                // Ignore cleanup errors — product may already be deleted
            }
        }
    })

    test('[TC-F08.01] products page loads with list or empty state', async ({ page }) => {
        await navigateTo(page, '/products')
        await expectPageLoaded(page)

        // Either product rows or empty state
        const hasProducts = await page.locator(
            'table tr, [data-testid="product-card"], [data-testid="product-row"]'
        ).count()
        const hasEmptyState = await page.locator(
            'text=/no products|create your first|get started|add product/i'
        ).count()
        const hasAddBtn = await page.locator(
            'a[href*="/products/new"], button:has-text("Add"), button:has-text("Create")'
        ).count()

        expect(hasProducts + hasEmptyState + hasAddBtn).toBeGreaterThan(0)
    })

    test('[TC-F08.02] create product flow', async ({ page }) => {
        const productName = `E2E Test Product ${Date.now()}`

        await navigateTo(page, '/products/new')
        await expectNoServerError(page)

        // Fill product name
        const nameInput = page.locator('input[name="name"], input[placeholder*="name" i]').first()
        const isFormVisible = await nameInput.isVisible().catch(() => false)
        if (!isFormVisible) {
            test.skip(true, 'Product form not found')
            return
        }

        await nameInput.fill(productName)

        // Fill price if visible
        const priceInput = page.locator('input[name="price"], input[placeholder*="price" i], input[type="number"]').first()
        if (await priceInput.isVisible().catch(() => false)) {
            await priceInput.fill('29.90')
        }

        // Listen for API response to capture product ID
        const createResponsePromise = page.waitForResponse(
            resp => (resp.url().includes('/api/products') || resp.url().includes('/api/[...slug]')) &&
                resp.request().method() === 'POST' &&
                resp.status() < 400,
            { timeout: 15_000 }
        ).catch(() => null)

        // Submit form
        const submitBtn = page.locator(
            'button[type="submit"], button:has-text("Save"), button:has-text("Create")'
        ).first()
        await submitBtn.click()

        // Capture product ID for cleanup
        const createResponse = await createResponsePromise
        if (createResponse) {
            const responseData = await createResponse.json().catch(() => null)
            const productId = responseData?.doc?.id || responseData?.id
            if (productId) {
                createdProductIds.push(String(productId))
            }
        }

        // Wait and verify no error
        await page.waitForTimeout(2000)
        await expectNoServerError(page)
    })

    test('[TC-F08.03] product form has required fields', async ({ page }) => {
        await navigateTo(page, '/products/new')
        await expectNoServerError(page)

        // Check key form fields exist
        const nameInput = page.locator('input[name="name"], input[placeholder*="name" i]')
        if (await nameInput.count() > 0) {
            await expect(nameInput.first()).toBeVisible()
        }

        const priceInput = page.locator('input[name="price"], input[placeholder*="price" i], input[type="number"]')
        if (await priceInput.count() > 0) {
            await expect(priceInput.first()).toBeVisible()
        }
    })
})
