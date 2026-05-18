import { test, expect } from '@playwright/test'

/**
 * TC-F13.35, TC-F13.36 — Seller settings: payment toggles locked when Stripe not ready
 *
 * Fixture: tests/.auth/seller-no-stripe.json
 *   → authenticated seller session where tenant.stripeOnboardingComplete=false
 */
test.describe('Seller settings — payments locked state [TC-F13.35..36]', () => {
    test.use({ storageState: 'tests/.auth/seller-no-stripe.json' })

    test('[TC-F13.35] Card+FPX toggles disabled with lock icon + Connect CTA visible', async ({ page }) => {
        await page.goto('/dashboard/settings/payments')

        // Connect CTA must be visible
        await expect(page.getByRole('button', { name: /Connect Stripe/i })).toBeVisible()

        // Explanation text visible
        await expect(page.getByText(/Connect Stripe to accept Card & FPX/)).toBeVisible()

        // Card toggle must be disabled
        const cardToggle = page.locator('[data-method="card"] input[type=checkbox]').first()
        await expect(cardToggle).toBeDisabled()

        // FPX toggle must be disabled
        const fpxToggle = page.locator('[data-method="fpx"] input[type=checkbox]').first()
        await expect(fpxToggle).toBeDisabled()
    })

    test('[TC-F13.36] clicking disabled toggle shows toast + scrolls Connect CTA into viewport', async ({ page }) => {
        await page.goto('/dashboard/settings/payments')

        // Click the disabled toggle container (force since the input itself is disabled)
        await page.locator('[data-method="card"]').click({ force: true })

        // Toast notification must appear
        await expect(page.getByText(/Connect Stripe first/i)).toBeVisible()

        // Connect CTA must scroll into viewport
        const cta = page.getByRole('button', { name: /Connect Stripe/i })
        await expect(cta).toBeInViewport()
    })
})
