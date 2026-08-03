import { test, expect } from '@playwright/test'
import { expectNoServerError, expectPageLoaded } from './helpers/assertions'
import { getFirstSiteId, navigateTo } from './helpers/navigation'

/**
 * Editor E2E Tests — Load, save, publish, and verify storefront.
 *
 * TC-F05.01: Editor loads site content
 * TC-F05.02: Editor save draft
 * TC-F05.03: Editor publish site
 * TC-F09.01: Published storefront renders
 */

test.describe('Editor & Storefront', () => {
    let siteId: string | null = null

    test.beforeAll(async ({ browser }) => {
        // Resolve siteId — from env or by finding first site on dashboard
        siteId = process.env.E2E_SITE_ID || null

        if (!siteId) {
            const context = await browser.newContext({
                storageState: './e2e/.auth/user.json',
            })
            const page = await context.newPage()
            siteId = await getFirstSiteId(page)
            await context.close()
        }
    })

    test('[TC-F05.01] editor loads site content', async ({ page }) => {
        test.skip(!siteId, 'No site found — run builder test first or set E2E_SITE_ID')

        await page.goto(`/editor/${siteId}`)
        await page.waitForLoadState('networkidle')

        await expectNoServerError(page)

        // Editor should have blocks or content area
        const editorContent = page.locator(
            '[data-testid*="block"], [data-testid*="editor"], ' +
            '[class*="editor"], [class*="block"], main'
        )
        await expect(editorContent.first()).toBeVisible({ timeout: 20_000 })

        // Toolbar should be visible (save, publish buttons)
        const toolbar = page.locator(
            'button:has-text("Save"), button:has-text("Publish"), ' +
            'button:has-text("Preview"), [data-testid*="toolbar"]'
        )
        const toolbarCount = await toolbar.count()
        expect(toolbarCount).toBeGreaterThan(0)
    })

    test('[GH-1715] Auto SEO uses a styled overwrite confirmation dialog', async ({ page }) => {
        test.skip(!siteId, 'No site found')

        const appliedUpdates: Array<Record<string, unknown>> = []
        let nativeDialogOpened = false
        let updatedPage = {
            id: 'page-1',
            title: 'About',
            slug: 'about',
            isHomepage: false,
            seoTitle: 'Existing SEO title',
            seoDescription: 'Existing SEO description',
        }

        page.on('dialog', async (dialog) => {
            nativeDialogOpened = true
            await dialog.dismiss()
        })

        await page.route('**/api/sites/*/pages/*', async (route) => {
            if (route.request().method() !== 'PATCH') {
                await route.fallback()
                return
            }

            const changes = route.request().postDataJSON() as Record<string, unknown>
            appliedUpdates.push(changes)
            updatedPage = { ...updatedPage, ...changes }
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ page: updatedPage }),
            })
        })

        await page.route('**/api/sites/*/pages/*/generate-seo', async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    hasExisting: true,
                    existing: {
                        title: 'Existing SEO title',
                        description: 'Existing SEO description',
                    },
                    proposed: {
                        title: 'AI proposed title',
                        description: 'AI proposed description',
                        slug: 'ai-proposed-slug',
                    },
                }),
            })
        })

        await page.goto(`/editor/${siteId}`)
        await page.waitForLoadState('networkidle')
        await expectNoServerError(page)

        await page.getByRole('button', { name: 'SEO', exact: true }).first().click()
        const autoSeoButton = page.getByRole('button', { name: 'Automatic SEO Optimization' })
        await autoSeoButton.click()

        const overwriteDialog = page.getByRole('dialog', { name: 'Replace existing SEO metadata?' })
        await expect(overwriteDialog).toBeVisible()
        await expect(page.getByTestId('seo-current-title')).toHaveText('Existing SEO title')
        await expect(page.getByTestId('seo-proposed-title')).toHaveText('AI proposed title')
        await expect(page.getByTestId('seo-current-description')).toHaveText('Existing SEO description')
        await expect(page.getByTestId('seo-proposed-description')).toHaveText('AI proposed description')

        await overwriteDialog.getByRole('button', { name: 'Cancel' }).click()
        await expect(overwriteDialog).not.toBeVisible()
        expect(appliedUpdates).toHaveLength(0)

        await autoSeoButton.click()
        await expect(overwriteDialog).toBeVisible()
        await overwriteDialog.getByRole('button', { name: 'Replace SEO' }).click()

        await expect.poll(() => (
            appliedUpdates.some(update => update.seoTitle === 'AI proposed title')
            && appliedUpdates.some(update => update.seoDescription === 'AI proposed description')
        )).toBe(true)
        expect(nativeDialogOpened).toBe(false)
    })

    test('[TC-F05.02] editor save draft', async ({ page }) => {
        test.skip(!siteId, 'No site found')

        await page.goto(`/editor/${siteId}`)
        await page.waitForLoadState('networkidle')
        await expectNoServerError(page)

        // Find save button
        const saveBtn = page.locator(
            'button:has-text("Save"), button[data-testid*="save"], ' +
            'button[aria-label*="save" i]'
        ).first()

        const hasSave = await saveBtn.isVisible().catch(() => false)
        if (!hasSave) {
            test.skip(true, 'Save button not found')
            return
        }

        // Listen for save API response
        const saveResponsePromise = page.waitForResponse(
            resp => resp.url().includes('/save') && resp.request().method() === 'PATCH',
            { timeout: 15_000 }
        ).catch(() => null)

        await saveBtn.click()

        const saveResponse = await saveResponsePromise
        if (saveResponse) {
            expect(saveResponse.status()).toBeLessThan(400)
        }

        // Verify no error after save
        await expectNoServerError(page)
    })

    test('[TC-F05.03] editor publish site', async ({ page }) => {
        test.skip(!siteId, 'No site found')

        await page.goto(`/editor/${siteId}`)
        await page.waitForLoadState('networkidle')
        await expectNoServerError(page)

        // Find publish button
        const publishBtn = page.locator(
            'button:has-text("Publish"), button[data-testid*="publish"]'
        ).first()

        const hasPublish = await publishBtn.isVisible().catch(() => false)
        if (!hasPublish) {
            test.skip(true, 'Publish button not found')
            return
        }

        // Listen for publish API response
        const publishResponsePromise = page.waitForResponse(
            resp => resp.url().includes('/publish') && (
                resp.request().method() === 'PATCH' || resp.request().method() === 'POST'
            ),
            { timeout: 15_000 }
        ).catch(() => null)

        await publishBtn.click()

        // Handle confirmation dialog if present
        const confirmBtn = page.locator(
            'button:has-text("Confirm"), button:has-text("Yes"), ' +
            '[role="alertdialog"] button:has-text("Publish")'
        ).first()
        if (await confirmBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
            await confirmBtn.click()
        }

        const publishResponse = await publishResponsePromise
        if (publishResponse) {
            expect(publishResponse.status()).toBeLessThan(400)
        }

        await expectNoServerError(page)
    })

    test('[TC-F05.03b] publish failure shows friendly block/item detail from API', async ({ page }) => {
        test.skip(!siteId, 'No site found')

        await page.route('**/api/sites/*/publish', async (route) => {
            await route.fulfill({
                status: 409,
                contentType: 'application/json',
                body: JSON.stringify({
                    success: false,
                    error: {
                        code: 'PARTIAL_PUBLISH_FAILURE',
                        message: 'Failed to publish 1 page(s). Please try again.',
                        failures: [
                            {
                                friendlyDetail: 'About Us → Pricing → Plan 2 → price: This field is required.',
                                validationErrors: [{ path: 'layout.2.plans.1.price', message: 'This field is required.' }],
                            },
                        ],
                    },
                }),
            })
        })

        await page.goto(`/editor/${siteId}`)
        await page.waitForLoadState('networkidle')
        await expectNoServerError(page)

        const publishBtn = page.locator(
            'button:has-text("Publish"), button:has-text("Update"), ' +
            'button[data-testid*="publish"], button[data-testid*="republish"]'
        ).first()

        const hasPublish = await publishBtn.isVisible().catch(() => false)
        if (!hasPublish) {
            test.skip(true, 'Publish/Update button not found')
            return
        }

        await publishBtn.click()

        const confirmBtn = page.locator(
            'button:has-text("Publish now"), button:has-text("Confirm"), ' +
            'button:has-text("Publish"), button:has-text("Update")'
        ).last()
        if (await confirmBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
            await confirmBtn.click()
        }

        await expect(page.getByText('About Us → Pricing → Plan 2 → price: This field is required.')).toBeVisible({ timeout: 10_000 })
    })

    test('[TC-F09.01] published storefront renders', async ({ page }) => {
        test.skip(!siteId, 'No site found')

        // Get site slug via API
        const response = await page.request.get(`/api/sites/${siteId}/editor-data`)

        if (response.status() !== 200) {
            test.skip(true, `Cannot fetch site data: status ${response.status()}`)
            return
        }

        const data = await response.json().catch(() => null)
        const slug = data?.site?.slug || data?.slug

        if (!slug) {
            test.skip(true, 'Cannot determine site slug')
            return
        }

        // Visit storefront
        await page.goto(`/sites/${slug}`)
        await page.waitForLoadState('networkidle')

        await expectNoServerError(page)

        // Page should have content
        const body = await page.textContent('body')
        expect(body?.trim().length).toBeGreaterThan(100)

        // Check mobile viewport too
        await page.setViewportSize({ width: 375, height: 812 })
        await page.reload()
        await page.waitForLoadState('networkidle')
        await expectNoServerError(page)
    })
})
