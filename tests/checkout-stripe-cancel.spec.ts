import { test, expect } from '@playwright/test'

/**
 * TC-F13.05 — Cancel from Stripe redirects to ?stripe_cancelled=1, cart preserved
 *
 * Fixture required: fixture-both (tenant with card+fpx enabled, Stripe connected)
 * TODO: seed fixture-both tenant before enabling (tracked in GH issue)
 */
test('[TC-F13.05] cancel from Stripe redirects to ?stripe_cancelled=1 with cart preserved', async ({ page }) => {
    test.skip(true, 'fixture-both seed not yet provisioned — enable after seed script is merged')
    // Add item to cart
    await page.goto('/sites/fixture-both/p/sample-product')
    await page.getByRole('button', { name: /add to cart/i }).click()

    // Go to checkout
    await page.goto('/sites/fixture-both/checkout')
    await page.getByLabel(/name/i).fill('Test Buyer')
    await page.getByLabel(/email/i).fill('buyer@test.com')
    await page.getByText(/Pay with Stripe \(Card · FPX\)/).click()

    // Simulate Stripe cancel return (navigate directly — avoid real Stripe in E2E)
    await page.goto('/sites/fixture-both/checkout?stripe_cancelled=1')

    // Inline cancellation error must be visible
    await expect(page.getByText(/Payment was cancelled/i)).toBeVisible()

    // Cart items must still be present
    const cartCount = await page.locator('[data-testid="cart-count"]').textContent()
    expect(Number(cartCount)).toBeGreaterThan(0)

    // After rendering, query param should be stripped from URL
    await expect(page).toHaveURL(/\/sites\/fixture-both\/checkout$/)
})
