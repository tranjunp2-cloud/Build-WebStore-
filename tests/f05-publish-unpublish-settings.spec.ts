import { expect, test, type APIRequestContext } from '@playwright/test'
import { getFirstSiteId } from '../e2e/helpers/navigation'

/**
 * [US-F05-10] TC-F05-10-17 — Publish → edit → Update live → Unpublish from Settings → Publish again.
 * Runs in the `f05-publish-unpublish-settings` Playwright project (auth setup + storageState) against a shop
 * that already has a Home page. The shop is restored to live in afterAll even if a step fails.
 */

/** Set ONLY right before the first mutation of the shop. Teardown restores the shop only if this is set, so a
 * skipped / failed precheck never publishes a shop the test did not touch. */
let siteNeedingCleanup: string | null = null

const RESTORE_ATTEMPTS = 4
// The publish API allows 5/min: honour Retry-After fully, within this total waiting budget.
const RESTORE_WAIT_BUDGET_MS = 150_000
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

async function isSiteLive(request: APIRequestContext, id: string): Promise<boolean> {
    const res = await request.get(`/api/sites/${id}/editor-data`)
    if (!res.ok()) return false
    const data = await res.json().catch(() => null)
    return data?.site?.status === 'published'
}

/**
 * Publish through the same PATCH route the editor uses (empty body = publish current draft) and confirm the
 * site really is live afterwards. Retries transient failures (429 / 5xx / not-yet-live) a bounded number of
 * times, waiting the full Retry-After inside RESTORE_WAIT_BUDGET_MS; throws with the last status if the shop
 * could not be restored — never "request sent = restored". `onlyIfNotLive` skips the PATCH when already live.
 */
async function ensureLive(request: APIRequestContext, id: string, opts: { onlyIfNotLive?: boolean } = {}): Promise<void> {
    if (opts.onlyIfNotLive && (await isSiteLive(request, id))) return
    let lastStatus = 0
    let waited = 0
    for (let attempt = 1; attempt <= RESTORE_ATTEMPTS; attempt++) {
        const res = await request.patch(`/api/sites/${id}/publish`)
        lastStatus = res.status()
        if (res.ok() && (await isSiteLive(request, id))) return
        const transient = lastStatus === 429 || lastStatus >= 500 || res.ok()
        if (!transient || attempt === RESTORE_ATTEMPTS) break
        const retryAfter = Number(res.headers()['retry-after'])
        const wait = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 2000 * attempt
        if (waited + wait > RESTORE_WAIT_BUDGET_MS) {
            throw new Error(`Could not restore site ${id} to live: Retry-After ${Math.round(wait / 1000)}s exceeds the ${RESTORE_WAIT_BUDGET_MS / 1000}s cleanup budget (last status ${lastStatus}); the shared shop may still be in maintenance mode`)
        }
        await sleep(wait)
        waited += wait
    }
    throw new Error(`Could not restore site ${id} to live (last publish status ${lastStatus}); the shared shop may still be in maintenance mode`)
}

type DraftChange = { pageId: string | number; blocks: Array<Record<string, unknown>> }

/**
 * Read the current page and prepare a tiny text change. API failures or an unexpected payload FAIL the test;
 * the only `null` result is "the fixture page has no editable text field" (the one legitimate skip).
 */
async function prepareDraftChange(request: APIRequestContext, id: string): Promise<DraftChange | null> {
    const dataRes = await request.get(`/api/sites/${id}/editor-data`)
    expect(dataRes.status(), 'GET editor-data must succeed').toBe(200)
    const data = await dataRes.json()
    const pageId = data?.page?.id
    const blocks = data?.page?.layout
    expect(pageId, 'editor-data must return page.id').toBeTruthy()
    expect(Array.isArray(blocks), 'editor-data must return page.layout as an array').toBe(true)

    const marker = ` e2e-${Date.now() % 100000}`
    const touched = JSON.parse(JSON.stringify(blocks)) as Array<Record<string, unknown>>
    const bump = (node: unknown): boolean => {
        if (!node || typeof node !== 'object') return false
        for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
            if (typeof v === 'string' && /^(title|heading|headline|text|subtitle)$/i.test(k) && v.length > 0) {
                ;(node as Record<string, unknown>)[k] = v.replace(/ e2e-\d+$/, '') + marker
                return true
            }
            if (bump(v)) return true
        }
        return false
    }
    return touched.some((blk) => bump(blk)) ? { pageId, blocks: touched } : null
}

async function saveDraftChange(request: APIRequestContext, id: string, change: DraftChange) {
    const saveRes = await request.patch(`/api/sites/${id}/save?pageId=${change.pageId}`, {
        data: { blocks: change.blocks, isDraft: true },
    })
    expect(saveRes.status(), 'PATCH save (draft change) must succeed').toBe(200)
}

test.describe.serial('[US-F05-10] unpublish lives in Settings → Domains', () => {
    test.afterAll(async ({ playwright, baseURL }) => {
        test.setTimeout(RESTORE_WAIT_BUDGET_MS + 30_000) // room for the full Retry-After budget
        // Cleanup: never leave the shared shop in maintenance mode, whatever happened above.
        if (!siteNeedingCleanup) return
        const ctx = await playwright.request.newContext({ baseURL, storageState: './e2e/.auth/user.json' })
        try {
            // Throws (hook fails loudly) if the shop cannot be put back to live.
            await ensureLive(ctx, siteNeedingCleanup, { onlyIfNotLive: true })
        } finally {
            await ctx.dispose()
        }
    })

    test('[TC-F05-10-17] publish → Update live → unpublish from Settings (checkbox) → publish again', async ({ page }) => {
        const foundSiteId = await getFirstSiteId(page)
        test.skip(!foundSiteId, 'No site available for the E2E account')
        const id = foundSiteId as string

        // Fixture precheck BEFORE touching the shop: API errors fail here; only a page without any
        // editable text is a legitimate skip.
        const draftChange = await prepareDraftChange(page.request, id)
        test.skip(!draftChange, 'Fixture page has no editable text field to change')

        // 1. Start from a known state: live and in sync. This is the first mutation of the shop: from here on
        //    teardown must restore it, even if the publish request itself fails midway.
        siteNeedingCleanup = id
        await ensureLive(page.request, id)
        await page.goto(`/editor/${id}`)
        const header = page.locator('header')

        // 2. In sync: no Preview, no primary button, domain link + Copy link, no Unpublish / View live menu.
        await expect(header.getByRole('link', { name: /Open live website/i }).first()).toBeVisible()
        await expect(header.getByRole('button', { name: 'Copy link' })).toBeVisible()
        await expect(header.getByRole('button', { name: /^(Publish|Update live)$/ })).toHaveCount(0)
        await expect(page.getByText(/unpublish/i)).toHaveCount(0)
        await expect(header.getByRole('button', { name: /^View live/ })).toHaveCount(0)

        // 3. Phone (375px): live actions stay reachable without the old dropdown.
        await page.setViewportSize({ width: 375, height: 812 })
        await page.reload()
        await expect(header.getByRole('link', { name: /Open live website/i }).first()).toBeVisible()
        await expect(header.getByRole('button', { name: 'Copy link' })).toBeVisible()
        await page.setViewportSize({ width: 1280, height: 800 })

        // 4. Edit content → pending changes: Update live (+ ↗), label says it is not live yet.
        await saveDraftChange(page.request, id, draftChange as DraftChange)
        await page.goto(`/editor/${id}`)
        const updateLive = header.getByRole('button', { name: /Update live/ })
        await expect(updateLive).toBeVisible()
        await expect(header.getByLabel('Open live website')).toBeVisible()
        await expect(header.getByRole('link', { name: /Preview/i }).first()).toBeVisible()

        // 5. Update live → back to in sync.
        await updateLive.click()
        await expect(header.getByRole('button', { name: /Update live/ })).toHaveCount(0, { timeout: 30_000 })
        await expect(header.getByRole('link', { name: /Open live website/i }).first()).toBeVisible()

        // 6. Settings → Domains: card shows Live and the red Unpublish button.
        await page.goto('/settings/domains')
        const badge = page.getByTestId('website-status-badge')
        await expect(badge).toHaveText(/Live/i)
        await page.getByRole('button', { name: 'Unpublish website' }).click()

        // 7. Modal: confirm stays disabled until the checkbox is ticked; Cancel leaves the site live.
        const confirm = page.getByRole('button', { name: 'Confirm unpublish' })
        await expect(confirm).toBeDisabled()
        await page.getByRole('button', { name: 'Cancel' }).click()
        await expect(badge).toHaveText(/Live/i)

        await page.getByRole('button', { name: 'Unpublish website' }).click()
        await expect(page.getByLabel(/I understand customers/)).not.toBeChecked()
        await page.getByLabel(/I understand customers/).check()
        await expect(confirm).toBeEnabled()
        await confirm.click()
        await expect(badge).toHaveText(/Under maintenance/i)

        // 8. Editor: maintenance banner + Publish is the primary button again.
        await page.goto(`/editor/${id}`)
        await expect(header.getByRole('button', { name: /^Publish$/ })).toBeVisible()
        await expect(page.getByText(/maintenance mode/i).first()).toBeVisible()

        // 9. Publish again through the editor modal (afterAll also restores live if this fails).
        await header.getByRole('button', { name: /^Publish$/ }).click()
        await page.getByRole('button', { name: /Publish now/i }).click()
        await expect(header.getByRole('link', { name: /Open live website/i }).first()).toBeVisible({ timeout: 30_000 })
    })
})
