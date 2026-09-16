import {test,expect} from '@playwright/test'

// Local published pilot data. Real navigation, without mocked network responses.
test('[TC-F35.M42] migrated hero CTA stays inside the destination store', async ({page}) => {
    await page.goto('http://localhost:3000/sites/pc-demo-11',{waitUntil:'domcontentloaded'})
    const link=page.locator('a[href="/sites/pc-demo-11/about-us"]').last()
    await expect(link).toBeVisible()
    await link.click()
    await expect(page).toHaveURL('http://localhost:3000/sites/pc-demo-11/about-us')
})

test('[TC-F35.M42] rich text uses the local store prefix and preserves external links', async ({page}) => {
    await page.goto('http://localhost:3000/sites/yan-test-001',{waitUntil:'domcontentloaded'})
    const document=page.locator('.custom-html-block')
    const link=document.locator('a[href="/sites/yan-test-001/contact-us"]').first()
    await expect(link).toBeVisible()
    await expect(document.locator('a[href="https://maps.app.goo.gl/PaB1UdK8xoLP3aCV8"]').first()).toHaveAttribute('href','https://maps.app.goo.gl/PaB1UdK8xoLP3aCV8')
    await link.click()
    await expect(page).toHaveURL('http://localhost:3000/sites/yan-test-001/contact-us')
})

test('[TC-F35.M42] reviewed source typo opens the real migrated page',async({page})=>{
    await page.goto('http://localhost:3000/sites/yan-test-001',{waitUntil:'domcontentloaded'})
    const link=page.locator('.custom-html-block a[href="/sites/yan-test-001/product-service"]').first()
    await expect(link).toBeVisible()
    await link.click()
    await expect(page).toHaveURL('http://localhost:3000/sites/yan-test-001/product-service')
    await expect(page.getByText('This page could not be found')).toHaveCount(0)
})

test('[TC-F35.M42] migrated checkout link opens PW2 without submitting an order',async({page})=>{
    await page.goto('http://localhost:3000/sites/pc-demo-8',{waitUntil:'domcontentloaded'})
    const link=page.locator('a[href="/sites/pc-demo-8/checkout"]').first()
    await expect(link).toBeVisible()
    await link.click()
    await expect(page).toHaveURL('http://localhost:3000/sites/pc-demo-8/checkout',{timeout:30000})
})
