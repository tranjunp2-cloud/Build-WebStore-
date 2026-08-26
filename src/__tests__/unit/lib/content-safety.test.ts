import { describe, expect, it } from 'vitest'
import { checkBusinessInfoSafety } from '@/lib/ai/content-safety'

describe('checkBusinessInfoSafety', () => {
    it('allows safe business descriptions', () => {
        const result = checkBusinessInfoSafety({
            businessName: 'Bella Bakery',
            industry: 'Food & Beverage',
            shortDescription: 'Fresh pastries baked every morning',
            products: 'Cakes, bread, coffee',
        })

        expect(result.safe).toBe(true)
        expect(result.matchedTerm).toBeNull()
    })

    it('blocks restricted businesses even when the term appears in a longer sentence', () => {
        const result = checkBusinessInfoSafety({
            businessName: 'Underground Market',
            industry: 'Retail',
            shortDescription: 'Private catalog for adults',
            products: 'Special access to gun for sale listings',
        })

        expect(result.safe).toBe(false)
        expect(result.matchedTerm).toBe('gun for sale')
        expect(result.message).toContain('restricted business content')
    })

    it('normalizes casing and punctuation before matching blocked terms', () => {
        const result = checkBusinessInfoSafety({
            businessName: 'Night Club',
            industry: 'Entertainment',
            shortDescription: 'Premium escort-only concierge',
            products: 'VIP packages',
        })

        expect(result.safe).toBe(false)
        expect(result.matchedTerm).toBe('escort')
    })
})
