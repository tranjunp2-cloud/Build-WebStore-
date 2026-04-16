import { describe, it, expect, vi, beforeEach } from 'vitest'
import { enforceMinimumStructure, enforceMinItems } from '@/lib/ai/structure-enforcer'
import { CATEGORY_REQUIREMENTS } from '@/lib/ai/category-requirements'

beforeEach(() => {
    vi.spyOn(console, 'info').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
})

describe('structure-enforcer [plan-260414-unsplash]', () => {
    describe('enforceMinimumStructure', () => {
        it('injects all mandatory blocks when AI returns empty', () => {
            const result = enforceMinimumStructure([], 'beauty', { businessName: 'Test Spa' })
            const types = result.map((b) => b.blockType)
            for (const mandatory of CATEGORY_REQUIREMENTS.beauty!.mandatoryBlocks) {
                expect(types).toContain(mandatory)
            }
        })

        it('does NOT duplicate blocks that already exist', () => {
            const existing = [
                { blockType: 'hero', variant: 'gradient' },
                { blockType: 'footer', variant: 'simple' },
            ]
            const result = enforceMinimumStructure(existing, 'beauty', {})
            const heroCount = result.filter((b) => b.blockType === 'hero').length
            const footerCount = result.filter((b) => b.blockType === 'footer').length
            expect(heroCount).toBe(1)
            expect(footerCount).toBe(1)
        })

        it('reaches minBlocks count for beauty (10)', () => {
            const result = enforceMinimumStructure(
                [{ blockType: 'hero' }, { blockType: 'footer' }],
                'beauty',
                { businessName: 'Test' },
            )
            expect(result.length).toBeGreaterThanOrEqual(CATEGORY_REQUIREMENTS.beauty!.minBlocks)
        })

        it('places navigation at index 0', () => {
            const result = enforceMinimumStructure([], 'beauty', {})
            const navIdx = result.findIndex((b) => b.blockType === 'navigation')
            expect(navIdx).toBe(0)
        })

        it('places footer at end', () => {
            const result = enforceMinimumStructure([], 'beauty', {})
            const footerIdx = result.findIndex((b) => b.blockType === 'footer')
            expect(footerIdx).toBe(result.length - 1)
        })

        it('handles unknown category with default requirements', () => {
            const result = enforceMinimumStructure([], 'unknown-xyz', {})
            expect(result.length).toBeGreaterThanOrEqual(9)
            const types = result.map((b) => b.blockType)
            expect(types).toContain('navigation')
            expect(types).toContain('hero')
            expect(types).toContain('footer')
        })

        it('covers all 14 categories without errors', () => {
            const CATEGORIES = [
                'restaurant', 'beauty', 'tech', 'health', 'education',
                'fitness', 'creative', 'business', 'fnb', 'realestate',
                'events', 'blog', 'travel', 'ecommerce',
            ]
            for (const cat of CATEGORIES) {
                const result = enforceMinimumStructure([], cat, {})
                expect(result.length).toBeGreaterThanOrEqual(9)
            }
        })
    })

    describe('enforceMinItems', () => {
        it('pads testimonials below min to required count', () => {
            const blocks = [
                {
                    blockType: 'testimonials',
                    testimonials: [{ quote: 'Great', name: 'Alice' }],
                },
            ]
            const result = enforceMinItems(blocks, 'beauty')
            const items = result[0]!.testimonials as unknown[]
            expect(items.length).toBeGreaterThanOrEqual(
                CATEGORY_REQUIREMENTS.beauty!.minItems.testimonials ?? 0,
            )
        })

        it('does NOT shrink arrays already above min', () => {
            const existing = Array.from({ length: 10 }, (_, i) => ({
                quote: `Review ${i}`,
                name: `User ${i}`,
            }))
            const blocks = [{ blockType: 'testimonials', testimonials: existing }]
            const result = enforceMinItems(blocks, 'beauty')
            expect((result[0]!.testimonials as unknown[]).length).toBe(10)
        })

        it('is idempotent', () => {
            const blocks = [{ blockType: 'testimonials', testimonials: [] }]
            const first = enforceMinItems(blocks, 'beauty')
            const firstLen = (first[0]!.testimonials as unknown[]).length
            const second = enforceMinItems(first, 'beauty')
            const secondLen = (second[0]!.testimonials as unknown[]).length
            expect(secondLen).toBe(firstLen)
        })

        it('ignores blocks without minItems requirement', () => {
            const blocks = [{ blockType: 'footer', logoText: 'Test' }]
            const result = enforceMinItems(blocks, 'beauty')
            expect(result[0]).toBe(blocks[0])
        })
    })
})
