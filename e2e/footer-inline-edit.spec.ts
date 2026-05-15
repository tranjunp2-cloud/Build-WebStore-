import { test, expect } from '@playwright/test'
import { expectNoServerError } from './helpers/assertions'
import { getFirstSiteId } from './helpers/navigation'

/**
 * Footer Inline Edit E2E Tests — iframe postMessage + debounce + blur/save timing
 *
 * TC-F05-967-D3: Inline edit copyrightText — normal flow
 * TC-F05-967-D4: Inline edit copyrightText — fast blur before 300ms debounce (flush fix)
 * TC-F05-967-D5: Inline edit tagline (Company Description) — normal flow
 * TC-F05-967-D6: Inline edit tagline — fast blur before 300ms debounce (flush fix)
 */

test.describe('Footer Inline Edit — iframe postMessage flow', () => {
    let siteId: string | null = null

    test.beforeAll(async ({ browser }) => {
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

    test('[TC-F05-967-D3] inline edit copyrightText — normal flow', async ({ page }) => {
        test.skip(!siteId, 'No site found — set E2E_SITE_ID or run builder test first')

        await page.goto(`/editor/${siteId}`)
        await page.waitForLoadState('networkidle')
        await expectNoServerError(page)

        const frame = page.frameLocator('iframe').first()
        const copyrightEl = frame.locator('[data-footer-field="copyrightText"]')

        const visible = await copyrightEl.isVisible().catch(() => false)
        test.skip(!visible, 'Footer copyrightText not visible in this site — variant may lack footer block')

        // Click to activate inline edit
        await copyrightEl.click()
        await expect(copyrightEl).toHaveAttribute('contenteditable', 'true')

        // Type new value
        await copyrightEl.fill('')
        await copyrightEl.type('© 2026 Updated Brand')

        // Wait for debounce (300ms) before blur to ensure FOOTER_FIELD_EDITED fires
        await page.waitForTimeout(350)

        // Blur to trigger FOOTER_FIELD_EDIT_STOP
        await copyrightEl.blur()

        // Sidebar copyright field should reflect the new value
        const sidebarCopyright = page.locator('[data-field="copyrightText"], input[name="copyrightText"], textarea[name="copyrightText"]').first()
        await expect(sidebarCopyright).toHaveValue('© 2026 Updated Brand', { timeout: 3_000 })
    })

    test('[TC-F05-967-D4] inline edit copyrightText — fast blur (flush fix)', async ({ page }) => {
        test.skip(!siteId, 'No site found — set E2E_SITE_ID or run builder test first')

        await page.goto(`/editor/${siteId}`)
        await page.waitForLoadState('networkidle')
        await expectNoServerError(page)

        const frame = page.frameLocator('iframe').first()
        const copyrightEl = frame.locator('[data-footer-field="copyrightText"]')

        const visible = await copyrightEl.isVisible().catch(() => false)
        test.skip(!visible, 'Footer copyrightText not visible in this site')

        await copyrightEl.click()
        await expect(copyrightEl).toHaveAttribute('contenteditable', 'true')

        await copyrightEl.fill('')
        await copyrightEl.type('© 2026 Fast Blur Brand')

        // Blur immediately — before 300ms debounce fires (simulates fast blur/Enter scenario)
        // The FOOTER_FIELD_EDIT_STOP must flush pendingValue to prevent data loss
        await copyrightEl.blur()

        // Parent should receive flushed value and update store + save
        const sidebarCopyright = page.locator('[data-field="copyrightText"], input[name="copyrightText"], textarea[name="copyrightText"]').first()
        await expect(sidebarCopyright).toHaveValue('© 2026 Fast Blur Brand', { timeout: 3_000 })
    })

    test('[TC-F05-967-D5] inline edit tagline (Company Description) — normal flow', async ({ page }) => {
        test.skip(!siteId, 'No site found — set E2E_SITE_ID or run builder test first')

        await page.goto(`/editor/${siteId}`)
        await page.waitForLoadState('networkidle')
        await expectNoServerError(page)

        const frame = page.frameLocator('iframe').first()
        const taglineEl = frame.locator('[data-footer-field="tagline"]')

        const visible = await taglineEl.isVisible().catch(() => false)
        test.skip(!visible, 'Footer tagline not visible — variant must be centered-stack or dark-gradient with tagline set')

        await taglineEl.click()
        await expect(taglineEl).toHaveAttribute('contenteditable', 'true')

        await taglineEl.fill('')
        await taglineEl.type('Empowering creators worldwide')

        await page.waitForTimeout(350)
        await taglineEl.blur()

        const sidebarTagline = page.locator('[data-field="tagline"], input[name="tagline"], textarea[name="tagline"]').first()
        await expect(sidebarTagline).toHaveValue('Empowering creators worldwide', { timeout: 3_000 })
    })

    test('[TC-F05-967-D6] inline edit tagline — fast blur (flush fix)', async ({ page }) => {
        test.skip(!siteId, 'No site found — set E2E_SITE_ID or run builder test first')

        await page.goto(`/editor/${siteId}`)
        await page.waitForLoadState('networkidle')
        await expectNoServerError(page)

        const frame = page.frameLocator('iframe').first()
        const taglineEl = frame.locator('[data-footer-field="tagline"]')

        const visible = await taglineEl.isVisible().catch(() => false)
        test.skip(!visible, 'Footer tagline not visible — variant must be centered-stack or dark-gradient with tagline set')

        await taglineEl.click()
        await expect(taglineEl).toHaveAttribute('contenteditable', 'true')

        await taglineEl.fill('')
        await taglineEl.type('Fast blur tagline value')

        // Blur immediately — FOOTER_FIELD_EDIT_STOP must include newValue to prevent data loss
        await taglineEl.blur()

        const sidebarTagline = page.locator('[data-field="tagline"], input[name="tagline"], textarea[name="tagline"]').first()
        await expect(sidebarTagline).toHaveValue('Fast blur tagline value', { timeout: 3_000 })
    })

    test('[TC-F05-967-D4-persist] edited copyright persists after page refresh', async ({ page }) => {
        test.skip(!siteId, 'No site found — set E2E_SITE_ID or run builder test first')

        await page.goto(`/editor/${siteId}`)
        await page.waitForLoadState('networkidle')
        await expectNoServerError(page)

        const frame = page.frameLocator('iframe').first()
        const copyrightEl = frame.locator('[data-footer-field="copyrightText"]')

        const visible = await copyrightEl.isVisible().catch(() => false)
        test.skip(!visible, 'Footer copyrightText not visible in this site')

        const uniqueValue = `© 2026 Persist Test ${Date.now()}`

        await copyrightEl.click()
        await copyrightEl.fill('')
        await copyrightEl.type(uniqueValue)
        await page.waitForTimeout(350) // let debounce fire + 600ms save timer settle
        await copyrightEl.blur()
        await page.waitForTimeout(800) // allow auto-save to complete

        // Reload and verify the value was persisted
        await page.goto(`/editor/${siteId}`)
        await page.waitForLoadState('networkidle')

        const frameAfterReload = page.frameLocator('iframe').first()
        const copyrightAfterReload = frameAfterReload.locator('[data-footer-field="copyrightText"]')
        await expect(copyrightAfterReload).toContainText(uniqueValue, { timeout: 10_000 })
    })
})
