import { test, expect, type Page, type Response } from '@playwright/test'
import { expectNoServerError } from './helpers/assertions'
import { navigateTo } from './helpers/navigation'

type CategoryCleanupDoc = { id: string | number; name?: unknown }

async function cleanupCategoryFixtures(page: Page, names: string[]) {
    for (const name of [...names].reverse()) {
        const lookup = await page.evaluate(async (categoryName) => {
            const response = await fetch(`/api/categories?where[name][equals]=${encodeURIComponent(categoryName)}&limit=2&depth=0`)
            const rawBody = await response.text()
            let body: { docs?: CategoryCleanupDoc[] } = {}
            try {
                body = JSON.parse(rawBody) as { docs?: CategoryCleanupDoc[] }
            } catch {
                // Non-JSON error bodies are handled by the status check below.
            }
            return { ok: response.ok, status: response.status, body }
        }, name)
        if (lookup.status === 401 || lookup.status === 403) {
            const search = page.getByPlaceholder(/search categories/i)
            await search.fill(name)
            const category = page.getByText(name, { exact: true })
            if (await category.isVisible().catch(() => false)) {
                const row = category.locator('xpath=ancestor::div[contains(@class, "group")][1]')
                await row.getByRole('button', { name: /^delete$/i }).click()
                const dialog = page.getByRole('dialog', { name: /delete category/i })
                await dialog.getByRole('button', { name: /^delete$/i }).click()
                await expect(dialog).not.toBeVisible()
            }
            await search.fill('')
            continue
        }
        if (!lookup.ok) {
            throw new Error(`Category cleanup lookup failed for "${name}" (${lookup.status})`)
        }
        const matches = (lookup.body.docs ?? []).filter(doc => doc.name === name)
        if (matches.length > 1) throw new Error(`Category cleanup refused ambiguous name "${name}"`)
        if (matches.length === 0) continue
        const deletion = await page.evaluate(async (categoryId) => {
            const response = await fetch(`/api/categories/${categoryId}`, { method: 'DELETE' })
            return { ok: response.ok, status: response.status }
        }, matches[0].id)
        if (!deletion.ok && deletion.status !== 404) {
            throw new Error(`Category cleanup delete failed for "${name}" (${deletion.status})`)
        }
    }
}
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
            if (await draftTab.isVisible() && await draftTab.isEnabled()) {
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

    test('[TC-09.53] AI chat Enter behavior blocks blank newline and keeps Shift+Enter multiline', async ({ page }) => {
        await navigateTo(page, '/products')
        await expectNoServerError(page)

        const aiChatTextarea = page.locator('textarea').first()
        await expect(aiChatTextarea).toBeVisible({ timeout: 10_000 })

        await aiChatTextarea.click()
        await aiChatTextarea.press('Enter')
        await expect(aiChatTextarea).toHaveValue('')

        await aiChatTextarea.fill('Line 1')
        await aiChatTextarea.press('Shift+Enter')
        await aiChatTextarea.type('Line 2')
        await expect(aiChatTextarea).toHaveValue('Line 1\nLine 2')
    })

    test('[TC-F08-05-13] category modal keeps input focus and does not submit on Enter', async ({ page }) => {
        await navigateTo(page, '/products/categories')
        await expectNoServerError(page)

        const addCategoryButton = page.getByRole('button', { name: /add category/i })
        await expect(addCategoryButton).toBeVisible({ timeout: 10_000 })
        await addCategoryButton.click()

        const nameInput = page.getByRole('dialog').locator('input[type="text"]').first()
        await expect(nameInput).toBeVisible()
        await expect(nameInput).toBeFocused()

        await nameInput.type('Fas')
        await expect(nameInput).toHaveValue('Fas')
        await expect(nameInput).toBeFocused()

        await nameInput.press('Enter')
        await expect(nameInput).toHaveValue('Fas')
        await expect(nameInput).toBeFocused()
        await expect(page.getByRole('dialog')).toBeVisible()
    })

    test('[TC-F08-05-19] normalizes parent and re-parents child on delete', async ({ page }) => {
        // Arrange
        const uniqueSuffix = `${Date.now()}-${test.info().workerIndex}`
        const rootName = `000 E2E Root ${uniqueSuffix}`
        const childName = `E2E Child ${uniqueSuffix}`
        // Register both unique candidates before any UI action so cleanup still runs
        // if persistence succeeds but response/assertion handling times out.
        const cleanupCategoryNames = [rootName, childName]
        let testFailure: unknown
        const isCategoryPost = (response: Response) => {
            const categoryRequest = response.request()
            return categoryRequest.method() === 'POST'
                && new URL(response.url()).pathname === '/products/categories'
        }

        try {
            await navigateTo(page, '/products/categories')
            await expectNoServerError(page)

            // Act: create a unique root category through the toolbar modal.
            await page.getByRole('button', { name: /add category/i }).click()
            let dialog = page.getByRole('dialog')
            await expect(dialog).toBeVisible()
            await dialog.locator('input[type="text"]').first().fill(rootName)
            const rootResponsePromise = page.waitForResponse(isCategoryPost)
            await dialog.getByRole('button', { name: /save/i }).click()
            const rootResponse = await rootResponsePromise
            expect(rootResponse.status()).toBeGreaterThanOrEqual(200)
            expect(rootResponse.status()).toBeLessThan(400)
            await expect(dialog).not.toBeVisible({ timeout: 10_000 })
            await expect(page.getByText(rootName, { exact: true })).toBeVisible({ timeout: 10_000 })

            // Act: reopen the normal modal and select the root through Radix.
            // The option is portaled to document.body, so locate it from page rather than dialog.
            await page.getByRole('button', { name: /add category/i }).click()
            dialog = page.getByRole('dialog')
            await expect(dialog).toBeVisible()
            await dialog.getByRole('combobox').click()
            const rootOption = page.getByRole('option', { name: rootName, exact: true })
            await expect(rootOption).toBeVisible()
            await rootOption.click()
            await expect(dialog.getByRole('combobox')).toContainText(rootName)
            await dialog.locator('input[type="text"]').first().fill(childName)
            const childResponsePromise = page.waitForResponse(isCategoryPost)
            await dialog.getByRole('button', { name: /save/i }).click()
            const childResponse = await childResponsePromise
            expect(childResponse.status()).toBeGreaterThanOrEqual(200)
            expect(childResponse.status()).toBeLessThan(400)
            await expect(dialog).not.toBeVisible({ timeout: 10_000 })

            await expect(page.locator('[data-sonner-toast][data-type="success"]').filter({ hasText: childName })).toBeVisible()

            // Assert: the hierarchy survives reload.
            await page.reload()
            await expectNoServerError(page)
            const persistedRoot = page.getByText(rootName, { exact: true })
            await expect(persistedRoot).toBeVisible({ timeout: 10_000 })
            const persistedRootRow = persistedRoot.locator('xpath=ancestor::div[contains(@class, "group")][1]')
            await persistedRootRow.locator('button[aria-expanded="false"]').click()
            await page.getByPlaceholder(/search categories/i).fill(childName)
            await expect(page.getByText(childName, { exact: true })).toBeVisible()
            await page.getByPlaceholder(/search categories/i).fill('')
            const rootRow = page.getByText(rootName, { exact: true }).locator('xpath=ancestor::div[contains(@class, "group")][1]')
            await rootRow.getByRole('button', { name: /^delete$/i }).click()
            const deleteDialog = page.getByRole('dialog', { name: /delete category/i })
            const deleteResponse = page.waitForResponse(response => response.request().method() === 'POST' && new URL(response.url()).pathname === '/products/categories')
            await deleteDialog.getByRole('button', { name: /^delete$/i }).click()
            expect((await deleteResponse).status()).toBeLessThan(400)
            await expect(deleteDialog).not.toBeVisible()
            await expect(page.getByText(rootName, { exact: true })).not.toBeVisible()
            await page.reload()
            await expectNoServerError(page)
            await page.getByPlaceholder(/search categories/i).fill(childName)
            await expect(page.getByText(childName, { exact: true })).toBeVisible()

            // Cleanup the re-parented child through the same authorized UI flow.
            const childRow = page.getByText(childName, { exact: true }).locator('xpath=ancestor::div[contains(@class, "group")][1]')
            await childRow.getByRole('button', { name: /^delete$/i }).click()
            const childDeleteDialog = page.getByRole('dialog', { name: /delete category/i })
            const childDeleteResponse = page.waitForResponse(response => response.request().method() === 'POST' && new URL(response.url()).pathname === '/products/categories')
            await childDeleteDialog.getByRole('button', { name: /^delete$/i }).click()
            expect((await childDeleteResponse).status()).toBeLessThan(400)
            await expect(childDeleteDialog).not.toBeVisible()
        } catch (error) {
            testFailure = error
            throw error
        } finally {
            try {
                await cleanupCategoryFixtures(page, cleanupCategoryNames)
            } catch (cleanupError) {
                if (!testFailure) throw cleanupError
                console.error('Category fixture cleanup failed after test failure:', cleanupError)
            }
        }
    })
})
