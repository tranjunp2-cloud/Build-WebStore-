/**
 * Unit Tests: summarizeNestedField() in edit-block route
 * TC-ID: TC-F01-NESTED — nested field summarization for AI context
 * Convention: docs/TEST_CONVENTION.md
 */

import { describe, it, expect } from 'vitest'
import { summarizeNestedField } from '@/lib/ai/summarize'

// ── TC-F01-NESTED-01: Array of objects (ctaButtons) ─────────────────────────
describe('[TC-F01-NESTED] summarizeNestedField()', () => {
    it('TC-F01-NESTED-01 — summarizes array of objects with text fields', () => {
        // Arrange
        const ctaButtons = [
            { label: 'Buy Now', url: '/buy', style: 'primary' },
            { label: 'Learn More', url: '/about', style: 'secondary' },
        ]

        // Act
        const result = summarizeNestedField('ctaButtons', ctaButtons)

        // Assert
        expect(result).toContain('ctaButtons: [')
        expect(result).toContain('label:"Buy Now"')
        expect(result).toContain('url:"/buy"')
        expect(result).toContain('label:"Learn More"')
    })

    it('TC-F01-NESTED-02 — summarizes array of primitive strings', () => {
        // Arrange
        const features = ['Free tier', 'Up to 3 users', 'Basic analytics']

        // Act
        const result = summarizeNestedField('features', features)

        // Assert
        expect(result).toBe('features: ["Free tier", "Up to 3 users", "Basic analytics"]')
    })

    it('TC-F01-NESTED-03 — truncates strings longer than 60 chars', () => {
        // Arrange
        const longText = 'A'.repeat(80)
        const items = [{ title: longText }]

        // Act
        const result = summarizeNestedField('items', items)

        // Assert
        expect(result).toContain('A'.repeat(60) + '…')
        expect(result).not.toContain('A'.repeat(61))
    })

    it('TC-F01-NESTED-04 — caps array at 5 items with overflow suffix', () => {
        // Arrange
        const items = Array.from({ length: 8 }, (_, i) => ({ title: `Item ${i}` }))

        // Act
        const result = summarizeNestedField('items', items)

        // Assert
        expect(result).toContain('…+3 more')
        // Should only show 5 items
        expect(result).toContain('title:"Item 0"')
        expect(result).toContain('title:"Item 4"')
        expect(result).not.toContain('title:"Item 5"')
    })

    it('TC-F01-NESTED-05 — summarizes single object (badge, cta)', () => {
        // Arrange
        const badge = { text: 'New', color: 'green' }

        // Act
        const result = summarizeNestedField('badge', badge)

        // Assert
        expect(result).toBe('badge: {text:"New", color:"green"}')
    })

    it('TC-F01-NESTED-06 — returns null for empty array', () => {
        expect(summarizeNestedField('items', [])).toBeNull()
    })

    it('TC-F01-NESTED-07 — returns null for primitive values', () => {
        expect(summarizeNestedField('count', 42)).toBeNull()
        expect(summarizeNestedField('flag', true)).toBeNull()
        expect(summarizeNestedField('name', 'hello')).toBeNull()
    })

    it('TC-F01-NESTED-08 — returns null for object with no string fields', () => {
        // Arrange
        const obj = { width: 100, height: 200, enabled: true }

        // Act
        const result = summarizeNestedField('config', obj)

        // Assert
        expect(result).toBeNull()
    })

    it('TC-F01-NESTED-09 — skips strings >= 200 chars in objects', () => {
        // Arrange
        const obj = { short: 'visible', long: 'X'.repeat(200) }

        // Act
        const result = summarizeNestedField('data', obj)

        // Assert
        expect(result).toBe('data: {short:"visible"}')
    })

    it('TC-F01-NESTED-10 — returns null for array of objects with no string fields', () => {
        // Arrange
        const items = [{ x: 1, y: 2 }, { x: 3, y: 4 }]

        // Act
        const result = summarizeNestedField('coords', items)

        // Assert
        expect(result).toBeNull()
    })

    it('TC-F01-NESTED-11 — handles array of empty strings (filtered out)', () => {
        // Arrange
        const items = ['', '', '']

        // Act
        const result = summarizeNestedField('tags', items)

        // Assert
        expect(result).toBeNull()
    })

    it('TC-F01-NESTED-12 — no overflow suffix when exactly 5 items', () => {
        // Arrange
        const items = Array.from({ length: 5 }, (_, i) => ({ title: `Item ${i}` }))

        // Act
        const result = summarizeNestedField('items', items)

        // Assert
        expect(result).not.toContain('more')
    })
})
