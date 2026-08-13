import { expect, test } from '@playwright/test'
import { provisionDashboardFixture } from '../e2e/helpers/dashboard-fixture'
import { prepareDashboardEasyParcelOnlyFixture } from '../e2e/helpers/dashboard-shipping-fixture'

test.describe('GH-1700 Dashboard shipping onboarding status', () => {
    // Fixture preparation mutates canonical staging state. A timeout or 5xx can
    // be commit-ambiguous, so never replay the entire test at the runner level.
    test.describe.configure({ retries: 0 })

    test('[TC-F03.78] EasyParcel-only renders Shipping as complete', async ({ page }) => {
        test.setTimeout(180_000)

        // Arrange — fail closed unless the active primary tenant is the
        // production-valid, dedicated EasyParcel-only staging fixture.
        const fixture = await prepareDashboardEasyParcelOnlyFixture(page.request)

        // Act
        await page.goto('/dashboard')
        await page.waitForLoadState('networkidle')
        const shippingStep = page.locator('.onb-step').filter({
            has: page.locator('a[href="/settings/shipping"]'),
        })
        const editorHrefs = await page.locator('.onb-step a[href^="/editor/"]')
            .evaluateAll(links => links.flatMap(link => link.getAttribute('href') ?? []))
        const renderedSiteIds = [...new Set(editorHrefs.flatMap((href) => {
            const match = href.match(/^\/editor\/([^/?#]+)(?:\?[^#]*)?$/)
            return match ? [match[1]] : []
        }))]

        // Assert — prove the real Dashboard rendered a site owned by the
        // prepared tenant, then verify the real Shipping row and tick.
        expect(renderedSiteIds.length).toBeGreaterThan(0)
        expect(renderedSiteIds.every(siteId => fixture.siteIds.includes(siteId))).toBe(true)
        await expect(shippingStep).toHaveCount(1)
        await expect(shippingStep).toHaveClass(/\bdone\b/)
        await expect(shippingStep).toHaveAttribute('data-completion-source', 'easyparcel')
        await expect(shippingStep.locator('.step-tick svg')).toBeVisible()
    })
})

test.describe('GH-1734 Self-delivery completion', () => {
    test('[TC-GH1734-E2E] merchant fulfills and completes a Self-delivery order', async ({ page }) => {
        test.setTimeout(210_000)

        // Arrange — provisioning recreates the isolated order on every attempt,
        // so retries never inherit a shipped or completed fixture.
        const fixture = await provisionDashboardFixture(page.request)
        const orderId = fixture.orderId
        const trackingNumber = `E2E-GH1734-${Date.now()}`
        await page.goto(`/orders/${orderId}`)

        // Act — confirm the order, then fulfill it through the real Self-delivery UI.
        const confirmResponsePromise = page.waitForResponse(response => (
            response.url().endsWith(`/api/orders/${orderId}`)
            && response.request().method() === 'PATCH'
        ))
        await page.getByRole('button', { name: 'Confirm Order', exact: true }).click()
        const confirmResponse = await confirmResponsePromise
        expect(confirmResponse.ok(), await confirmResponse.text()).toBe(true)

        await page.locator('#sd-courier').selectOption('Pos Laju')
        await page.locator('#sd-awb').fill(trackingNumber)
        const shipResponsePromise = page.waitForResponse(response => (
            response.url().endsWith(`/api/orders/${orderId}/self-deliver`)
            && response.request().method() === 'POST'
        ))
        await page.getByRole('button', { name: 'Ship Order', exact: true }).click()
        const shipResponse = await shipResponsePromise
        expect(shipResponse.ok(), await shipResponse.text()).toBe(true)

        const completeButton = page.getByRole('button', { name: 'Complete Order', exact: true })
        await expect(completeButton).toBeVisible({ timeout: 30_000 })

        // Act — confirm completion only after the order has reached shipping.
        await completeButton.click()
        const dialog = page.getByRole('dialog')
        await expect(dialog).toContainText('This action cannot be undone')
        const completionResponse = page.waitForResponse(response =>
            response.url().endsWith(`/api/orders/${orderId}`)
            && response.request().method() === 'PATCH',
        )
        await dialog.getByRole('button', { name: 'Complete Order', exact: true }).click()

        // Assert
        expect((await completionResponse).status()).toBeLessThan(400)
        await expect(page.getByText('Completed', { exact: true }).first()).toBeVisible()
        await expect(page.getByText('Delivered', { exact: true }).first()).toBeVisible()
        await expect(page.getByText('Order marked as completed', { exact: true })).toBeVisible()
        await expect(page.getByText(trackingNumber, { exact: true })).toBeVisible()
        await expect(completeButton).toHaveCount(0)
    })
})
