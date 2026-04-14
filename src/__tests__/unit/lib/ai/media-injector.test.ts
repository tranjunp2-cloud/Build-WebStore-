import { describe, it, expect, vi, beforeEach } from 'vitest'
import { planImageNeeds, cleanupNonNumericImageFields } from '@/lib/ai/media-injector'

beforeEach(() => {
    vi.spyOn(console, 'info').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
})

describe('media-injector [plan-260414-unsplash]', () => {
    describe('planImageNeeds', () => {
        it('creates need for hero.backgroundImage when missing', () => {
            const blocks = [{ blockType: 'hero', headline: 'Test' }]
            const needs = planImageNeeds(blocks)
            expect(needs.length).toBe(1)
            expect(needs[0]!.blockType).toBe('hero')
            expect(needs[0]!.count).toBe(1)
        })

        it('skips hero when all top-level image fields are already numbers', () => {
            // Hero now has 2 top-level fields (image + backgroundImage). Both must
            // be filled with Media IDs to skip the need.
            const blocks = [{ blockType: 'hero', image: 42, backgroundImage: 43 }]
            const needs = planImageNeeds(blocks)
            expect(needs.length).toBe(0)
        })

        it('shares ONE Media ID across all hero top-level image fields', () => {
            const blocks = [{ blockType: 'hero', headline: 'Test' }]
            const needs = planImageNeeds(blocks)
            expect(needs.length).toBe(1) // ONE need, not 2
            needs[0]!.assign([99])
            expect(blocks[0]!.image).toBe(99)
            expect(blocks[0]!.backgroundImage).toBe(99)
        })

        it('pads gallery array to minCount when below', () => {
            const blocks = [
                {
                    blockType: 'gallery',
                    images: [{ caption: 'Photo 1' }, { caption: 'Photo 2' }],
                },
            ]
            const needs = planImageNeeds(blocks)
            expect(needs.length).toBe(1)
            expect(needs[0]!.count).toBeGreaterThanOrEqual(6) // gallery minCount = 6
            // Array should be padded
            expect((blocks[0]!.images as unknown[]).length).toBe(6)
        })

        it('creates empty gallery array when missing', () => {
            const blocks = [{ blockType: 'gallery' }]
            const needs = planImageNeeds(blocks)
            expect(needs.length).toBe(1)
            expect((blocks[0]!.images as unknown[]).length).toBe(6)
        })

        it('creates need for team members[].image (Payload schema)', () => {
            const blocks = [
                {
                    blockType: 'team',
                    members: [
                        { name: 'Alice', role: 'CEO' },
                        { name: 'Bob', role: 'CTO' },
                        { name: 'Charlie', role: 'CFO' },
                    ],
                },
            ]
            const needs = planImageNeeds(blocks)
            expect(needs.length).toBe(1)
            expect(needs[0]!.count).toBe(3)
            // Assign should set image field (not avatar)
            needs[0]!.assign([10, 20, 30])
            const members = blocks[0]!.members as Record<string, unknown>[]
            expect(members[0]!.image).toBe(10)
            expect(members[1]!.image).toBe(20)
            expect(members[2]!.image).toBe(30)
        })

        it('assign closure mutates block in place', () => {
            const blocks = [{ blockType: 'hero', headline: 'Test' }]
            const needs = planImageNeeds(blocks)
            needs[0]!.assign([123])
            expect(blocks[0]!.backgroundImage).toBe(123)
        })

        it('skips blocks without image spec', () => {
            const blocks = [
                { blockType: 'faq', items: [] },
                { blockType: 'cta', headline: 'Test' },
            ]
            const needs = planImageNeeds(blocks)
            expect(needs.length).toBe(0)
        })

        it('handles multiple blocks with mixed needs', () => {
            const blocks = [
                { blockType: 'hero', headline: 'H' },
                { blockType: 'about', headline: 'A' },
                { blockType: 'team', members: [{ name: 'X' }] },
            ]
            const needs = planImageNeeds(blocks)
            expect(needs.length).toBe(3)
        })
    })

    describe('cleanupNonNumericImageFields', () => {
        it('deletes hero.backgroundImage if still a string', () => {
            const blocks = [{ blockType: 'hero', backgroundImage: 'https://fail.com/img.jpg' }]
            cleanupNonNumericImageFields(blocks)
            expect(blocks[0]!.backgroundImage).toBeUndefined()
        })

        it('preserves hero.backgroundImage if it is a number', () => {
            const blocks = [{ blockType: 'hero', backgroundImage: 42 }]
            cleanupNonNumericImageFields(blocks)
            expect(blocks[0]!.backgroundImage).toBe(42)
        })

        it('deletes gallery image object (Zod shape) if not number', () => {
            const blocks = [
                {
                    blockType: 'gallery',
                    images: [
                        { image: { url: 'x', alt: 'y' }, caption: 'a' },
                        { image: 99, caption: 'b' },
                    ],
                },
            ]
            cleanupNonNumericImageFields(blocks)
            const items = blocks[0]!.images as Record<string, unknown>[]
            expect(items[0]!.image).toBeUndefined() // Object deleted
            expect(items[1]!.image).toBe(99) // Number preserved
            expect(items[0]!.caption).toBe('a') // Other fields untouched
        })

        it('deletes team member image if string (nested cleanup)', () => {
            const blocks = [
                {
                    blockType: 'team',
                    members: [
                        { name: 'Alice', image: 'https://x.com/a.jpg' },
                        { name: 'Bob', image: 55 },
                    ],
                },
            ]
            cleanupNonNumericImageFields(blocks)
            const members = blocks[0]!.members as Record<string, unknown>[]
            expect(members[0]!.image).toBeUndefined()
            expect(members[1]!.image).toBe(55)
        })

        it('handles blocks without image spec gracefully', () => {
            const blocks = [{ blockType: 'faq', items: [{ question: 'Q', answer: 'A' }] }]
            expect(() => cleanupNonNumericImageFields(blocks)).not.toThrow()
        })
    })
})
