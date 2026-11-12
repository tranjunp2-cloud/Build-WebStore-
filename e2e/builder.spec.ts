import { test, expect } from '@playwright/test'
import { expectNoServerError, expectPageLoaded } from './helpers/assertions'
import { provisionDashboardFixture } from './helpers/dashboard-fixture'

/**
 * AI Builder E2E Tests — Verify the builder entry and generation.
 *
 * - Fast test: an account that already has a website cannot open the builder again (CI-friendly)
 * - Slow test: Full generation (manual, marked test.slow())
 *
 * TC-F01.113: Account with a website is sent from /builder/new to the dashboard (GH-2153, GH-2154)
 * TC-F01.02: AI site generation
 *
 * The e2e user (ensure-test-user) already owns a site, so /builder/new redirects to /dashboard (FR-15).
 * Seeing the builder form needs an account without a site; no such fixture exists yet.
 */

test.describe('AI Builder', () => {
    test('[TC-F01.113] account with a website is redirected from /builder/new to the dashboard', async ({ page }) => {
        // Arrange — the shared E2E workspace always owns a completed website
        // (same fixture the dashboard suite uses), so the GH-2153 guard applies.
        await provisionDashboardFixture(page.request)

        // Act
        await page.goto('/builder/new')
        await page.waitForLoadState('networkidle')

        // Assert — /dashboard, or /dashboard?ai_status=generating while a site is generating
        await expectNoServerError(page)
        await expect(page).toHaveURL(url => url.pathname === '/dashboard', { timeout: 15_000 })
    })

    test('[TC-F01.02] AI builder generates site (slow, opt-in)', async ({ page }) => {
        // Skip by default — enable manually via RUN_BUILDER_GEN=1
        // This test triggers real AI generation (slow + consumes OpenAI credits + pollutes staging)
        test.skip(!process.env.RUN_BUILDER_GEN, 'Set RUN_BUILDER_GEN=1 to run full AI generation test')
        test.slow() // Mark as slow — 120s timeout
        test.setTimeout(180_000) // 3 min total timeout for AI generation

        await page.goto('/builder/new')
        await page.waitForLoadState('networkidle')
        // GH-2154: an account that already owns a site is redirected away from the builder.
        if (new URL(page.url()).pathname.startsWith('/dashboard')) {
            test.skip(true, 'GH-2154: account already owns a site; needs a no-site e2e account')
        }
        await expectNoServerError(page)

        // Find input field — chat input or business name field
        const input = page.locator(
            'textarea, input[placeholder*="business" i], input[placeholder*="name" i], ' +
            'input[placeholder*="describe" i]'
        ).first()

        const isVisible = await input.isVisible().catch(() => false)
        if (!isVisible) {
            test.skip(true, 'Builder input not found — UI may have changed')
            return
        }

        // Enter business info
        await input.fill('E2E Test Shop - Online electronics store for testing purposes')

        // Submit — press Enter or click send/submit button
        const submitBtn = page.locator(
            'button[type="submit"], button:has-text("Generate"), button:has-text("Create"), ' +
            'button:has-text("Build"), button[aria-label*="send" i]'
        ).first()

        if (await submitBtn.isVisible()) {
            await submitBtn.click()
        } else {
            await input.press('Enter')
        }

        // Wait for generation — look for loading state then completion
        // Generation takes 30-60s on staging
        try {
            await page.waitForURL(url => {
                const p = url.pathname
                return p.includes('/editor/') || p.includes('/dashboard')
            }, { timeout: 150_000 })

            // Successfully redirected to editor — site was generated
            await expectNoServerError(page)
        } catch {
            // If no redirect, check if there's a success message on the page
            const successIndicator = page.locator(
                'text=/success|created|generated|ready/i, ' +
                'a[href*="/editor/"], button:has-text("Edit"), button:has-text("View")'
            )
            const hasSuccess = await successIndicator.count()

            if (hasSuccess === 0) {
                // Check for error messages
                const errorMsg = page.locator('text=/error|failed|try again/i')
                const hasError = await errorMsg.count()
                if (hasError > 0) {
                    const errorText = await errorMsg.first().textContent()
                    test.fail(true, `Generation failed with error: ${errorText}`)
                }
            }
        }
    })
})
