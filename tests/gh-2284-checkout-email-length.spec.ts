import { expect, test } from '@playwright/test'
import { provisionDashboardFixture } from '../e2e/helpers/dashboard-fixture'
import { assertAllowedAuthenticatedE2ETarget } from '../e2e/helpers/authenticated-target'

test.describe('[TC-GH2284-01] checkout email length', () => {
    test('shows an inline error and rejects an overlong email before order creation', async ({ page }, testInfo) => {
        test.setTimeout(180_000)

        // Arrange — the authenticated fixture provides a published storefront in the E2E tenant.
        assertAllowedAuthenticatedE2ETarget(testInfo.project.use.baseURL)
        const fixture = await provisionDashboardFixture(page.request)
        expect(fixture.tenantSlug).toBeTruthy()

        const email = `${'a'.repeat(292)}@yopmail.com`
        expect(email.length).toBeGreaterThan(254)
        const body = {
            siteId: 'gh2284-email-length-no-site',
            items: [{ productId: 'gh2284-no-product', quantity: 1 }],
            customer: {
                name: 'E2E Buyer', email, phone: '0123456789',
                address: { line1: '1 Jalan Test', state: 'Selangor' },
            },
            paymentMethod: 'cod',
        }

        // Act — type the reported 304-character address in the real checkout form.
        const geoReady = page.waitForResponse(response => new URL(response.url()).pathname === '/api/geo/states' && response.ok())
        await page.goto(`/sites/${encodeURIComponent(fixture.tenantSlug!)}/checkout`, { waitUntil: 'domcontentloaded' })
        await geoReady
        const emailInput = page.getByPlaceholder('ahmad@email.com')
        await expect(emailInput).toBeVisible()
        await emailInput.fill(email)
        await emailInput.blur()

        // Assert — buyer sees the reason at Email.
        await expect(page.locator('.ck-ferr', { hasText: 'Email must not exceed 254 characters' })).toBeVisible()

        // Assert — both live order APIs reject before any DB/provider work.
        const cod = await page.request.post('/api/orders/checkout', { data: body })
        expect(cod.status(), await cod.text()).toBe(400)
        expect((await cod.json()).error).toMatchObject({
            code: 'VALIDATION_ERROR',
            details: { fieldErrors: { customer: expect.arrayContaining(['String must contain at most 254 character(s)']) } },
        })

        const stripe = await page.request.post('/api/orders/stripe-checkout', { data: body })
        expect(stripe.status(), await stripe.text()).toBe(422)
        expect((await stripe.json()).error).toEqual({
            code: 'EMAIL_TOO_LONG',
            message: 'Email must not exceed 254 characters',
        })
    })
})
