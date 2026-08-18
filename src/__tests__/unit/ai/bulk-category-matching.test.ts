import { describe, expect, it } from 'vitest'
import fixture from '../../../../scripts/ai/fixtures/bulk-category-matching.json'
import {
    buildBulkCategoryInstructions,
    canonicalizeBulkCategory,
    isValidBulkParseResult,
    type BulkCategoryCandidate,
} from '@/lib/ai/bulk-category-matching'

describe('[TC-F08-04-128][TC-F08-04-133] tenant allowlist bulk category canonicalizer', () => {
    it('publishes the AI-authoritative allowlist contract in fixture v7', () => {
        // Arrange
        const expectedGuardRules = [
            'preserve a model-proposed id only when it canonicalizes to a supplied tenant candidate id',
            'preserve model null without server-side semantic inference',
            'reject unknown ids without falling back to another candidate',
            'never reinterpret category semantics from the generated product name',
        ]

        // Act
        const guardRules = fixture.contract.guardRules

        // Assert
        expect(fixture.version).toBe(7)
        expect(guardRules).toEqual(expectedGuardRules)
    })

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

    it('does not reinterpret bounded or unusual product names after AI selected an allowlisted id', () => {
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

describe('[TC-F08-04-129] shared bulk category prompt and validator', () => {
    it('makes assignment optional and includes positive and negative controls', () => {
        // Arrange
        const candidates = '[{"id":42,"path":"QA Skincare"}]'

        // Act
        const instructions = buildBulkCategoryInstructions(candidates)

        // Assert
        expect(instructions).toContain('Category assignment is optional')
        expect(instructions).toContain('Never select a category merely because it is the only candidate')
        expect(instructions).toContain('Vitamin C Skin Serum')
        expect(instructions).toContain('Cooking Oil')
        expect(instructions).toContain('use generic "Oil" only when no more specific candidate exists')
        expect(instructions).toContain('Classify each product independently')
        expect(instructions).toContain('primary sellable item')
        expect(instructions).toContain('Exact product-type precedence')
        expect(instructions).toContain('"Hair Oil"')
        expect(instructions).toContain('must not use "QA Skincare"')
        expect(instructions).toContain('final semantic self-check')
        expect(instructions).toContain('Oil Painting')
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
