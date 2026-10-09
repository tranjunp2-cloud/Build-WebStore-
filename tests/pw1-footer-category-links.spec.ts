import { expect, test } from '@playwright/test'

// Local migration regression fixture: imported SJS store, source store 834.
const storePath = '/sites/superior-janitorial-supplies-sdn-bhd'

test('[TC-F35.M27] unavailable footer category still opens PW2 Products with an empty selection', async ({ page, request }) => {
    // Arrange: run against the real migrated fixture; do not synthesize BE records.
    const response = await request.get(storePath)
    test.skip(response.status() === 404, 'SJS migration fixture is not present in this environment')
    expect(response.ok()).toBeTruthy()
    await page.goto(storePath)

    for (const platform of ['facebook','instagram','twitter']) {
        await expect(page.locator('footer').getByRole('link', {name:`Visit ${platform}`,exact:true})).toBeVisible()
    }

    // Act: follow the actual footer link.
    await page.locator('footer').getByText('Corporate Profile', { exact: true }).click()

    // Assert: PW1 IDs never become PW2 category IDs or unfiltered product results.
    await expect(page).toHaveURL(/\/products\?categoryId=0/)
    await expect(page.getByText('No products match your filters.', { exact: true })).toBeVisible()
    await expect(page.locator('[data-testid="products-grid-skeleton"]')).toHaveCount(0)
    await page.getByRole('button', { name: 'Clear all filters' }).click()
    await expect(page).not.toHaveURL(/categoryId=0/)
})

test('[TC-F35.M27] migrated contact and online-shop columns retain their source links', async ({ page }) => {
    for (const store of [
        {slug:'standard-fame-sdnbhd', column:'CONTACT SUPPORT', labels:['WhatsApp']},
        {slug:'brilliant-max-engineering-sdn-bhd', column:'CONTACT INFO', labels:['WhatsApp']},
        {slug:'kp-fruits-trading', column:'Online Shop', labels:['GrabMart','Foodpanda','WhatsApp','Google Maps']},
    ]) {
        await page.goto(`/sites/${store.slug}`)
        await expect(page.locator('footer').getByRole('heading', {name:store.column, exact:true})).toBeVisible()
        for (const name of store.labels) await expect(page.locator('footer').getByRole('link', {name, exact:true})).toHaveAttribute('href', /^https:\/\//)
    }
    await page.goto('/sites/brilliant-max-engineering-sdn-bhd')
    const contact = page.locator('footer').getByRole('heading', {name:'CONTACT INFO',exact:true}).locator('..')
    await expect(contact).toContainText('Fax: +60 3-8961 7748')
})

test('[TC-F35.M27] AARGYP retains a URL-less CTA and exposes the native cart', async ({ page }) => {
    await page.goto('/sites/aargyp-scientific-sdn-bhd')
    const cta = page.getByText('GET STARTED', {exact:true})
    await expect(cta).toBeVisible()
    await expect(cta).not.toHaveAttribute('href')
    const before = page.url()
    await cta.click()
    await expect(page).toHaveURL(before)
    // Next's development badge overlaps the floating cart; exclude development chrome only.
    await page.addStyleTag({content:'nextjs-portal { display: none !important; }'})
    // The native floating cart trigger has a numeric quantity and a shopping-bag icon.
    const cart = page.locator('button').filter({hasText:/^0$/})
    await expect(cart).toBeVisible()
    await cart.click()
    await expect(page.getByText('Your cart is empty', {exact:false})).toBeVisible()
})
