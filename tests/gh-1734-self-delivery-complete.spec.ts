import { expect, test } from '@playwright/test'
import { provisionDashboardFixture } from '../e2e/helpers/dashboard-fixture'

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
