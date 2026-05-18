import { describe, it, expect } from 'vitest'
import { detectCommercePresence } from '@/lib/site-renderer/detect-commerce-presence'

// TC-F09.205..208 — detectCommercePresence unit tests
describe('detectCommercePresence', () => {
    describe('TC-F09.205: Empty pages → false', () => {
        it('should return false for empty pages array', () => {
            // Arrange
            const pages = []

            // Act
            const result = detectCommercePresence(pages)

            // Assert
            expect(result).toBe(false)
        })
    })

    describe('TC-F09.206: No commerce blocks → false', () => {
        it('should return false when pages have non-commerce blocks', () => {
            // Arrange
            const pages = [
                {
                    layout: [
                        { blockType: 'hero', title: 'Welcome' },
                        { blockType: 'features', items: [] },
                    ],
                },
            ]

            // Act
            const result = detectCommercePresence(pages)

            // Assert
            expect(result).toBe(false)
        })

        it('should return false when layout is empty', () => {
            // Arrange
            const pages = [{ layout: [] }]

            // Act
            const result = detectCommercePresence(pages)

            // Assert
            expect(result).toBe(false)
        })

        it('should return false when pages have no layout', () => {
            // Arrange
            const pages = [{}]

            // Act
            const result = detectCommercePresence(pages)

            // Assert
            expect(result).toBe(false)
        })
    })

    describe('TC-F09.207: Page with products-grid → true', () => {
        it('should return true when products-grid block exists', () => {
            // Arrange
            const pages = [
                {
                    layout: [
                        { blockType: 'hero' },
                        { blockType: 'products-grid', columns: 3 },
                    ],
                },
            ]

            // Act
            const result = detectCommercePresence(pages)

            // Assert
            expect(result).toBe(true)
        })

        it('should return true when products-featured block exists', () => {
            // Arrange
            const pages = [
                {
                    layout: [
                        { blockType: 'products-featured', limit: 5 },
                    ],
                },
            ]

            // Act
            const result = detectCommercePresence(pages)

            // Assert
            expect(result).toBe(true)
        })

        it('should return true when product-quick-view block exists', () => {
            // Arrange
            const pages = [
                {
                    layout: [
                        { blockType: 'product-quick-view', productId: '123' },
                    ],
                },
            ]

            // Act
            const result = detectCommercePresence(pages)

            // Assert
            expect(result).toBe(true)
        })

        it('should return true when commerce block exists among multiple pages', () => {
            // Arrange
            const pages = [
                { layout: [{ blockType: 'hero' }] },
                { layout: [{ blockType: 'products-grid' }] },
                { layout: [{ blockType: 'contact' }] },
            ]

            // Act
            const result = detectCommercePresence(pages)

            // Assert
            expect(result).toBe(true)
        })
    })

    describe('TC-F09.208: Malformed layout (non-array) → false (no crash)', () => {
        it('should return false when layout is not an array (null)', () => {
            // Arrange
            const pages = [{ layout: null }]

            // Act
            const result = detectCommercePresence(pages)

            // Assert
            expect(result).toBe(false)
        })

        it('should return false when layout is not an array (string)', () => {
            // Arrange
            const pages = [{ layout: 'not-an-array' as unknown }]

            // Act
            const result = detectCommercePresence(pages)

            // Assert
            expect(result).toBe(false)
        })

        it('should return false when layout is not an array (object)', () => {
            // Arrange
            const pages = [{ layout: { blockType: 'hero' } as unknown }]

            // Act
            const result = detectCommercePresence(pages)

            // Assert
            expect(result).toBe(false)
        })

        it('should handle blocks without blockType gracefully', () => {
            // Arrange
            const pages = [
                {
                    layout: [
                        { name: 'Block without type' },
                        { blockType: 'products-grid' },
                    ],
                },
            ]

            // Act
            const result = detectCommercePresence(pages)

            // Assert
            expect(result).toBe(true) // Still finds the commerce block
        })

        it('should handle null blocks in layout array', () => {
            // Arrange
            const pages = [
                {
                    layout: [
                        null,
                        { blockType: 'products-grid' },
                    ] as unknown[],
                },
            ]

            // Act
            const result = detectCommercePresence(pages)

            // Assert
            expect(result).toBe(true)
        })

        it('should not crash when page object itself is malformed', () => {
            // Arrange
            const pages = [
                { layout: [{ blockType: 'hero' }] },
                { layout: [{ blockType: 'products-grid' }] },
            ] as Array<{ layout?: unknown[] }>

            // Act
            const result = detectCommercePresence(pages)

            // Assert
            expect(result).toBe(true)
        })
    })
})
