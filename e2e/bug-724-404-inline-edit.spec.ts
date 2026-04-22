/**
 * BUG-724: 404 page inline text edit not persisting after editor page reload
 *
 * Flow:
 * 1. Login → OTP (any code accepted in dev)
 * 2. Navigate to editor → Pages tab → Edit 404 page
 * 3. Click on any text block to inline-edit
 * 4. Change the text, wait for auto-save
 * 5. Reload the editor page
 * 6. Verify the changed text is still present (not reverted)
 *
 * TC-F05-01-BUG724
 */

import { test, expect, type Page } from '@playwright/test'

async function getJwtFromCookies(page: Page): Promise<string> {
    const cookies = await page.context().cookies()
    const payloadCookie = cookies.find(c => c.name === 'payload-token')
    return payloadCookie?.value ?? ''
}

const BASE_URL = 'http://localhost:3002'

const UNIQUE_TEXT = `BUG724_${Date.now()}`

test.use({
    baseURL: BASE_URL,
    actionTimeout: 20_000,
    navigationTimeout: 30_000,
})

test.describe('BUG-724: 404 page text edit persists after reload', () => {
    test('[TC-F05-01-BUG724] inline text edit on 404 page persists across editor reload', async ({ page }) => {
        // Auth state already set by auth.setup.ts — go straight to dashboard
        await page.goto('/dashboard')
        await page.waitForLoadState('networkidle')
        console.log('✅ Dashboard loaded. Current URL:', page.url())

        // ── Step 1: Find a site and navigate to editor ────────────────────────
        // Try editor links on page first; if not visible, expand sidebar or use API
        let siteId: string | null = null

        const directLinks = page.locator('a[href*="/editor/"]')
        if (await directLinks.count() > 0) {
            const href = await directLinks.first().getAttribute('href')
            siteId = href?.match(/\/editor\/(\d+)/)?.[1] ?? null
        }

        if (!siteId) {
            // Expand "My Website" sidebar item to reveal editor links
            const myWebsiteBtn = page.locator('button:has-text("My Website"), a:has-text("My Website")').first()
            if (await myWebsiteBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
                await myWebsiteBtn.click()
                await page.waitForTimeout(800)
                const afterExpand = page.locator('a[href*="/editor/"]')
                if (await afterExpand.count() > 0) {
                    const href = await afterExpand.first().getAttribute('href')
                    siteId = href?.match(/\/editor\/(\d+)/)?.[1] ?? null
                }
            }
        }

        if (!siteId) {
            // Fallback 1: ENV override
            siteId = process.env.E2E_SITE_ID ?? null
        }

        if (!siteId) {
            // Fallback 2: hit sites API using JWT from payload-token cookie
            const jwt = await getJwtFromCookies(page)
            console.log('🔑 JWT prefix:', jwt.substring(0, 30) + '...')
            const sitesResp = await page.request.get('/api/sites?limit=1', {
                headers: { 'Authorization': `JWT ${jwt}` }
            })
            console.log('📡 Sites API status:', sitesResp.status())
            if (sitesResp.ok()) {
                const data = await sitesResp.json()
                console.log('📡 Sites API response:', JSON.stringify(data).substring(0, 200))
                const first = data?.docs?.[0] ?? data?.[0]
                siteId = first?.id != null ? String(first.id) : null
            }
        }

        expect(siteId, 'No site found — pass E2E_SITE_ID env var or ensure account has a site').toBeTruthy()
        console.log('✅ Site ID:', siteId)

        await page.goto(`/editor/${siteId}`)
        await page.waitForLoadState('networkidle')
        console.log('✅ Editor loaded')

        // ── Step 4: Open Pages tab ─────────────────────────────────────────────
        // Look for Pages tab in sidebar
        const pagesTab = page.locator('button:has-text("Pages"), [role="tab"]:has-text("Pages"), [data-tab="pages"]').first()
        await expect(pagesTab).toBeVisible({ timeout: 15_000 })
        await pagesTab.click()
        console.log('✅ Pages tab opened')

        // ── Step 5: Find 404 page and click Edit ──────────────────────────────
        // Look for 404 page entry
        const page404 = page.locator('text=404, text=/404/').first()
        await expect(page404).toBeVisible({ timeout: 10_000 })

        // Find the Edit button near the 404 entry
        const editBtn = page.locator('[data-page-slug="404"] button, :text("404") ~ button:has-text("Edit"), :text("404 page") + button').first()
        // Try more generic approach — click on the 404 page item to select it
        const page404Item = page.locator('[data-testid*="page"], .page-item, li').filter({ hasText: '404' }).first()
        const page404Count = await page404Item.count()

        if (page404Count > 0) {
            // Look for edit button inside the 404 page item
            const editInsideItem = page404Item.locator('button:has-text("Edit"), a:has-text("Edit"), [aria-label*="edit" i]').first()
            if (await editInsideItem.isVisible().catch(() => false)) {
                await editInsideItem.click()
                console.log('✅ Clicked Edit on 404 page')
            } else {
                // Click the item itself to navigate to it
                await page404Item.click()
                console.log('✅ Selected 404 page item')
            }
        } else {
            // Fallback: look for any button near text "404"
            await page.locator('text=404').first().click()
            console.log('✅ Clicked 404 page text')
        }

        // Wait for editor to load 404 page content
        await page.waitForLoadState('networkidle')
        await page.waitForTimeout(2000)
        console.log('✅ 404 page loaded in editor')

        // ── Step 6: Inline edit text in iframe ────────────────────────────────
        const iframe = page.frameLocator('iframe').first()

        // Find a text element to edit — look for heading or paragraph
        const editableText = iframe.locator('h1, h2, h3, p, [data-editable]').filter({ hasText: /.{5,}/ }).first()
        await expect(editableText).toBeVisible({ timeout: 10_000 })

        const originalText = await editableText.textContent()
        console.log('✅ Found text to edit:', originalText?.substring(0, 50))

        // Double click to enter inline edit mode
        await editableText.dblclick()
        await page.waitForTimeout(500)

        // Select all and type new text
        await page.keyboard.press('Control+A')
        const newText = `${originalText?.substring(0, 20) ?? 'Test'} ${UNIQUE_TEXT}`
        await page.keyboard.type(UNIQUE_TEXT)

        console.log('✅ Typed new text with unique marker:', UNIQUE_TEXT)

        // Click outside to stop editing (trigger TEXT_EDITING_STOPPED)
        await page.mouse.click(100, 100)
        await page.waitForTimeout(500)

        // ── Step 7: Wait for save API call to complete ────────────────────────
        const saveResponse = await page.waitForResponse(
            resp => resp.url().includes('/save') && resp.request().method() === 'PATCH',
            { timeout: 10_000 }
        ).catch(() => null)

        if (saveResponse) {
            const status = saveResponse.status()
            console.log('✅ Save API responded with status:', status)
            expect(status).toBe(200)
        } else {
            console.warn('⚠️ No save API call observed — text change may not have triggered save')
        }

        // Additional wait for save to fully complete
        await page.waitForTimeout(2000)

        // ── Step 8: Reload the full editor page ───────────────────────────────
        console.log('🔄 Reloading editor page...')
        await page.reload()
        await page.waitForLoadState('networkidle')
        await page.waitForTimeout(3000)
        console.log('✅ Editor page reloaded')

        // ── Step 9: Verify text persisted ─────────────────────────────────────
        const iframeAfterReload = page.frameLocator('iframe').first()

        // Check if the unique text marker is present in the iframe content
        const textAfterReload = iframeAfterReload.locator(`text=${UNIQUE_TEXT}`)
        const persistedCount = await textAfterReload.count()

        console.log(persistedCount > 0
            ? `✅ BUG-724 FIXED: Text "${UNIQUE_TEXT}" persisted after editor reload`
            : `❌ BUG-724 STILL BROKEN: Text "${UNIQUE_TEXT}" NOT found after editor reload`
        )

        // Also capture the page body for debugging
        const bodyText = await iframeAfterReload.locator('body').textContent().catch(() => '')
        console.log('📄 Page body preview (first 200 chars):', bodyText?.substring(0, 200))

        expect(persistedCount, `Unique text "${UNIQUE_TEXT}" should persist after editor reload`).toBeGreaterThan(0)
    })
})
