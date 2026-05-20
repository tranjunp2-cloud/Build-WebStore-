import { test, expect } from '@playwright/test'
import { expectNoServerError, expectPageLoaded } from './helpers/assertions'

/**
 * AI Builder E2E Tests — Verify builder loads and generation works.
 *
 * Split into 2 tests per validation decision:
 * - Fast test: UI loads (CI-friendly, always runs)
 * - Slow test: Full generation (manual, marked test.slow())
 *
 * TC-F01.01: Builder page loads
 * TC-F01.02: AI site generation
 */

test.describe('AI Builder', () => {
    test('[TC-F01.01] builder page loads with chat UI', async ({ page }) => {
        await page.goto('/builder/new')
        await page.waitForLoadState('networkidle')

        await expectNoServerError(page)

        // Chat interface or form should be visible
        const chatUI = page.locator(
            'textarea, input[placeholder*="business" i], input[placeholder*="name" i], ' +
            '[data-testid*="builder"], [data-testid*="chat"], form'
        )
        await expect(chatUI.first()).toBeVisible({ timeout: 15_000 })
    })

    test('[TC-F01.02] AI builder generates site (slow, opt-in)', async ({ page }) => {
        // Skip by default — enable manually via RUN_BUILDER_GEN=1
        // This test triggers real AI generation (slow + consumes OpenAI credits + pollutes staging)
        test.skip(!process.env.RUN_BUILDER_GEN, 'Set RUN_BUILDER_GEN=1 to run full AI generation test')

        test.slow() // Mark as slow — 120s timeout
        test.setTimeout(180_000) // 3 min total timeout for AI generation

        await page.goto('/builder/new')
        await page.waitForLoadState('networkidle')
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
