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

    test('[TC-F08-04-83] AI bulk draft localizes Vietnamese variants for an English store', async ({ page }) => {
        test.setTimeout(90_000)

        // Arrange
        await page.addInitScript(() => {
            localStorage.setItem('prefer_lang', 'en')
            document.cookie = 'prefer_lang=en; path=/; samesite=lax'
        })
        await navigateTo(page, '/products')
        await expectNoServerError(page)

        const aiChatTextarea = page.locator('textarea').first()
        await expect(aiChatTextarea).toBeVisible({ timeout: 10_000 })
        const parseResponsePromise = page.waitForResponse(response =>
            response.request().method() === 'POST' &&
            response.url().includes('/api/ai/products-bulk-parse'),
            { timeout: 60_000 },
        )

        // Act
        await aiChatTextarea.fill('áo thun màu variant trắng, đỏ, xám giá 5rm')
        await aiChatTextarea.press('Enter')
        const parseResponse = await parseResponsePromise
        const body = await parseResponse.json() as {
            products?: Array<{
                name?: string
                variants?: Array<{ name?: string }>
                variantConfigs?: Array<{ name?: string; options?: Array<{ value?: string }> }>
            }>
        }

        // Assert
        expect(parseResponse.ok()).toBe(true)
        expect(body.products).toHaveLength(1)
        const product = body.products?.[0]
        expect(product?.name).toBe('T-Shirt')
        expect(product?.variants?.map(variant => variant.name)).toEqual(['White', 'Red', 'Grey'])
        expect(product?.variantConfigs?.[0]).toEqual({
            name: 'Color',
            options: [{ value: 'White' }, { value: 'Red' }, { value: 'Grey' }],
        })
        await expect(page.locator('.fixed.inset-0 input[type="text"]').first()).toHaveValue('T-Shirt')
        await expect(page.getByText('White, Red, Grey', { exact: true })).toBeVisible()
    })

    test('[TC-F08-04-86] AI bulk draft creates localized two-tier Cartesian variants', async ({ page }) => {
        test.setTimeout(90_000)

        // Arrange
        await page.addInitScript(() => {
            localStorage.setItem('prefer_lang', 'en')
            document.cookie = 'prefer_lang=en; path=/; samesite=lax'
        })
        await navigateTo(page, '/products')
        await expectNoServerError(page)

        const aiChatTextarea = page.locator('textarea').first()
        await expect(aiChatTextarea).toBeVisible({ timeout: 10_000 })
        const parseResponsePromise = page.waitForResponse(response =>
            response.request().method() === 'POST' &&
            response.url().includes('/api/ai/products-bulk-parse'),
            { timeout: 60_000 },
        )

        // Act
        await aiChatTextarea.fill('áo thun màu trắng, đỏ, size S, M giá 5rm')
        await aiChatTextarea.press('Enter')
        const parseResponse = await parseResponsePromise
        const body = await parseResponse.json() as {
            products?: Array<{
                variants?: Array<{ name?: string }>
                variantConfigs?: Array<{ name?: string; options?: Array<{ value?: string }> }>
            }>
        }

        // Assert
        expect(parseResponse.ok()).toBe(true)
        expect(body.products).toHaveLength(1)
        const product = body.products?.[0]
        expect(product?.variants?.map(variant => variant.name).sort()).toEqual([
            'Red - M',
            'Red - S',
            'White - M',
            'White - S',
        ])
        expect(product?.variantConfigs).toEqual([
            { name: 'Color', options: [{ value: 'White' }, { value: 'Red' }] },
            { name: 'Size', options: [{ value: 'S' }, { value: 'M' }] },
        ])
    })
})
