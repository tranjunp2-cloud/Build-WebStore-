import { test, expect } from '@playwright/test'

/**
 * TC-GH1611-E2E — F&B input site generation E2E test.
 * Verifies that generating a site for a bakery / F&B input does not receive cross-industry fallback images.
 */
test.describe('GH-1611 AI Image wrong industry [TC-GH1611-E2E]', () => {
    // Skip by default unless RUN_BUILDER_GEN is true, since real generation requires OpenAI & Pixabay and is slow.
    test.skip(!process.env.RUN_BUILDER_GEN, 'Set RUN_BUILDER_GEN=1 to run full AI generation E2E test')

    test('F&B input generation does not receive cross-industry fallback images', async ({ request }) => {
        // Trigger site generation API directly (API-level flow)
        const response = await request.post('/api/ai/generate-site', {
            data: {
                businessInfo: {
                    businessName: 'Bun & Baguette',
                    industry: '🍜 F&B / Cafe / Bakery',
                    products: 'bánh mì, croissant, chocolate cake',
                    shortDescription: 'Fresh sourdough breads and pastries baked daily.',
                },
            },
            timeout: 120000, // 2 minutes timeout for AI gen
        })

        expect(response.ok()).toBeTruthy()
        const result = await response.json()
        expect(result.success).toBe(true)

        // The response should have site data and created pages.
        // We can inspect the site page blocks and verify image fields do not contain off-industry keywords (like clothing).
        const siteId = result.siteId
        const pagesResponse = await request.get(`/api/pages?where[site][equals]=${siteId}`)
        expect(pagesResponse.ok()).toBeTruthy()
        const pagesResult = await pagesResponse.json()
        
        // Go through all block images and verify no clothes/fashion images are present.
        const offIndustryPattern = /clothing|dress|jeans|shirt|fashion|suit|wear|jacket/i
        
        let checkedImagesCount = 0
        for (const page of pagesResult.docs) {
            for (const block of page.blocks || []) {
                const images: any[] = []
                if (block.backgroundImage?.url) images.push(block.backgroundImage)
                if (Array.isArray(block.images)) {
                    for (const img of block.images) {
                        if (img.image?.url) images.push(img.image)
                    }
                }
                
                for (const img of images) {
                    checkedImagesCount++
                    const altText = img.alt || ''
                    const filename = img.filename || ''
                    const combined = `${altText} ${filename}`.toLowerCase()
                    expect(offIndustryPattern.test(combined)).toBeFalsy()
                }
            }
        }
        
        expect(checkedImagesCount).toBeGreaterThan(0)
    })
})
