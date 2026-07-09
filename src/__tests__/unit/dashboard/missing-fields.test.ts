/**
 * Pure Function Unit Tests — Missing Fields Helper (GH-1457)
 * Coverage Map:
 *   TC-09.21 → getMissingFields: no images → returns ['alt']
 *   TC-09.22 → getMissingFields: image without alt → returns ['alt']
 *   TC-09.23 → getMissingFields: image with alt → returns []
 *   TC-09.24 → getMissingFields: no category → returns ['category']
 *   TC-09.25 → getMissingFields: empty category array → returns ['category']
 *   TC-09.26 → getMissingFields: non-empty category → returns []
 *   TC-09.27 → getMissingFields: both missing → returns ['alt', 'category']
 *   TC-09.28 → getMissingFields: alt missing, category present → returns ['alt']
 *   TC-09.29 → getMissingFields: alt present, category missing → returns ['category']
 *   TC-09.30 → getMissingFields: both present → returns []
 */

import { describe, it, expect } from 'vitest'
import { getMissingFields, type MissingField } from '@/lib/products/missing-fields'

// ──────────────────────────────────────────────────────────────────────────────
// TC-09.21–23: Image ALT text detection
// ──────────────────────────────────────────────────────────────────────────────
describe('getMissingFields — Image ALT text', () => {
    it('TC-09.21: returns [alt] when product has no images', () => {
        // Arrange
        const product = { images: undefined, category: ['electronics'] }

        // Act
        const missing = getMissingFields(product)

        // Assert
        expect(missing).toEqual(['alt'])
    })

    it('TC-09.21b: returns [alt] when images array is empty', () => {
        // Arrange
        const product = { images: [], category: ['electronics'] }

        // Act
        const missing = getMissingFields(product)

        // Assert
        expect(missing).toEqual(['alt'])
    })

    it('TC-09.22: returns [alt] when first image has no alt text', () => {
        // Arrange
        const product = { images: [{ alt: undefined }], category: ['electronics'] }

        // Act
        const missing = getMissingFields(product)

        // Assert
        expect(missing).toEqual(['alt'])
    })

    it('TC-09.22b: returns [alt] when first image alt is empty string', () => {
        // Arrange
        const product = { images: [{ alt: '' }], category: ['electronics'] }

        // Act
        const missing = getMissingFields(product)

        // Assert
        expect(missing).toEqual(['alt'])
    })

    it('TC-09.23: returns [] when first image has non-empty alt text', () => {
        // Arrange
        const product = { images: [{ alt: 'Product photo' }], category: ['electronics'] }

        // Act
        const missing = getMissingFields(product)

        // Assert
        expect(missing).toEqual([])
    })

    it('TC-09.23b: returns [] when first image has alt (ignores subsequent images without alt)', () => {
        // Arrange
        const product = {
            images: [{ alt: 'First photo' }, { alt: undefined }, { alt: '' }],
            category: ['electronics'],
        }

        // Act
        const missing = getMissingFields(product)

        // Assert
        expect(missing).toEqual([])
    })
})

// ──────────────────────────────────────────────────────────────────────────────
// TC-09.24–26: Category detection
// ──────────────────────────────────────────────────────────────────────────────
describe('getMissingFields — Category', () => {
    it('TC-09.24: returns [category] when product has no category', () => {
        // Arrange
        const product = { images: [{ alt: 'Photo' }], category: undefined }

        // Act
        const missing = getMissingFields(product)

        // Assert
        expect(missing).toEqual(['category'])
    })

    it('TC-09.25: returns [category] when category array is empty', () => {
        // Arrange
        const product = { images: [{ alt: 'Photo' }], category: [] }

        // Act
        const missing = getMissingFields(product)

        // Assert
        expect(missing).toEqual(['category'])
    })

    it('TC-09.26: returns [] when category array is non-empty', () => {
        // Arrange
        const product = { images: [{ alt: 'Photo' }], category: ['electronics'] }

        // Act
        const missing = getMissingFields(product)

        // Assert
        expect(missing).toEqual([])
    })

    it('TC-09.26b: returns [] when category has multiple items', () => {
        // Arrange
        const product = { images: [{ alt: 'Photo' }], category: ['electronics', 'gadgets'] }

        // Act
        const missing = getMissingFields(product)

        // Assert
        expect(missing).toEqual([])
    })
})

// ──────────────────────────────────────────────────────────────────────────────
// TC-09.27–30: Combined missing fields (matrix coverage)
// ──────────────────────────────────────────────────────────────────────────────
describe('getMissingFields — Combined (all combinations)', () => {
    it('TC-09.27: returns [alt, category] when both are missing', () => {
        // Arrange
        const product = { images: [], category: [] }

        // Act
        const missing = getMissingFields(product)

        // Assert
        expect(missing).toEqual(['alt', 'category'])
    })

    it('TC-09.27b: returns [alt, category] when image has no alt and no category', () => {
        // Arrange
        const product = { images: [{ alt: undefined }], category: undefined }

        // Act
        const missing = getMissingFields(product)

        // Assert
        expect(missing).toEqual(['alt', 'category'])
    })

    it('TC-09.28: returns [alt] when alt missing but category present', () => {
        // Arrange
        const product = { images: [{ alt: '' }], category: ['electronics'] }

        // Act
        const missing = getMissingFields(product)

        // Assert
        expect(missing).toEqual(['alt'])
    })

    it('TC-09.29: returns [category] when category missing but alt present', () => {
        // Arrange
        const product = { images: [{ alt: 'Product photo' }], category: [] }

        // Act
        const missing = getMissingFields(product)

        // Assert
        expect(missing).toEqual(['category'])
    })

    it('TC-09.30: returns [] when both alt and category are present', () => {
        // Arrange
        const product = { images: [{ alt: 'Product photo' }], category: ['electronics'] }

        // Act
        const missing = getMissingFields(product)

        // Assert
        expect(missing).toEqual([])
    })
})

// ──────────────────────────────────────────────────────────────────────────────
// Edge cases: undefined/null handling
// ──────────────────────────────────────────────────────────────────────────────
describe('getMissingFields — Edge cases', () => {
    it('returns correct result for minimal product object (empty)', () => {
        // Arrange
        const product = {}

        // Act
        const missing = getMissingFields(product)

        // Assert
        expect(missing).toEqual(['alt', 'category'])
    })

    it('returns array with correct order: [alt, category]', () => {
        // Arrange
        const product = { images: [], category: [] }

        // Act
        const missing = getMissingFields(product)

        // Assert
        // Verify the exact order: alt is checked first, then category
        expect(missing[0]).toBe('alt')
        expect(missing[1]).toBe('category')
    })

    it('never returns duplicates', () => {
        // Arrange
        const product = { images: [], category: [] }

        // Act
        const missing = getMissingFields(product)

        // Assert
        expect(missing.length).toBe(2)
        expect(new Set(missing).size).toBe(2) // all unique
    })
})
