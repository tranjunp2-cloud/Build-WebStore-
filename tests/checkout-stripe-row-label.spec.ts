import { test, expect } from '@playwright/test'

/**
 * TC-F13.31..34 — Storefront checkout: single Stripe row label rendering
 *
 * Fixtures required (create in tests/.fixtures/ seed if absent):
 *   fixture-both      → tenant payment_card=true + payment_fpx=true, site permissive
 *   fixture-card-only → tenant payment_card=true + payment_fpx=false
 *   fixture-fpx-only  → tenant payment_card=false + payment_fpx=true
 *   fixture-no-stripe → tenant payment_card=false + payment_fpx=false (or no Stripe connected)
 */
test.describe('Storefront checkout — single Stripe row label [TC-F13.31..34]', () => {
    test('[TC-F13.31] both flags ON renders "Pay with Stripe (Card · FPX)"', async ({ page }) => {
        await page.goto('/sites/fixture-both/checkout')
        await expect(page.getByText(/Pay with Stripe \(Card · FPX\)/)).toBeVisible()
        // Individual method buttons must NOT appear — only the combined row
        await expect(page.getByText(/^Pay with Card$/)).toHaveCount(0)
        await expect(page.getByText(/^Pay with FPX$/)).toHaveCount(0)
    })

    test('[TC-F13.32] card-only renders "Pay with Card"', async ({ page }) => {
        await page.goto('/sites/fixture-card-only/checkout')
        await expect(page.getByText('Pay with Card')).toBeVisible()
        await expect(page.getByText(/Card · FPX/)).toHaveCount(0)
    })

    test('[TC-F13.33] fpx-only renders "Pay with FPX (Online Banking)"', async ({ page }) => {
        await page.goto('/sites/fixture-fpx-only/checkout')
        await expect(page.getByText('Pay with FPX (Online Banking)')).toBeVisible()
        await expect(page.getByText(/Card · FPX/)).toHaveCount(0)
    })

    test('[TC-F13.34] both flags OFF hides Stripe row entirely', async ({ page }) => {
        await page.goto('/sites/fixture-no-stripe/checkout')
        await expect(page.getByText(/Pay with Stripe/)).toHaveCount(0)
        await expect(page.getByText(/Pay with Card/)).toHaveCount(0)
        await expect(page.getByText(/Pay with FPX/)).toHaveCount(0)
        // COD or other methods should still be visible
        await expect(page.getByText(/Cash on Delivery|COD/i)).toBeVisible()
    })
})
