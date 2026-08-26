import { expect, test } from '@playwright/test'

const ONE_PIXEL_PNG = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
    'base64',
)

test.describe('GH-1640 direct image upload', () => {
    test('[TC-GH1640-PERF-01] uploads an editor image through presign, storage, and register', async ({ page }) => {
        // Arrange
        const siteId = process.env.E2E_GH1640_SITE_ID
        test.skip(
            process.env.RUN_GH1640_MEDIA_E2E !== 'true' || !siteId,
            'Set RUN_GH1640_MEDIA_E2E=true and E2E_GH1640_SITE_ID to run this draft mutation test.',
        )
        await page.goto(`/editor/${siteId}`)
        const preview = page.frameLocator('iframe[title]')
        const imageInput = preview.locator('input[accept="image/jpeg,image/png,image/webp"]').first()
        await expect(imageInput).toBeAttached({ timeout: 30_000 })
        const presignResponse = page.waitForResponse(response =>
            response.url().includes('/api/media/presign') && response.request().method() === 'POST',
        )
        const registerResponse = page.waitForResponse(response =>
            response.url().includes('/api/media/register') && response.request().method() === 'POST',
        )

        // Act
        await imageInput.setInputFiles({
            name: 'gh-1640-direct-upload.png',
            mimeType: 'image/png',
            buffer: ONE_PIXEL_PNG,
        })

        // Assert
        expect((await presignResponse).status()).toBeLessThan(400)
        expect((await registerResponse).status()).toBeLessThan(400)
        await expect(page.getByText(/Image updated/i)).toBeVisible({ timeout: 30_000 })
    })
})
