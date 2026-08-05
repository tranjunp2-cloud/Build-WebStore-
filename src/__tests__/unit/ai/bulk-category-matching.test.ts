import { describe, expect, it } from 'vitest'
import fixture from '../../../../scripts/ai/fixtures/bulk-category-matching.json'
import {
    buildBulkCategoryInstructions,
    canonicalizeBulkCategory,
    isValidBulkParseResult,
    type BulkCategoryCandidate,
} from '@/lib/ai/bulk-category-matching'

describe('[TC-F08-04-122] fail-closed bulk category canonicalizer', () => {
    it.each(fixture.cases)('$id', testCase => {
        // Arrange
        const candidates: BulkCategoryCandidate[] = testCase.candidates

        // Act
        const result = canonicalizeBulkCategory(
            testCase.productName,
            testCase.proposedCategoryId,
            candidates,
        )

        // Assert
        expect(result).toEqual({
            categoryId: testCase.expectedCategoryId,
            reason: testCase.expectedReason,
        })
    })

    it('keeps exact character and token boundaries valid', () => {
        // Arrange
        const exactCharProduct = `${'-'.repeat(115)}Shoes`
        const exactCharPath = `${'P'.repeat(232)} > Shoes`
        const exactTokenProduct = `${'qa '.repeat(31)}Shoes`
        const candidates: BulkCategoryCandidate[] = [{ id: 'category-shoes', path: exactCharPath }]

        // Act
        const exactCharResult = canonicalizeBulkCategory(
            exactCharProduct,
            'category-shoes',
            candidates,
        )
        const exactTokenResult = canonicalizeBulkCategory(
            exactTokenProduct,
            'category-shoes',
            [{ id: 'category-shoes', path: 'Shoes' }],
        )

        // Assert
        expect(exactCharProduct).toHaveLength(120)
        expect(exactCharPath).toHaveLength(240)
        expect(exactCharResult).toEqual({ categoryId: 'category-shoes', reason: 'matched' })
        expect(exactTokenResult).toEqual({ categoryId: 'category-shoes', reason: 'matched' })
    })
})

describe('[TC-F08-04-123] shared bulk category prompt and validator', () => {
    it('makes assignment optional and includes positive and negative controls', () => {
        // Arrange
        const candidates = '[{"id":42,"path":"QA Skincare"}]'

        // Act
        const instructions = buildBulkCategoryInstructions(candidates)

        // Assert
        expect(instructions).toContain('Category assignment is optional')
        expect(instructions).toContain('Never select a category merely because it is the only candidate')
        expect(instructions).toContain('Vitamin C Skin Serum')
        expect(instructions).toContain('4-Person Camping Tent')
        expect(instructions).toContain(candidates)
    })

    it('validates the response shape used by the production route', () => {
        // Arrange
        const valid = { products: [{ name: 'Running Shoes', categoryId: 42 }] }
        const invalid = { products: [{ name: 'Running Shoes', categoryId: { id: 42 } }] }

        // Act
        const validResult = isValidBulkParseResult(valid)
        const invalidResult = isValidBulkParseResult(invalid)

        // Assert
        expect(validResult).toBe(true)
        expect(invalidResult).toBe(false)
    })
})
