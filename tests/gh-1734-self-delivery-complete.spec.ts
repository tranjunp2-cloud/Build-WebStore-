import { expect, test } from '@playwright/test'

test.describe('GH-1734 Self-delivery completion', () => {
    test('[TC-GH1734-E2E] merchant confirms shipped Self-delivery order as completed', async ({ page }) => {
        // Arrange
        const orderId = process.env.E2E_GH1734_ORDER_ID
        test.skip(
            process.env.RUN_GH1734_E2E !== 'true' || !orderId,
            'Set RUN_GH1734_E2E=true and E2E_GH1734_ORDER_ID to a shipped Self-delivery order.',
        )
        await page.goto(`/orders/${orderId}`)
        const completeButton = page.getByRole('button', { name: 'Complete Order', exact: true })
        await expect(completeButton).toBeVisible({ timeout: 30_000 })

        // Act
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
        await expect(completeButton).toHaveCount(0)
    })
})
