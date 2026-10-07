import { expect, test } from '@playwright/test'

// Local migration regression fixture: imported SJS store, source store 834.
const storePath = '/sites/superior-janitorial-supplies-sdn-bhd'

test('[TC-F35.M27] unavailable footer category still opens PW2 Products with an empty selection', async ({ page, request }) => {
    // Arrange: run against the real migrated fixture; do not synthesize BE records.
    const response = await request.get(storePath)
    test.skip(response.status() === 404, 'SJS migration fixture is not present in this environment')
    expect(response.ok()).toBeTruthy()
    await page.goto(storePath)

    // Act: follow the actual footer link.
    await page.locator('footer').getByText('Corporate Profile', { exact: true }).click()

    // Assert: PW1 IDs never become PW2 category IDs or unfiltered product results.
    await expect(page).toHaveURL(/\/products\?categoryId=0/)
    await expect(page.getByText('No products match your filters.', { exact: true })).toBeVisible()
    await expect(page.locator('[data-testid="products-grid-skeleton"]')).toHaveCount(0)
    await page.getByRole('button', { name: 'Clear all filters' }).click()
    await expect(page).not.toHaveURL(/categoryId=0/)
})
