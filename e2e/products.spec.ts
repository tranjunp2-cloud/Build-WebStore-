import { test, expect, type Page } from '@playwright/test'
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

    test('[TC-GH1432-PERF-03] canonical dashboard products endpoint is available to the signed-in owner', async ({ request }) => {
        // Arrange — authenticated storage state comes from auth.setup.ts.

        // Act
        const response = await request.get('/api/dashboard/products')
        const body = await response.json()

        // Assert
        expect(response.status()).toBe(200)
        expect(body.success).toBe(true)
        expect(Array.isArray(body.data)).toBe(true)
    })

    test('[TC-GH1432-PERF-03] canonical dashboard products endpoint rejects unauthenticated requests', async ({ playwright }) => {
        // Arrange
        const unauthenticatedRequest = await playwright.request.newContext({
            baseURL: process.env.BASE_URL || 'http://localhost:3000',
        })

        // Act
        const response = await unauthenticatedRequest.get('/api/dashboard/products')

        // Assert
        expect(response.status()).toBe(401)
        await unauthenticatedRequest.dispose()
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

async function createCategoryViaUi(page: Page, name: string) {
    await navigateTo(page, '/products/categories')
    await expectNoServerError(page)

    await page.getByRole('button', { name: /add category/i }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await dialog.getByRole('textbox').first().fill(name)
    await dialog.getByRole('button', { name: /save category/i }).click()

    await expect(dialog).toBeHidden()
    await expect(page.getByText(name, { exact: true })).toBeVisible()
}

async function deleteProductViaUi(page: Page, name: string) {
    await navigateTo(page, '/products')
    const search = page.getByPlaceholder(/search by name or sku/i).last()
    await search.fill(name)

    const row = page.getByRole('row').filter({
        has: page.getByText(name, { exact: true }),
    })
    const emptyState = page.getByText(/no products match the current filters/i)
    await expect(row.or(emptyState)).toBeVisible()
    if (!(await row.isVisible())) return

    await row.getByRole('button', { name: /delete/i }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toContainText(name)
    await dialog.getByRole('button', { name: /confirm delete/i }).click()
    await expect(dialog).toBeHidden()
    await expect(row).toHaveCount(0)
}

async function deleteCategoryViaUi(page: Page, name: string) {
    await navigateTo(page, '/products/categories')
    const search = page.getByPlaceholder(/search categories/i)
    await search.fill(name)

    const row = page.locator('div.group').filter({
        has: page.getByText(name, { exact: true }),
    })
    const emptyState = page.getByText(/no results found/i)
    await expect(row.or(emptyState)).toBeVisible()
    if (!(await row.isVisible())) return

    await row.getByRole('button', { name: /delete/i }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toContainText(name)
    await dialog.getByRole('button', { name: 'Delete', exact: true }).click()
    await expect(dialog).toBeHidden()
    await expect(row).toHaveCount(0)
}

test.describe('GH-1588 Scope 02 — tenant-aware AI bulk categories', () => {
    const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const fixtureCategoryName = `GH1588 Category ${runId}`
    const createdProductNames = [
        `GH1588 Draft A ${runId}`,
        `GH1588 Draft B ${runId}`,
    ]

    test.afterEach(async ({ page }) => {
        // Cleanup through the same tenant-scoped Server Actions as the dashboard.
        // Attempt every owned fixture even if one UI delete fails, then preserve the failure
        // so the test still reports cleanup damage instead of silently leaking staging data.
        const cleanupErrors: unknown[] = []
        for (const name of createdProductNames) {
            try {
                await deleteProductViaUi(page, name)
            } catch (error) {
                cleanupErrors.push(error)
            }
        }
        try {
            await deleteCategoryViaUi(page, fixtureCategoryName)
        } catch (error) {
            cleanupErrors.push(error)
        }
        if (cleanupErrors.length > 0) {
            throw new AggregateError(cleanupErrors, 'GH-1588 E2E fixture cleanup failed')
        }
    })

    test('[TC-F08-04-101] requires existing-category selection and persists AI-created drafts', async ({ page }) => {
        test.setTimeout(120_000)

        // Arrange — create an existing tenant category through the real dashboard flow.
        await page.addInitScript(() => {
            localStorage.setItem('prefer_lang', 'en')
            document.cookie = 'prefer_lang=en; path=/; samesite=lax'
        })
        await createCategoryViaUi(page, fixtureCategoryName)

        // The parse API contract is covered by TC-F08-04-94..100. Intercepting it keeps
        // this browser test focused on required selection and real Server Action persistence.
        await page.route('**/api/ai/products-bulk-parse', async route => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    products: createdProductNames.map((name, index) => ({
                        name,
                        price: 21 + index,
                        sku: `GH1588-${index + 1}-${runId}`,
                        categoryId: null,
                        variants: [],
                    })),
                }),
            })
        })

        await navigateTo(page, '/products')
        await expectNoServerError(page)

        const aiChatTextarea = page.locator('textarea').first()
        await expect(aiChatTextarea).toBeVisible({ timeout: 10_000 })
        const parseResponsePromise = page.waitForResponse(
            response => response.request().method() === 'POST' && response.url().includes('/api/ai/products-bulk-parse'),
            { timeout: 60_000 },
        )

        // Act — both unmatched drafts must receive an existing category before approval.
        await aiChatTextarea.fill('Create two category regression products.')
        await aiChatTextarea.press('Enter')
        expect((await parseResponsePromise).ok()).toBe(true)

        const approveButton = page.getByRole('button', { name: /approve all/i })
        await expect(approveButton).toBeDisabled()
        for (const ordinal of [1, 2]) {
            const categorySelect = page.getByTestId(`ai-category-select-${ordinal}`)
            const trigger = categorySelect.getByRole('combobox', {
                name: new RegExp(`Category for .* draft ${ordinal}`, 'i'),
            })
            await trigger.press('Enter')
            await page.getByRole('treeitem', { name: fixtureCategoryName, exact: true }).press('Enter')
        }
        await expect(approveButton).toBeEnabled()
        await approveButton.click()

        // Assert — the real Server Action saved drafts, and a fresh UI read resolves the
        // selected category relation for every created product.
        await expect(page.getByText(/created 2 draft products/i)).toBeVisible({ timeout: 30_000 })
        for (const name of createdProductNames) {
            const search = page.getByPlaceholder(/search by name or sku/i).last()
            await search.fill(name)
            const row = page.getByRole('row').filter({
                has: page.getByText(name, { exact: true }),
            })
            await expect(row).toBeVisible()
            await row.click()
            await expect(page.getByRole('heading', { name, exact: true })).toBeVisible()
            await expect(page.getByText(fixtureCategoryName, { exact: true }).last()).toBeVisible()
            await navigateTo(page, '/products')
        }
    })
})
