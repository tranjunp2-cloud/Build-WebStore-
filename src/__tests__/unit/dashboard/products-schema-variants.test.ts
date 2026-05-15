// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { getProductFormSchema } from '../../../components/dashboard/product-form/schema'

describe('GH-935: Variant Tier Schema Validation (superRefine behavior)', () => {
    const schema = getProductFormSchema({})
    const baseValidData = {
        name: 'Test Product',
        categoryIds: ['cat-1'],
        images: [],
        hasVariants: false,
        basePrice: 50,
        baseSku: 'SKU-123',
        baseInventory: 10,
        urlSlug: 'test-product',
    }

    describe('Empty tier handling (fully empty tiers should be skipped)', () => {
        it('should PASS when all tiers are fully empty (no name, no options)', () => {
            const result = schema.safeParse({
                ...baseValidData,
                hasVariants: true,
                tiers: [
                    { id: '1', name: '', options: [] }
                ]
            })
            expect(result.success).toBe(true)
        })

        it('should PASS when tiers array is empty', () => {
            const result = schema.safeParse({
                ...baseValidData,
                hasVariants: true,
                tiers: []
            })
            expect(result.success).toBe(true)
        })

        it('should PASS when mixed with one empty and one valid tier', () => {
            const result = schema.safeParse({
                ...baseValidData,
                hasVariants: true,
                tiers: [
                    { id: '1', name: '', options: [] }, // empty, will be skipped
                    { id: '2', name: 'Color', options: ['Red', 'Blue'] }
                ]
            })
            expect(result.success).toBe(true)
        })
    })

    describe('Partially-filled tier handling (should FAIL)', () => {
        it('should FAIL when tier has name but no options', () => {
            const result = schema.safeParse({
                ...baseValidData,
                hasVariants: true,
                tiers: [
                    { id: '1', name: 'Color', options: [] }
                ]
            })
            expect(result.success).toBe(false)
            if (!result.success) {
                const flattened = result.error.flatten()
                expect(JSON.stringify(flattened)).toContain('At least one option')
            }
        })

        it('should FAIL when tier has name with only whitespace options', () => {
            const result = schema.safeParse({
                ...baseValidData,
                hasVariants: true,
                tiers: [
                    { id: '1', name: 'Size', options: ['  ', '  '] }
                ]
            })
            expect(result.success).toBe(false)
        })

        it('should FAIL when tier has name but options array is empty (explicit)', () => {
            const result = schema.safeParse({
                ...baseValidData,
                hasVariants: true,
                tiers: [
                    { id: '1', name: 'Material', options: [] }
                ]
            })
            expect(result.success).toBe(false)
        })

        it('TC-F08-VAR-SCHEMA-14: all-empty options → only root error, no per-item error', () => {
            const result = schema.safeParse({
                ...baseValidData,
                hasVariants: true,
                tiers: [{ id: '1', name: 'Color', options: [''] }]
            })
            expect(result.success).toBe(false)
            if (!result.success) {
                const msg = JSON.stringify(result.error.flatten())
                expect(msg).toContain('At least one option')
                expect(msg).not.toContain('cannot be empty')
            }
        })

        it('TC-F08-VAR-SCHEMA-15: mixed options → only per-item error, no root error', () => {
            const result = schema.safeParse({
                ...baseValidData,
                hasVariants: true,
                tiers: [{ id: '1', name: 'Color', options: ['Red', ''] }]
            })
            expect(result.success).toBe(false)
            if (!result.success) {
                const msg = JSON.stringify(result.error.flatten())
                expect(msg).toContain('cannot be empty')
                expect(msg).not.toContain('At least one option')
            }
        })
    })

    describe('Fully-filled tier handling (should PASS)', () => {
        it('should PASS when tier has name and valid options', () => {
            const result = schema.safeParse({
                ...baseValidData,
                hasVariants: true,
                tiers: [
                    { id: '1', name: 'Color', options: ['Red', 'Blue', 'Green'] }
                ]
            })
            expect(result.success).toBe(true)
        })

        it('should PASS with two fully-filled tiers (max allowed)', () => {
            const result = schema.safeParse({
                ...baseValidData,
                hasVariants: true,
                tiers: [
                    { id: '1', name: 'Color', options: ['Red', 'Blue'] },
                    { id: '2', name: 'Size', options: ['S', 'M', 'L'] }
                ]
            })
            expect(result.success).toBe(true)
        })

        it('should FAIL when exceeding 2 tiers', () => {
            const result = schema.safeParse({
                ...baseValidData,
                hasVariants: true,
                tiers: [
                    { id: '1', name: 'Color', options: ['Red'] },
                    { id: '2', name: 'Size', options: ['M'] },
                    { id: '3', name: 'Material', options: ['Cotton'] }
                ]
            })
            expect(result.success).toBe(false)
        })
    })

    describe('Tier name uniqueness (should FAIL on duplicate names)', () => {
        it('should FAIL when two tiers have same name (case-insensitive)', () => {
            const result = schema.safeParse({
                ...baseValidData,
                hasVariants: true,
                tiers: [
                    { id: '1', name: 'Color', options: ['Red'] },
                    { id: '2', name: 'COLOR', options: ['Blue'] }
                ]
            })
            expect(result.success).toBe(false)
        })
    })

    describe('Option uniqueness (should FAIL on duplicate options)', () => {
        it('should FAIL when tier has duplicate options (case-insensitive)', () => {
            const result = schema.safeParse({
                ...baseValidData,
                hasVariants: true,
                tiers: [
                    { id: '1', name: 'Color', options: ['Red', 'red', 'Blue'] }
                ]
            })
            expect(result.success).toBe(false)
        })
    })
})
