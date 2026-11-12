import { expect, test, type APIRequestContext } from '@playwright/test'
import { assertAllowedAuthenticatedE2ETarget } from '../e2e/helpers/authenticated-target'
import { provisionDashboardFixture } from '../e2e/helpers/dashboard-fixture'

/**
 * GH-2477 — Bank transfer must show at checkout when the seller enables it in Settings → Payments,
 * even if the site-level `paymentConfig.enableQrBanking` is false (PW1-migrated stores).
 * Goes through the real SSR checkout page (`initialSiteData` path) — no mocked payment config.
 */
// 1x1 PNG used as the sample QR image
const QR_PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jD1sAAAAASUVORK5CYII=', 'base64')
const BANK_KEYS = ['qr_image', 'bank_name', 'account_holder_name', 'account_number'] as const
const BANK_LABEL = /Bank transfer \/ DuitNow QR|Pindahan bank \/ DuitNow QR/

interface RestState { tenantId: string | number; siteId: string | number; payments: Record<string, unknown>; siteFlag: unknown }

async function readState(request: APIRequestContext, slug: string): Promise<RestState> {
    const me = await (await request.get('/api/users/me')).json()
    const tenantRef = me.user?.tenants?.[0]?.tenant
    const tenantId = typeof tenantRef === 'object' ? tenantRef.id : tenantRef
    const publicSite = await (await request.get(`/api/storefront/site-by-slug?slug=${encodeURIComponent(slug)}`)).json()
    const siteId = publicSite.siteId
    expect(tenantId, 'E2E user has a tenant').toBeTruthy()
    expect(siteId, 'storefront site resolved by slug').toBeTruthy()
    const tenant = await (await request.get(`/api/tenants/${tenantId}?depth=0`)).json()
    const site = await (await request.get(`/api/sites/${siteId}?depth=0`)).json()
    return { tenantId, siteId, payments: tenant.payments ?? {}, siteFlag: site.paymentConfig?.enableQrBanking }
}

/** Tenant payments as stored (relations flattened to ids) — read back to assert and to restore. */
async function readPayments(request: APIRequestContext, tenantId: string | number): Promise<Record<string, unknown>> {
    const tenant = await (await request.get(`/api/tenants/${tenantId}?depth=0`)).json()
    return tenant.payments ?? {}
}

async function patch(request: APIRequestContext, path: string, data: unknown) {
    const res = await request.patch(path, { data })
    expect(res.ok(), `${path}: ${res.status()} ${await res.text()}`).toBeTruthy()
}

test.describe('[TC-F09-2477-06] checkout SSR shows Bank transfer from the tenant flag only', () => {
    test('site enableQrBanking=false + tenant payment_qr=true → shown; tenant OFF + reload → hidden', async ({ page }, testInfo) => {
        test.setTimeout(240_000)
        assertAllowedAuthenticatedE2ETarget(testInfo.project.use.baseURL)
        const { tenantSlug } = await provisionDashboardFixture(page.request)
        expect(tenantSlug).toBeTruthy()
        const state = await readState(page.request, tenantSlug!)
        const originalPayments = state.payments as Record<string, unknown>
        const checkoutUrl = `/sites/${encodeURIComponent(tenantSlug!)}/checkout`

        let mediaId: string | number | undefined
        try {
            // Arrange — seed a sample QR + bank details (requireQrImageWhenEnabled forces payment_qr=false without a QR),
            // a PW1-style site (flag false), and keep COD on so "at least one method" stays true
            const upload = await page.request.post('/api/media/upload', {
                multipart: { file: { name: `gh2477-qr-${Date.now()}.png`, mimeType: 'image/png', buffer: QR_PNG }, alt: 'GH-2477 sample QR' },
            })
            expect(upload.status(), 'QR media upload').toBe(200)
            mediaId = ((await upload.json()) as { id: string | number }).id
            await patch(page.request, `/api/sites/${state.siteId}`, { paymentConfig: { enableQrBanking: false } })
            await patch(page.request, `/api/tenants/${state.tenantId}`, {
                payments: {
                    payment_cod: true, payment_qr: true, qr_image: mediaId,
                    bank_name: 'Maybank', account_holder_name: 'GH2477 Test Sdn Bhd', account_number: '1234567890',
                },
            })

            // Arrange check — preconditions hold before navigating (tenant QR ON with image, site QR OFF)
            const seeded = await readPayments(page.request, state.tenantId)
            expect(seeded.payment_qr, 'tenant payment_qr persisted ON').toBe(true)
            expect(seeded.qr_image, 'tenant qr_image persisted').toBeTruthy()
            const siteNow = await (await page.request.get(`/api/sites/${state.siteId}?depth=0`)).json()
            expect(siteNow.paymentConfig?.enableQrBanking, 'site enableQrBanking persisted OFF').toBe(false)

            // Act + Assert — tenant ON: SSR checkout renders and can select Bank transfer
            await page.goto(checkoutUrl, { waitUntil: 'domcontentloaded' })
            const bank = page.getByText(BANK_LABEL).first()
            await expect(bank).toBeVisible()
            await bank.click()
            await expect(page.locator('.pm.active').filter({ hasText: BANK_LABEL })).toBeVisible()

            // Act + Assert — tenant OFF + reload: option gone
            await patch(page.request, `/api/tenants/${state.tenantId}`, { payments: { payment_qr: false } })
            await page.reload({ waitUntil: 'domcontentloaded' })
            await expect(page.locator('.pm').first()).toBeVisible()
            await expect(page.getByText(BANK_LABEL)).toHaveCount(0)
        } finally {
            // Restore the shared E2E tenant/site exactly as found (QR image and bank details included)
            const restore: Record<string, unknown> = {
                payment_cod: originalPayments.payment_cod === true,
                payment_qr: originalPayments.payment_qr === true,
            }
            for (const key of BANK_KEYS) restore[key] = originalPayments[key] ?? null
            await patch(page.request, `/api/tenants/${state.tenantId}`, { payments: restore })
            await patch(page.request, `/api/sites/${state.siteId}`, { paymentConfig: { enableQrBanking: state.siteFlag ?? true } })
            if (mediaId !== undefined) await page.request.delete(`/api/media/${mediaId}`) // best effort: sample QR only
        }
    })
})
