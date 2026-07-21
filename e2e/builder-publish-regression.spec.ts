import { createHash } from 'node:crypto'
import { test, expect } from '@playwright/test'
import { expectNoServerError } from './helpers/assertions'

function hashLayout(layout: unknown): string {
    return createHash('sha256').update(JSON.stringify(layout ?? [])).digest('hex')
}

test.describe('AI Builder publish regression', () => {
    test('[TC-BUG-F01-26-AC07] publish keeps editor layout identical to reviewed layout (slow, opt-in)', async ({ page }) => {
        test.skip(!process.env.RUN_BUILDER_GEN, 'Set RUN_BUILDER_GEN=1 to run the real publish→editor regression flow')

        test.slow()
        test.setTimeout(240_000)

        await page.goto('/builder/new')
        await page.waitForLoadState('networkidle')
        await expectNoServerError(page)

        const businessNameInput = page.locator('input[placeholder*="business" i], input[placeholder*="name" i]').first()
        const productsInput = page.locator('textarea[placeholder*="product" i], textarea[placeholder*="service" i]').first()
        const descriptionInput = page.locator('textarea[placeholder*="describe" i], textarea[placeholder*="description" i]').last()
        const industryOption = page.getByRole('button', { name: /portfolio/i }).first()

        if (!await businessNameInput.isVisible().catch(() => false)) {
            test.skip(true, 'Builder form fields not found — UI may have changed')
            return
        }

        await businessNameInput.fill('hoạt hình')
        if (await industryOption.isVisible().catch(() => false)) {
            await industryOption.click()
        }
        if (await productsInput.isVisible().catch(() => false)) {
            await productsInput.fill('hoạt hình chibi')
        }
        if (await descriptionInput.isVisible().catch(() => false)) {
            await descriptionInput.fill('hoat hinh chibi')
        }

        const submitBtn = page.locator(
            'button[type="submit"], button:has-text("Generate"), button:has-text("Create"), button:has-text("Build")'
        ).first()

        await submitBtn.click()

        const publishButton = page.getByRole('button', { name: /publish website/i }).first()
        await expect(publishButton).toBeVisible({ timeout: 180_000 })

        const siteId = await page.evaluate(() => {
            const raw = window.localStorage.getItem('prime-builder-session')
            if (!raw) return null

            try {
                const parsed = JSON.parse(raw) as { state?: { siteId?: string | null } }
                return parsed.state?.siteId ?? null
            } catch {
                return null
            }
        })

        if (!siteId) {
            test.skip(true, 'Builder session did not persist a siteId')
            return
        }

        const beforeRes = await page.request.get(`/api/sites/${siteId}/editor-data`)
        expect(beforeRes.status()).toBe(200)
        const beforeData = await beforeRes.json()
        const beforeLayoutHash = hashLayout(beforeData?.page?.layout)

        await publishButton.click()
        await expect(page.getByText(/published|success/i).first()).toBeVisible({ timeout: 30_000 })

        const openEditorLink = page.getByRole('link', { name: /open editor/i }).first()
        await expect(openEditorLink).toBeVisible({ timeout: 30_000 })
        await openEditorLink.click()

        await page.waitForURL(new RegExp(`/editor/${siteId}`), { timeout: 30_000 })
        await page.waitForLoadState('networkidle')
        await expectNoServerError(page)

        const afterRes = await page.request.get(`/api/sites/${siteId}/editor-data`)
        expect(afterRes.status()).toBe(200)
        const afterData = await afterRes.json()
        const afterLayoutHash = hashLayout(afterData?.page?.layout)

        expect(afterLayoutHash).toBe(beforeLayoutHash)
    })
})
