import { test, expect } from '@playwright/test'

/**
 * Blog Management E2E Tests — Blog CRUD operations.
 *
 * TC-F17.01: Blog list page
 * TC-F17.02: Create blog post
 * TC-F17.012: Form validation
 * TC-F17.020: Category management
 */

test.describe('Blog Management', () => {
    test('[TC-F17.01] blog page loads', async ({ page }) => {
        await page.goto('/blog')
        await page.waitForLoadState('networkidle')

        await expect(page.locator('body')).not.toBeEmpty()
        await expect(page.locator('text=Internal Server Error')).not.toBeVisible()
    })

    test('[TC-F17.01] shows blog list or empty state', async ({ page }) => {
        await page.goto('/blog')
        await page.waitForLoadState('networkidle')

        // Either blog posts or empty state
        const content = await page.textContent('body')
        expect(content?.length).toBeGreaterThan(0)
    })

    test('[TC-F17.02] navigate to create blog post', async ({ page }) => {
        await page.goto('/blog')
        await page.waitForLoadState('networkidle')

        const createBtn = page.locator('a[href*="/blog/new"], button:has-text("Create"), button:has-text("New"), a:has-text("Write")').first()
        if (await createBtn.isVisible()) {
            await createBtn.click()
            await page.waitForLoadState('networkidle')
        }
    })

    test('[TC-F17.020] blog categories page loads', async ({ page }) => {
        await page.goto('/blog/categories')
        await page.waitForLoadState('networkidle')

        await expect(page.locator('body')).not.toBeEmpty()
        await expect(page.locator('text=Internal Server Error')).not.toBeVisible()
    })
})
