import { expect, test } from '@playwright/test'

// [TC-F09.298] GH-2275 — Mobile 375×812: menu hamburger có form Track order, cuộn tới được, gửi mã → điều hướng + đóng menu.
// Cần store có cart widget (mặc định `glowbox-toys`; đổi bằng E2E_CART_PRODUCT_PATH giống các spec cart khác).
const SITE_PATH = process.env.E2E_CART_PRODUCT_PATH?.split('/products/')[0] || '/sites/glowbox-toys'

test.use({ viewport: { width: 375, height: 812 } })

test('[TC-F09.298] mobile menu → Track order: cuộn tới form, gửi mã, điều hướng và đóng menu', async ({ page }) => {
    await page.goto(SITE_PATH)
    await page.getByRole('button', { name: 'Open menu' }).click()

    const form = page.getByTestId('nav-order-search-inline')
    await form.scrollIntoViewIfNeeded()
    await expect(form).toBeInViewport({ ratio: 1 })

    await form.getByRole('textbox').fill('ORD-E2E-1')
    // Locale-independent: the submit label is translated (EN "Track order" / MS "Jejak pesanan").
    await form.locator('button[type="submit"]').click()

    await expect(page).toHaveURL(/\/orders\/ORD-E2E-1/)
    // Menu closes on submit (the drawer unmounts, so the form is gone from the DOM).
    await expect(form).toHaveCount(0)
})
