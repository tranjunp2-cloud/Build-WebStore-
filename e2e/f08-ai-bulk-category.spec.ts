import { test, expect, type Page } from '@playwright/test'
import { expectNoServerError } from './helpers/assertions'
import { navigateTo } from './helpers/navigation'

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
            await categorySelect.locator('.cursor-pointer').first().click()
            await categorySelect.getByText(fixtureCategoryName, { exact: true }).last().click()
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
