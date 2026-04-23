import { test, expect } from '@playwright/test'
import { getFirstSiteId } from './helpers/navigation'

/**
 * Auto-save debug test — GH-768
 * Uses existing auth session (from auth.setup.ts).
 * Validates: PATCH /save fires within 7s after a block change.
 */

test('GH-768: auto-save fires after block change (no double-save)', async ({ page }) => {
    // ── Resolve siteId ─────────────────────────────────────────────────
    let siteId = process.env.E2E_SITE_ID || null

    if (!siteId) {
        siteId = await getFirstSiteId(page)
    }

    test.skip(!siteId, 'No siteId found — set E2E_SITE_ID or ensure a site exists')

    // ── Open editor ────────────────────────────────────────────────────
    await page.goto(`/editor/${siteId}`)
    await page.waitForLoadState('networkidle')
    await page.waitForSelector('iframe', { timeout: 20_000 })

    // Small wait for editor store to fully init
    await page.waitForTimeout(1500)

    // ── Intercept PATCH /save calls ────────────────────────────────────
    const saveRequests: { time: number; url: string; status: number; body: string }[] = []
    page.on('response', async resp => {
        if (resp.url().includes('/save') && resp.request().method() === 'PATCH') {
            const body = await resp.request().postData() || ''
            saveRequests.push({ time: Date.now(), url: resp.url(), status: resp.status(), body })
        }
    })

    const t0 = Date.now()
    let madeChange = false

    // ── Strategy 1: Sidebar block field input (triggers handleBlockFieldChange → immediate save)
    // These inputs use onBlur, so we type + click away
    const blockFieldInput = page.locator([
        'input[placeholder*="Headline" i]',
        'input[placeholder*="heading" i]',
        'input[placeholder*="title" i]',
        'input[placeholder*="label" i]',
        'input[type="text"]:visible',
    ].join(', ')).first()

    if (!madeChange && await blockFieldInput.isVisible({ timeout: 2_000 }).catch(() => false)) {
        const original = await blockFieldInput.inputValue().catch(() => '')
        await blockFieldInput.click()
        await blockFieldInput.fill(original + 'x')
        // Blur the input to trigger onBlur save
        await page.keyboard.press('Tab')
        await page.waitForTimeout(200)
        madeChange = true
        console.log(`[GH-768] Made sidebar block field change`)
    }

    // ── Strategy 2: Business name / site settings input (handleSiteSettingsChange → immediate save)
    if (!madeChange) {
        // Look for any text input in the settings panel
        const settingsInput = page.locator('input[type="text"]:visible, input:not([type]):visible').first()
        if (await settingsInput.isVisible({ timeout: 2_000 }).catch(() => false)) {
            const original = await settingsInput.inputValue().catch(() => '')
            await settingsInput.click()
            await settingsInput.fill(original + 'x')
            await page.keyboard.press('Tab')
            await page.waitForTimeout(200)
            madeChange = true
            console.log(`[GH-768] Made settings panel input change`)
        }
    }

    // ── Strategy 3: Inline text edit in iframe
    // Click on the iframe content to trigger inline editing → overlay textarea appears in parent
    if (!madeChange) {
        const iframe = page.locator('iframe').first()
        const iframeBox = await iframe.boundingBox()

        if (iframeBox) {
            // Click near the center of the iframe to hit a text element
            await page.mouse.click(
                iframeBox.x + iframeBox.width / 2,
                iframeBox.y + iframeBox.height * 0.25  // upper quarter where heading usually is
            )
            await page.waitForTimeout(400)

            // After clicking, an overlay textarea may appear in the parent page
            const overlayTextarea = page.locator('textarea:visible').first()
            if (await overlayTextarea.isVisible({ timeout: 2_000 }).catch(() => false)) {
                await overlayTextarea.press('End')
                await overlayTextarea.type('x')
                await page.waitForTimeout(200)
                // Click outside to trigger TEXT_EDITING_STOPPED → save fires
                await page.keyboard.press('Escape')
                await page.waitForTimeout(300)
                madeChange = true
                console.log('[GH-768] Made inline text edit via iframe click')
            }
        }
    }

    // ── Strategy 4: Color picker (theme change → handleThemeChange → immediate save)
    if (!madeChange) {
        const colorInput = page.locator('input[type="color"]:visible').first()
        if (await colorInput.isVisible({ timeout: 2_000 }).catch(() => false)) {
            // Color input: evaluate a minor change
            await colorInput.evaluate((el: HTMLInputElement) => {
                el.value = '#123456'
                el.dispatchEvent(new Event('input', { bubbles: true }))
                el.dispatchEvent(new Event('change', { bubbles: true }))
            })
            await page.waitForTimeout(200)
            madeChange = true
            console.log('[GH-768] Made color theme change')
        }
    }

    if (!madeChange) {
        console.log('[GH-768] WARNING: Could not make any UI change — test may not be reliable')
    }

    // ── Wait for save (up to 7s — covers both immediate and 3s debounce paths) ─
    console.log('[GH-768] Waiting for PATCH /save...')
    await page.waitForResponse(
        resp => resp.url().includes('/save') && resp.request().method() === 'PATCH',
        { timeout: 7_000 }
    ).catch(() => null)

    const elapsed = Date.now() - t0

    // ── Report ──────────────────────────────────────────────────────────
    console.log(`\n[GH-768] === AUTO-SAVE RESULTS ===`)
    console.log(`  Total PATCH /save calls: ${saveRequests.length}`)
    console.log(`  Elapsed from change: ${elapsed}ms`)
    for (const r of saveRequests) {
        const dt = r.time - t0
        const parsed = JSON.parse(r.body || '{}')
        console.log(`  ↳ HTTP ${r.status} at +${dt}ms`)
        console.log(`     headerBlock present: ${!!parsed.headerBlock}`)
        console.log(`     footerBlock present: ${!!parsed.footerBlock}`)
        console.log(`     isDraft: ${parsed.isDraft}`)
    }
    console.log('[GH-768] ===========================\n')

    // ── Assertions ──────────────────────────────────────────────────────
    expect(saveRequests.length, 'Save should fire at least once after a change').toBeGreaterThan(0)
    expect(
        saveRequests.every(r => r.status < 400),
        'All save responses should be successful'
    ).toBe(true)
    expect(
        saveRequests.length,
        'Should not double-save (max 2 PATCH calls in one change cycle)'
    ).toBeLessThanOrEqual(2)
})
