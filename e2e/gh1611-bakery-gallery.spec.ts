import { test, expect } from '@playwright/test'
import { buildImagePool } from '@/lib/ai/image-pool'

test.describe('GH-1611 E2E/API Flow - Bakery gallery images gating', () => {
    test('F&B input (Bakery) -> Gallery does not receive cross-industry fallback images', async () => {
        // Run buildImagePool for a Bakery business (category: fnb, products: ['bánh'])
        // This will perform the real Pixabay API search if PIXABAY_API_KEY is configured,
        // or fallback to curated list if not.
        const pool = await buildImagePool({
            category: 'fnb',
            products: ['bánh'],
            seed: 42,
            squareSize: 0,
        })

        // Assert that the pool was successfully created
        expect(pool).toBeDefined()
        expect(pool.landscape).toBeDefined()

        // Verify that none of the returned images have tags containing clothing/retail keywords
        const CLOTHING_KEYWORDS = ['clothing', 'dress', 'jeans', 'boutique', 'shirt', 'garment', 'fashion']
        for (const photo of pool.landscape) {
            const altLower = (photo.alt || '').toLowerCase()
            const matchesClothing = CLOTHING_KEYWORDS.some(keyword => altLower.includes(keyword))
            expect(matchesClothing).toBe(false)
        }
    })
})
