import { describe, it, expect } from 'vitest'
import { hasHeaderCart } from '@/lib/site-renderer/has-header-cart'

// TC-F09.209..211 — hasHeaderCart unit tests
describe('hasHeaderCart', () => {
    describe('TC-F09.209: null headerBlock → false', () => {
        it('should return false when headerBlock is null', () => {
            // Arrange
            const headerBlock = null

            // Act
            const result = hasHeaderCart(headerBlock)

            // Assert
            expect(result).toBe(false)
        })

        it('should return false when headerBlock is undefined', () => {
            // Arrange
            const headerBlock = undefined

            // Act
            const result = hasHeaderCart(headerBlock)

            // Assert
            expect(result).toBe(false)
        })

        it('should return false when headerBlock is not an object (string)', () => {
            // Arrange
            const headerBlock = 'not-an-object'

            // Act
            const result = hasHeaderCart(headerBlock)

            // Assert
            expect(result).toBe(false)
        })

        it('should return false when headerBlock is not an object (number)', () => {
            // Arrange
            const headerBlock = 123

            // Act
            const result = hasHeaderCart(headerBlock)

            // Assert
            expect(result).toBe(false)
        })

        it('should return false when headerBlock is not an object (boolean)', () => {
            // Arrange
            const headerBlock = true

            // Act
            const result = hasHeaderCart(headerBlock)

            // Assert
            expect(result).toBe(false)
        })
    })

    describe('TC-F09.210: headerBlock with showCart:true → true', () => {
        it('should return true when showCart field is true', () => {
            // Arrange
            const headerBlock = { showCart: true }

            // Act
            const result = hasHeaderCart(headerBlock)

            // Assert
            expect(result).toBe(true)
        })

        it('should return false when showCart is false', () => {
            // Arrange
            const headerBlock = { showCart: false }

            // Act
            const result = hasHeaderCart(headerBlock)

            // Assert
            expect(result).toBe(false)
        })

        it('should return true when cartButton.show is true', () => {
            // Arrange
            const headerBlock = { cartButton: { show: true } }

            // Act
            const result = hasHeaderCart(headerBlock)

            // Assert
            expect(result).toBe(true)
        })

        it('should return false when cartButton.show is false', () => {
            // Arrange
            const headerBlock = { cartButton: { show: false } }

            // Act
            const result = hasHeaderCart(headerBlock)

            // Assert
            expect(result).toBe(false)
        })

        it('should return true when both showCart and cartButton.show are true (showCart has priority)', () => {
            // Arrange
            const headerBlock = { showCart: true, cartButton: { show: false } }

            // Act
            const result = hasHeaderCart(headerBlock)

            // Assert
            expect(result).toBe(true) // showCart === true short-circuits OR
        })
    })

    describe('TC-F09.211: headerBlock without cart field → false', () => {
        it('should return false when headerBlock has no cart-related fields', () => {
            // Arrange
            const headerBlock = { links: [], logo: 'logo.png' }

            // Act
            const result = hasHeaderCart(headerBlock)

            // Assert
            expect(result).toBe(false)
        })

        it('should return false when showCart is missing (undefined)', () => {
            // Arrange
            const headerBlock = { cartButton: { label: 'Cart' } }

            // Act
            const result = hasHeaderCart(headerBlock)

            // Assert
            expect(result).toBe(false)
        })

        it('should return false when cartButton is missing (undefined)', () => {
            // Arrange
            const headerBlock = { showCart: undefined }

            // Act
            const result = hasHeaderCart(headerBlock)

            // Assert
            expect(result).toBe(false)
        })

        it('should return false when cartButton exists but show is missing', () => {
            // Arrange
            const headerBlock = { cartButton: { label: 'Shopping Cart', icon: 'cart-icon' } }

            // Act
            const result = hasHeaderCart(headerBlock)

            // Assert
            expect(result).toBe(false)
        })

        it('should return false when headerBlock is empty object', () => {
            // Arrange
            const headerBlock = {}

            // Act
            const result = hasHeaderCart(headerBlock)

            // Assert
            expect(result).toBe(false)
        })

        it('should handle complex header structures with other fields', () => {
            // Arrange
            const headerBlock = {
                blockType: 'navigation',
                brandName: 'My Store',
                links: [{ label: 'Home', url: '/' }],
                socialLinks: { facebook: 'https://facebook.com' },
            }

            // Act
            const result = hasHeaderCart(headerBlock)

            // Assert
            expect(result).toBe(false)
        })
    })
})
