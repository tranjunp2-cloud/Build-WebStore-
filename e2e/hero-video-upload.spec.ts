import { test, expect } from '@playwright/test'
import { stat } from 'node:fs/promises'

/**
 * TC-F30-HMO-017: direct-to-S3 regression coverage for files above Vercel's
 * request-body limit. This is opt-in because it creates a media record and
 * changes the draft of the supplied staging fixture site.
 */
test.describe('Hero direct video upload', () => {
    test('[TC-F30-HMO-017] uploads a >4.5MB MP4 through presign, S3, and register', async ({ page }) => {
        const siteId = process.env.E2E_HERO_VIDEO_SITE_ID
        const videoPath = process.env.E2E_HERO_VIDEO_PATH
        test.skip(
            process.env.RUN_HERO_VIDEO_UPLOAD_E2E !== 'true' || !siteId || !videoPath,
            'Set RUN_HERO_VIDEO_UPLOAD_E2E=true, E2E_HERO_VIDEO_SITE_ID, and E2E_HERO_VIDEO_PATH to run this staging mutation test.',
        )

        // Arrange
        const video = await stat(videoPath!)
        expect(video.size).toBeGreaterThan(4.5 * 1024 * 1024)
        expect(video.size).toBeLessThanOrEqual(100 * 1024 * 1024)
        await page.goto(`/editor/${siteId}`)
        const preview = page.frameLocator('iframe[title]')
        const videoInput = preview.locator('input[accept="video/mp4,video/webm"]')
        await expect(videoInput).toBeAttached({ timeout: 30_000 })

        // Act
        const presignResponse = page.waitForResponse(response =>
            response.url().includes('/api/media/presign') && response.request().method() === 'POST',
        )
        const registerResponse = page.waitForResponse(response =>
            response.url().includes('/api/media/register') && response.request().method() === 'POST',
        )
        await videoInput.setInputFiles(videoPath!)
        await expect(preview.getByText(/Uploading\.\.\./i)).toBeVisible({ timeout: 15_000 })

        // Assert
        expect((await presignResponse).status()).toBeLessThan(400)
        const register = await registerResponse
        expect(register.status()).toBeLessThan(400)
        const media = await register.json() as { url: string }
        await expect(preview.locator('video')).toHaveAttribute('src', media.url, { timeout: 30_000 })
        await expect(page.getByText(/Video updated/i)).toBeVisible({ timeout: 15_000 })
    })
})
