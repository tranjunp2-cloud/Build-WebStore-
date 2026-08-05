import { test, expect, type Locator, type Page } from '@playwright/test'
import { expectNoServerError } from '../e2e/helpers/assertions'
import { navigateTo } from '../e2e/helpers/navigation'

const exactAssignedProductMessage =
    'Cannot delete this category. There are 1 products still assigned to it. Please reassign your products first.'

function categoryRow(page: Page, name: string) {
    return page.locator('div.group').filter({
        has: page.getByText(name, { exact: true }),
    }).first()
}

async function openCategoryPage(page: Page) {
    await navigateTo(page, '/products/categories')
    await expectNoServerError(page)
    await expect(page.getByRole('button', { name: /add category/i })).toBeVisible()
}

async function saveOpenCategoryDialog(page: Page, name: string) {
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await dialog.locator('input[type="text"]').first().fill(name)
    await dialog.getByRole('button', { name: /save category|save/i }).click()
    await expect(dialog).toBeHidden({ timeout: 15_000 })
    await expect(
        page.locator('[data-sonner-toast][data-type="success"]').filter({ hasText: name }),
    ).toBeVisible({ timeout: 15_000 })
}

async function createRootCategory(page: Page, name: string) {
    await page.getByRole('button', { name: /add category/i }).click()
    await saveOpenCategoryDialog(page, name)
    await expect(categoryRow(page, name)).toBeVisible({ timeout: 15_000 })
}

async function createChildCategory(
    page: Page,
    parentName: string,
    childName: string,
    currentLevel: 1 | 2,
) {
    const row = categoryRow(page, parentName)
    await expect(row).toBeVisible()
    await row.getByRole('button', { name: /add subcategory/i }).click()

    const dialog = page.getByRole('dialog')
    const newLevel = currentLevel + 1
    await expect(dialog.getByRole('heading', { name: /add subcategory/i })).toBeVisible()
    await expect(dialog.getByRole('note')).toHaveText(
        `Adding a subcategory under ${parentName} (L${currentLevel}) → new category will be Level ${newLevel}.`,
    )
    const parentSelect = dialog.getByRole('combobox')
    await expect(parentSelect).toBeDisabled()
    await expect(parentSelect).toContainText(parentName)
    await expect(dialog.getByText('Locked — you are adding under this category.')).toBeVisible()

    await saveOpenCategoryDialog(page, childName)
}

async function expandCategory(row: Locator) {
    const toggle = row.locator('button[aria-expanded]').first()
    await expect(toggle).toBeVisible()
    if (await toggle.getAttribute('aria-expanded') === 'false') {
        await toggle.click()
    }
    await expect(toggle).toHaveAttribute('aria-expanded', 'true')
}

async function setTheme(page: Page, theme: 'light' | 'dark') {
    const switchToLight = page.getByRole('button', { name: 'Switch to light mode' })
    const switchToDark = page.getByRole('button', { name: 'Switch to dark mode' })

    if (theme === 'light' && await switchToLight.isVisible().catch(() => false)) {
        await switchToLight.click()
    }
    if (theme === 'dark' && await switchToDark.isVisible().catch(() => false)) {
        await switchToDark.click()
    }

    if (theme === 'dark') {
        await expect(page.locator('html')).toHaveClass(/dark/)
        await expect(switchToLight).toBeVisible()
    } else {
        await expect(page.locator('html')).not.toHaveClass(/dark/)
        await expect(switchToDark).toBeVisible()
    }
}

async function resolvedTokenColor(
    page: Page,
    token: '--primary' | '--info' | '--p-violet-300',
) {
    return page.evaluate(cssToken => {
        const reference = document.createElement('span')
        reference.style.color = `hsl(var(${cssToken}))`
        document.body.append(reference)
        const color = getComputedStyle(reference).color
        reference.remove()
        return color
    }, token)
}

async function expectBadgeColorsMatchTokens(
    page: Page,
    rows: { root: Locator; child: Locator; grandchild: Locator },
) {
    const badges = [
        rows.root.getByText('L1', { exact: true }),
        rows.child.getByText('L2', { exact: true }),
        rows.grandchild.getByText('L3', { exact: true }),
    ]
    const expectedColors = await Promise.all([
        resolvedTokenColor(page, '--primary'),
        resolvedTokenColor(page, '--info'),
        resolvedTokenColor(page, '--p-violet-300'),
    ])

    for (const [index, badge] of badges.entries()) {
        await expect(badge).toBeVisible()
        await expect(badge).toHaveCSS('color', expectedColors[index])
    }
    expect(new Set(expectedColors).size).toBe(3)
}

async function expectStandardCategoryDialog(page: Page, heading: string) {
    const dialog = page.getByRole('dialog')
    await expect(dialog.getByRole('heading', { name: heading, exact: true })).toBeVisible()
    await expect(dialog.getByRole('note')).toHaveCount(0)
    await expect(dialog.getByText('Locked — you are adding under this category.')).toHaveCount(0)
    await expect(dialog.getByRole('combobox')).toBeEnabled()
    return dialog
}

async function deleteCategoryViaUi(page: Page, name: string) {
    await openCategoryPage(page)
    const search = page.getByPlaceholder(/search categories/i)
    await search.fill(name)

    const row = categoryRow(page, name)
    const emptyState = page.getByText(/no results found/i)
    await expect(row.or(emptyState)).toBeVisible()
    if (!(await row.isVisible())) return

    await row.getByRole('button', { name: /^delete$/i }).click()
    const dialog = page.getByRole('dialog', { name: /delete category/i })
    await dialog.getByRole('button', { name: /^delete$/i }).click()
    await expect(dialog).toBeHidden()
    await expect(row).toHaveCount(0)
}

async function deleteProductViaUi(page: Page, name: string) {
    await navigateTo(page, '/products')
    await expectNoServerError(page)
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

async function createDraftProduct(
    page: Page,
    productName: string,
    sku: string,
    categoryName: string,
) {
    await navigateTo(page, '/products/new')
    await expectNoServerError(page)

    await page.locator('input[name="name"]').fill(productName)
    const categorySelect = page.getByRole('combobox', { name: /category/i })
    await categorySelect.click()
    await page.getByRole('treeitem', { name: categoryName, exact: true }).click()
    await expect(categorySelect).toContainText(categoryName)

    await page.locator('input[name="basePrice"]').fill('10')
    await page.locator('input[name="baseSku"]').fill(sku)
    await page.locator('input[name="baseInventory"]').fill('1')
    await page.locator('input[name="shippingWeight"]').fill('1')

    await page.getByRole('button', { name: /save(?: as)? draft/i }).click()
    await expect(page.locator('[data-sonner-toast][data-type="success"]')).toBeVisible({ timeout: 30_000 })
    await page.waitForURL(url => url.pathname === '/products', { timeout: 30_000 })
}

test.describe('GH-1587 category management rework regressions', () => {
    test.beforeEach(async ({ page }) => {
        await page.addInitScript(() => {
            localStorage.setItem('prefer_lang', 'en')
            document.cookie = 'prefer_lang=en; path=/; samesite=lax'
        })
    })

    test('[TC-F08-05-38][TC-F08-05-39][TC-F08-05-06] preserves hierarchy guidance, badge themes, and re-parenting', async ({ page }) => {
        test.setTimeout(120_000)

        // Arrange
        const suffix = `${Date.now()}-${test.info().workerIndex}`
        const rootName = `GH1587 Root ${suffix}`
        const childName = `GH1587 Child ${suffix}`
        const siblingName = `GH1587 Sibling ${suffix}`
        const grandchildName = `GH1587 Grandchild ${suffix}`
        const cleanupNames = [grandchildName, childName, siblingName, rootName]
        let testFailure: unknown

        try {
            await openCategoryPage(page)

            // Act: create the root and prove toolbar/edit flows remain standard category dialogs.
            await createRootCategory(page, rootName)
            await page.getByRole('button', { name: /add category/i }).click()
            let standardDialog = await expectStandardCategoryDialog(page, 'Add New Category')
            await standardDialog.getByRole('button', { name: /^cancel$/i }).click()
            await expect(standardDialog).toBeHidden()

            await categoryRow(page, rootName).getByRole('button', { name: /^edit$/i }).click()
            standardDialog = await expectStandardCategoryDialog(page, 'Edit Category')
            await standardDialog.getByRole('button', { name: /^cancel$/i }).click()
            await expect(standardDialog).toBeHidden()

            // Act: create two direct L2 children and retain an L3 under the first child.
            await createChildCategory(page, rootName, childName, 1)
            await createChildCategory(page, rootName, siblingName, 1)
            await expandCategory(categoryRow(page, rootName))
            await createChildCategory(page, childName, grandchildName, 2)
            await expandCategory(categoryRow(page, rootName))
            await expandCategory(categoryRow(page, childName))

            const rootRow = categoryRow(page, rootName)
            const childRow = categoryRow(page, childName)
            const grandchildRow = categoryRow(page, grandchildName)
            await expect(grandchildRow).toBeVisible()
            await expect(grandchildRow.getByRole('button', { name: /add subcategory/i })).toHaveCount(0)

            // Assert: browser-computed colors resolve to the required semantic tokens in both themes.
            await setTheme(page, 'light')
            await expectBadgeColorsMatchTokens(page, {
                root: rootRow,
                child: childRow,
                grandchild: grandchildRow,
            })
            await setTheme(page, 'dark')
            await expectBadgeColorsMatchTokens(page, {
                root: rootRow,
                child: childRow,
                grandchild: grandchildRow,
            })

            // Act: deleting L1 promotes every direct child while retaining deeper relations.
            await rootRow.getByRole('button', { name: /^delete$/i }).click()
            const deleteDialog = page.getByRole('dialog', { name: /delete category/i })
            await deleteDialog.getByRole('button', { name: /^delete$/i }).click()
            await expect(deleteDialog).toBeHidden()
            await page.reload()
            await expectNoServerError(page)

            // Assert: both former L2s are top-level/L1; former L3 remains under its original child.
            await expect(page.getByText(rootName, { exact: true })).toHaveCount(0)
            const promotedChildRow = categoryRow(page, childName)
            await expect(promotedChildRow).toBeVisible()
            await expect(promotedChildRow.getByText('L1', { exact: true })).toBeVisible()
            const promotedSiblingRow = categoryRow(page, siblingName)
            await expect(promotedSiblingRow).toBeVisible()
            await expect(promotedSiblingRow.getByText('L1', { exact: true })).toBeVisible()
            await expect(page.getByText(grandchildName, { exact: true })).toHaveCount(0)
            await expandCategory(promotedChildRow)
            const retainedGrandchildRow = categoryRow(page, grandchildName)
            await expect(retainedGrandchildRow).toBeVisible()
            await expect(retainedGrandchildRow.getByText('L2', { exact: true })).toBeVisible()
        } catch (error) {
            testFailure = error
            throw error
        } finally {
            const cleanupErrors: unknown[] = []
            for (const name of cleanupNames) {
                try {
                    await deleteCategoryViaUi(page, name)
                } catch (error) {
                    cleanupErrors.push(error)
                }
            }
            if (!testFailure && cleanupErrors.length > 0) {
                throw new AggregateError(cleanupErrors, 'GH-1587 hierarchy fixture cleanup failed')
            }
        }
    })

    test('[TC-F08-05-06] blocks category deletion with the exact assigned-product count', async ({ page }) => {
        test.setTimeout(120_000)

        // Arrange
        const suffix = `${Date.now()}-${test.info().workerIndex}`
        const categoryName = `GH1587 Assigned ${suffix}`
        const productName = `GH1587 Product ${suffix}`
        const sku = `GH1587-${suffix}`
        let testFailure: unknown

        try {
            await openCategoryPage(page)
            await createRootCategory(page, categoryName)
            await createDraftProduct(page, productName, sku, categoryName)
            await openCategoryPage(page)
            await page.getByPlaceholder(/search categories/i).fill(categoryName)

            // Act
            const row = categoryRow(page, categoryName)
            await row.getByRole('button', { name: /^delete$/i }).click()
            const dialog = page.getByRole('dialog', { name: /delete category/i })
            await dialog.getByRole('button', { name: /^delete$/i }).click()

            // Assert
            await expect(page.locator('[data-sonner-toast][data-type="error"]')).toContainText(
                exactAssignedProductMessage,
            )
            await expect(dialog).toBeVisible()
            await dialog.getByRole('button', { name: /cancel/i }).click()
        } catch (error) {
            testFailure = error
            throw error
        } finally {
            const cleanupErrors: unknown[] = []
            try {
                await deleteProductViaUi(page, productName)
            } catch (error) {
                cleanupErrors.push(error)
            }
            try {
                await deleteCategoryViaUi(page, categoryName)
            } catch (error) {
                cleanupErrors.push(error)
            }
            if (!testFailure && cleanupErrors.length > 0) {
                throw new AggregateError(cleanupErrors, 'GH-1587 assigned-product fixture cleanup failed')
            }
        }
    })
})

