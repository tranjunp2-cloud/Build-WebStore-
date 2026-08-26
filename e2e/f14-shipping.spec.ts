import { test, expect } from '@playwright/test'
import { getFirstSiteId, navigateTo } from './helpers/navigation'
import { expectPageLoaded } from './helpers/assertions'

/**
 * F14 Shipping — E2E coverage for new shipping settings page and API routes.
 * RF-03: verifies new routes are reachable and behave correctly end-to-end.
 *
 * TC-F14.11: Shipping settings page loads (authenticated dashboard)
 * TC-F14.04 E2E: calculate-shipping validates state before site lookup
 * TC-F14 E2E: calculate-shipping returns fee/region for valid west-MY request
 * TC-F14 E2E: shipping-config PATCH requires authentication (401 when missing)
 */

test.describe('F14 Shipping — settings page and API routes', () => {
    let siteId: string | null = null

    test.beforeAll(async ({ browser }) => {
        siteId = process.env.E2E_SITE_ID || null
        if (!siteId) {
            const context = await browser.newContext({ storageState: './e2e/.auth/user.json' })
            const page = await context.newPage()
            siteId = await getFirstSiteId(page)
            await context.close()
        }
    })

    // ── Shipping settings page (authenticated) ───────────────────────────────

    test('[TC-F14.11 E2E] shipping settings page loads without server error', async ({ page }) => {
        await navigateTo(page, '/settings/shipping')
        await expectPageLoaded(page)
    })

    // ── POST /api/orders/calculate-shipping — public, no auth needed ─────────

    test('[TC-F14.04 E2E] calculate-shipping rejects invalid Malaysian state', async ({ request }) => {
        const res = await request.post('/api/orders/calculate-shipping', {
            data: { siteId: 'any', state: 'InvalidState', subtotalSen: 5000 },
        })
        // State is validated before site lookup so siteId 'any' is fine here
        expect(res.status()).toBe(400)
        const body = await res.json()
        expect(body.error.code).toBe('INVALID_STATE')
    })

    test('[TC-F14 E2E] calculate-shipping returns fee and region for west MY request', async ({ request }) => {
        test.skip(!siteId, 'No site found — set E2E_SITE_ID or run builder/editor test first')

        const res = await request.post('/api/orders/calculate-shipping', {
            data: { siteId, state: 'Selangor', subtotalSen: 5000 },
        })
        expect(res.status()).toBe(200)
        const body = await res.json()
        expect(body.success).toBe(true)
        expect(body.data.region).toBe('west')
        expect(typeof body.data.fee).toBe('number')
    })

    // ── PATCH /api/sites/[siteId]/shipping-config — auth guard ──────────────

    test('[TC-F14 E2E] shipping-config PATCH without auth returns 401', async ({ playwright }) => {
        const unauthRequest = await playwright.request.newContext({
            baseURL: process.env.BASE_URL || 'http://localhost:3000',
        })

        const res = await unauthRequest.patch('/api/sites/test-site/shipping-config', {
            data: { enabled: true, westRateRm: '8.00', eastRateRm: '15.00' },
        })

        expect(res.status()).toBe(401)
        await unauthRequest.dispose()
    })
})
