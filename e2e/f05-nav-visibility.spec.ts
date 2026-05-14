import { test, expect } from '@playwright/test'

/**
 * F05 Page visibility regression coverage.
 *
 * Required fixture:
 * - E2E_F05_SITE_SLUG: published site slug
 * - E2E_F05_HIDDEN_PATH: path for an isVisible=false page, e.g. /services
 * - E2E_F05_HIDDEN_NAV_LABEL: nav label that must be hidden from visitors
 * - E2E_F05_DELETED_NAV_LABEL: optional nav label for a soft-deleted page
 */

test.describe('F05 page visibility sync', () => {
    test.use({ storageState: undefined })

    const siteSlug = process.env.E2E_F05_SITE_SLUG
    const hiddenPath = process.env.E2E_F05_HIDDEN_PATH
    const hiddenNavLabel = process.env.E2E_F05_HIDDEN_NAV_LABEL
    const deletedNavLabel = process.env.E2E_F05_DELETED_NAV_LABEL

    test('[TC-F05-02-12] visitor header hides links to hidden and soft-deleted pages', async ({ page }) => {
        test.skip(!siteSlug || !hiddenNavLabel, 'Set E2E_F05_SITE_SLUG and E2E_F05_HIDDEN_NAV_LABEL to run this regression')

        // Arrange
        await page.goto(`/sites/${siteSlug}`)
        await page.waitForLoadState('networkidle')

        // Act
        const hiddenNavLink = page.getByRole('link', { name: hiddenNavLabel, exact: true })
        const deletedNavLink = deletedNavLabel
            ? page.getByRole('link', { name: deletedNavLabel, exact: true })
            : null

        // Assert
        await expect(hiddenNavLink).toHaveCount(0)
        if (deletedNavLink) await expect(deletedNavLink).toHaveCount(0)
    })

    test('[TC-F05-02-13] visitor direct URL for hidden page returns HTTP 404', async ({ request }) => {
        test.skip(!siteSlug || !hiddenPath, 'Set E2E_F05_SITE_SLUG and E2E_F05_HIDDEN_PATH to run this regression')

        // Arrange
        const normalizedPath = hiddenPath.startsWith('/') ? hiddenPath : `/${hiddenPath}`

        // Act
        const response = await request.get(`/sites/${siteSlug}${normalizedPath}`)

        // Assert
        expect(response.status()).toBe(404)
    })
})
