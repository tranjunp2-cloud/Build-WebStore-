import { test, expect } from '@playwright/test'

test.describe('Storefront Smoke Test', () => {
    test('homepage loads', async ({ page }) => {
        await page.goto('/')
        await expect(page).toHaveTitle(/PrimeWeb/i)
    })
})
