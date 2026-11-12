import { expect, test } from '@playwright/test'
import { getFirstSiteId } from '../e2e/helpers/navigation'

const SEARCH_BUDGET_MS = 2_000

function requireTemplates(body: unknown): Array<{
    id: string | number
    name: string
    description?: string
    category: string[]
    tags?: Array<{ tag: string }>
}> {
    if (
        typeof body !== 'object' || body === null ||
        !('success' in body) || body.success !== true ||
        !('data' in body) || typeof body.data !== 'object' || body.data === null ||
        !('templates' in body.data) || !Array.isArray(body.data.templates)
    ) {
        throw new Error('Template search returned an invalid success envelope')
    }
    return body.data.templates as Array<{
        id: string | number
        name: string
        description?: string
        category: string[]
        tags?: Array<{ tag: string }>
    }>
}

test.describe.serial('[US-F07-04] authenticated template search', () => {
    test('[TC_F07_037-AUTH] rejects an anonymous request with the standard error envelope', async ({ playwright, baseURL }) => {
        // playwright.request.newContext() inherits the project's storageState (logged-in cookies); clear it.
        const anonymous = await playwright.request.newContext({
            baseURL,
            storageState: { cookies: [], origins: [] },
        })

        try {
            const response = await anonymous.post('/api/templates/search', {
                data: { query: 'kedai baju', locale: 'ms' },
            })
            const body = await response.json()

            expect(response.status()).toBe(401)
            expect(body).toMatchObject({
                success: false,
                error: {
                    code: 'AUTH_REQUIRED',
                    message: expect.any(String),
                    requestId: expect.any(String),
                },
            })
        } finally {
            await anonymous.dispose()
        }
    })

    test('[TC_F07_037-PERF] returns at least two VI and BM matches within two seconds', async ({ request }) => {
        for (const search of [
            {
                query: 'mẫu cho shop thể thao',
                locale: 'vi',
                expectedCategory: 'ecommerce',
                expectedTags: ['sport', 'sports', 'fitness', 'activewear', 'equipment'],
            },
            {
                query: 'kedai baju',
                locale: 'ms',
                expectedCategory: 'ecommerce',
                expectedTags: [],
            },
        ]) {
            const startedAt = performance.now()
            const response = await request.post('/api/templates/search', {
                data: { query: search.query, locale: search.locale },
            })
            const elapsedMs = performance.now() - startedAt
            const body = await response.json()

            expect(response.ok(), JSON.stringify(body)).toBe(true)
            const templates = requireTemplates(body)
            if (search.locale === 'ms') {
                expect(templates.every((template) => /fashion|clothing|boutique|apparel|activewear|streetwear/i.test(
                    [template.name, template.description, ...(template.tags ?? []).map(({ tag }) => tag)].join(' '),
                ))).toBe(true)
            }
            expect(templates.length).toBeGreaterThanOrEqual(2)
            expect(templates.every((template) => template.category.includes(search.expectedCategory))).toBe(true)
            if (search.expectedTags.length > 0) {
                expect(templates.every((template) => template.tags?.some(({ tag }) => (
                    search.expectedTags.includes(tag)
                )))).toBe(true)
            }
            expect(elapsedMs).toBeLessThan(SEARCH_BUDGET_MS)
            expect((body as { meta?: { timestamp?: unknown } }).meta?.timestamp).toEqual(expect.any(String))
        }
    })

    test('[TC_F07_037-MOBILE] renders search and empty states without 375px overflow', async ({ page }) => {
        const siteId = process.env.E2E_SITE_ID || await getFirstSiteId(page)
        if (!siteId) {
            throw new Error('US-F07-04 requires an owned site; set E2E_SITE_ID or seed the E2E account')
        }

        await page.setViewportSize({ width: 375, height: 812 })
        // Keep first-visit editor onboarding from intercepting the search flow.
        // This test covers F07 search, not the independently tested coach marks.
        await page.addInitScript(() => {
            window.localStorage.setItem('editor:coach-marks:v1:seen', 'true')
        })
        await page.goto(`/editor/${encodeURIComponent(siteId)}`, { waitUntil: 'domcontentloaded' })
        await page.getByTitle('Templates').click()

        const dialog = page.getByRole('dialog', { name: /choose a template/i })
        const searchInput = dialog.getByRole('textbox', { name: /search templates/i })
        await expect(dialog).toBeVisible()
        await expect(searchInput).toBeVisible()

        await searchInput.fill('mẫu cho shop thể thao')
        const startedAt = performance.now()
        const searchResponse = page.waitForResponse((response) => (
            response.url().endsWith('/api/templates/search') && response.request().method() === 'POST'
        ))
        await searchInput.press('Enter')
        expect((await searchResponse).ok()).toBe(true)
        await expect(dialog.getByTestId('template-card-wrapper').filter({ hasText: 'Sports Equipment Pro' })).toBeVisible()
        await expect.poll(
            () => dialog.getByTestId('template-card-wrapper').count(),
            { timeout: SEARCH_BUDGET_MS },
        ).toBeGreaterThanOrEqual(2)
        expect(performance.now() - startedAt).toBeLessThan(SEARCH_BUDGET_MS)

        const firstCard = dialog.getByTestId('template-card-wrapper').first()
        const previewAction = firstCard.getByRole('button', { name: /preview/i })
        const useAction = firstCard.getByRole('button', { name: /use .*template/i })
        await expect(previewAction).toBeVisible()
        await expect(useAction).toBeVisible()
        for (const action of [previewAction, useAction]) {
            const actionBounds = await action.boundingBox()
            expect(actionBounds).not.toBeNull()
            expect(actionBounds!.height).toBeGreaterThanOrEqual(44)
            expect(actionBounds!.x).toBeGreaterThanOrEqual(0)
            expect(actionBounds!.x + actionBounds!.width).toBeLessThanOrEqual(375)
        }

        await searchInput.fill('phi hành gia vũ trụ')
        await searchInput.press('Enter')
        await expect(dialog.getByTestId('template-search-empty')).toBeVisible()
        await expect(dialog.getByText('Không tìm thấy mẫu phù hợp')).toBeVisible()
        await expect(dialog.getByTestId('template-search-empty').getByRole('button', { name: /clear search/i })).toBeVisible()

        const bounds = await dialog.boundingBox()
        expect(bounds).not.toBeNull()
        expect(bounds!.x).toBeGreaterThanOrEqual(0)
        expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(375)
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375)
    })
})
