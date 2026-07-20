import { test, expect } from '@playwright/test'
import { photoMatchesTerms } from '@/lib/ai/pixabay-client'

type MediaValue = {
    alt?: string
    filename?: string
    url?: string
}

type PageDocument = {
    blocks?: unknown[]
}

type PagesResponse = {
    docs?: PageDocument[]
}

function collectMedia(value: unknown, result: MediaValue[] = []): MediaValue[] {
    if (Array.isArray(value)) {
        for (const item of value) collectMedia(item, result)
        return result
    }
    if (!value || typeof value !== 'object') return result

    const record = value as Record<string, unknown>
    if (typeof record.url === 'string' && (
        typeof record.alt === 'string' || typeof record.filename === 'string'
    )) {
        result.push({
            url: record.url,
            alt: typeof record.alt === 'string' ? record.alt : undefined,
            filename: typeof record.filename === 'string' ? record.filename : undefined,
        })
    }
    for (const child of Object.values(record)) collectMedia(child, result)
    return result
}

function collectGalleryMedia(pages: PageDocument[]): MediaValue[] {
    const media: MediaValue[] = []

    const visit = (value: unknown): void => {
        if (Array.isArray(value)) {
            for (const item of value) visit(item)
            return
        }
        if (!value || typeof value !== 'object') return

        const record = value as Record<string, unknown>
        if (record.blockType === 'gallery') {
            collectMedia(record, media)
            return
        }
        for (const child of Object.values(record)) visit(child)
    }

    for (const page of pages) visit(page.blocks ?? [])
    return media
}

function readGeneratedSiteId(sseBody: string): string {
    const doneEvent = sseBody.match(/event: done\s+data: (\{[^\n]+\})/u)
    expect(doneEvent, 'generation stream must contain a done event').not.toBeNull()

    const payload = JSON.parse(doneEvent![1]!) as { siteId?: string | number }
    expect(payload.siteId, 'done event must include the generated site ID').toBeDefined()
    return String(payload.siteId)
}

test.describe('GH-1611 bakery gallery image relevance', () => {
    test('[TC-GH1611-E2E] F&B Builder flow does not persist cross-industry Gallery images', async ({ page }) => {
        // Arrange — real generation consumes external AI/Pixabay quota.
        test.skip(!process.env.RUN_BUILDER_GEN, 'Set RUN_BUILDER_GEN=1 to run the real generation regression')
        test.slow()
        test.setTimeout(360_000)

        await page.goto('/builder/new')
        await expect(page.locator('form input').first()).toBeVisible()

        await page.locator('form input').first().fill(`GH1611 Bakery ${Date.now()}`)
        await page.getByRole('button', { name: /F&B \/ Cafe \/ Bakery/i }).click()
        const textareas = page.locator('form textarea')
        await expect(textareas).toHaveCount(2)
        const bakeryProducts = ['chocolate cake', 'frosted cupcake', 'bakery bread']
        await textareas.nth(0).fill(bakeryProducts.join(', '))
        await textareas.nth(1).fill('Fresh breads, cakes and pastries baked daily.')

        const generationResponse = page.waitForResponse((response) => (
            response.url().includes('/api/ai/generate-site?stream=true') &&
            response.request().method() === 'POST'
        ))
        await page.getByRole('button', { name: /Generate Website|Jana Laman Web/i }).click()

        // Act — wait for the real browser-triggered generation stream and inspect
        // the pages persisted by that exact generation.
        const response = await generationResponse
        expect(response.ok()).toBe(true)
        const siteId = readGeneratedSiteId(await response.text())
        const pagesResponse = await page.request.get(`/api/pages?where[site][equals]=${siteId}&depth=2`)

        // Assert — the test must fail if no Gallery/media was generated; a vacuous
        // loop over an empty pool would not protect the reported 6-slot regression.
        expect(pagesResponse.ok()).toBe(true)
        const pages = await pagesResponse.json() as PagesResponse
        const galleryMedia = collectGalleryMedia(pages.docs ?? [])

        expect(galleryMedia.length).toBeGreaterThan(0)
        const crossIndustry = /clothing|dress|jeans|shirt|fashion|suit|wear|jacket|garment|boutique/i
        for (const image of galleryMedia) {
            const metadata = `${image.alt ?? ''} ${image.filename ?? ''}`
            expect(metadata).not.toMatch(crossIndustry)
            expect(photoMatchesTerms(metadata, bakeryProducts)).toBe(true)
        }
    })
})
