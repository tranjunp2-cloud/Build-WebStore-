import { expect, test, type Page } from '@playwright/test'

type BuilderCase = {
    businessName: string
    products: string
    shortDescription: string
    expectedLocale: 'en' | 'ms' | 'vi' | 'it'
    detectedLabel?: string
}

async function arrangeBuilder(page: Page): Promise<Record<string, unknown>[]> {
    const requests: Record<string, unknown>[] = []

    await page.addInitScript(() => {
        window.localStorage.removeItem('prime-builder-session')
        window.localStorage.removeItem('prime-builder-session-meta')
    })
    await page.route('**/api/data/industries', (route) => route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ docs: [{ value: 'food-beverage', label: 'Food & Beverage' }] }),
    }))
    await page.route('**/api/slug/check?**', (route) => route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ available: true }),
    }))
    await page.route('**/api/ai/generate-site?stream=true', async (route) => {
        requests.push(route.request().postDataJSON() as Record<string, unknown>)
        await route.fulfill({
            contentType: 'text/event-stream',
            body: 'event: done\ndata: {"siteId":"1442","siteName":"Language Test","totalBlocks":1,"totalPages":1,"timeMs":1}\n\n',
        })
    })

    await page.goto('/builder/new')
    // GH-2154: an account that already owns a site is redirected away from the builder.
    if (new URL(page.url()).pathname.startsWith('/dashboard')) {
        test.skip(true, 'GH-2154: account already owns a site; needs a no-site e2e account')
    }
    return requests
}

async function fillBusinessForm(page: Page, input: BuilderCase): Promise<void> {
    const businessName = page.locator('input[placeholder*="business" i], input[placeholder*="name" i]').first()
    const textareas = page.locator('textarea')

    await expect(businessName).toBeVisible()
    await businessName.fill(input.businessName)
    await page.getByRole('button', { name: 'Food & Beverage' }).click()
    await textareas.first().fill(input.products)
    await textareas.last().fill(input.shortDescription)
}

const directCases: BuilderCase[] = [
    {
        businessName: 'Golden Hair',
        products: 'custom hair cuts and styling',
        shortDescription: 'friendly local beauty team with quality work daily',
        expectedLocale: 'en',
    },
    {
        businessName: 'Kedai Murni',
        products: 'makanan segar setiap hari',
        shortDescription: 'produk berkualiti untuk pelanggan tempatan',
        expectedLocale: 'ms',
    },
]

for (const input of directCases) {
    test(`[TC-F26-11-08] Auto ${input.expectedLocale.toUpperCase()} generates directly with the detected locale`, async ({ page }) => {
        // Arrange
        const requests = await arrangeBuilder(page)
        await fillBusinessForm(page, input)

        // Act
        await page.getByRole('button', { name: /generate/i }).click()

        // Assert
        await expect.poll(() => requests.length).toBe(1)
        expect(requests[0]).toMatchObject({ language: 'auto', generationLocale: input.expectedLocale })
        await expect(page.getByRole('heading', { name: /language detected/i })).toHaveCount(0)
    })
}

const confirmationCases: BuilderCase[] = [
    {
        businessName: 'Tiệm Bánh Hoa Mai',
        products: 'bánh ngọt thơm ngon mỗi ngày',
        shortDescription: 'phục vụ khách hàng tận tâm',
        expectedLocale: 'vi',
        detectedLabel: 'Vietnamese',
    },
    {
        businessName: 'Ristorante Italiano',
        products: 'ottimi dolci e birra',
        shortDescription: 'cucina italiana autentica',
        expectedLocale: 'it',
        detectedLabel: 'Italian',
    },
]

for (const input of confirmationCases) {
    test(`[TC-F26-11-08] Auto ${input.expectedLocale.toUpperCase()} confirms the detected locale before generation`, async ({ page }) => {
        // Arrange
        const requests = await arrangeBuilder(page)
        await fillBusinessForm(page, input)

        // Act
        await page.getByRole('button', { name: /generate/i }).click()
        const dialogHeading = page.getByRole('heading', { name: `${input.detectedLabel} language detected` })
        await expect(dialogHeading).toBeVisible()

        // Assert
        expect(requests).toHaveLength(0)
        await page.getByRole('button', { name: new RegExp(`${input.detectedLabel}.*${input.expectedLocale}`, 'i') }).click()
        await page.getByRole('button', { name: 'Continue' }).click()
        await expect.poll(() => requests.length).toBe(1)
        expect(requests[0]).toMatchObject({ generationLocale: input.expectedLocale })
    })
}
