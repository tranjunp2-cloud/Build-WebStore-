import { describe, it, expect } from 'vitest'
import { stripArrayItemIds } from '@/lib/payload/strip-block-ids'

// TC-F05-strip-block-ids: helper shared by /publish and PATCH page visibility
// updates. Regression guard against the PG 23505 collision path described in
// commit df2a03d4.
describe('[TC-F05-strip-block-ids] stripArrayItemIds', () => {
    it('TC-01: drops id and _uuid from each array item', () => {
        const input = [
            { id: 'uuid-1', _uuid: 'uuid-1', blockType: 'hero', headline: 'Hi' },
            { id: 'uuid-2', _uuid: 'uuid-2', blockType: 'cta', url: '/x' },
        ]
        const out = stripArrayItemIds(input) as Record<string, unknown>[]
        expect(out).toHaveLength(2)
        expect(out[0]).toEqual({ blockType: 'hero', headline: 'Hi' })
        expect(out[1]).toEqual({ blockType: 'cta', url: '/x' })
        // original untouched — pure function
        expect(input[0]).toHaveProperty('id', 'uuid-1')
    })

    it('TC-02: recurses into nested arrays inside items (e.g. features, ctaButtons)', () => {
        const input = [
            {
                id: 'uuid-block', blockType: 'features',
                features: [
                    { id: 'uuid-feat-1', name: 'Fast', _uuid: 'uuid-feat-1' },
                    { id: 'uuid-feat-2', name: 'Cheap' },
                ],
                ctaButtons: [
                    { id: 'uuid-btn-1', label: 'Click', url: '/a' },
                ],
            },
        ]
        const out = stripArrayItemIds(input) as Array<Record<string, unknown>>
        expect(out[0]).not.toHaveProperty('id')
        expect(out[0]).not.toHaveProperty('_uuid')
        const features = out[0].features as Array<Record<string, unknown>>
        expect(features[0]).toEqual({ name: 'Fast' })
        expect(features[1]).toEqual({ name: 'Cheap' })
        const ctaButtons = out[0].ctaButtons as Array<Record<string, unknown>>
        expect(ctaButtons[0]).toEqual({ label: 'Click', url: '/a' })
    })

    it('TC-03: leaves non-array input unchanged', () => {
        expect(stripArrayItemIds(null)).toBe(null)
        expect(stripArrayItemIds(undefined)).toBe(undefined)
        expect(stripArrayItemIds('string')).toBe('string')
        expect(stripArrayItemIds({ id: 'x' })).toEqual({ id: 'x' })
    })

    it('TC-04: preserves primitive and non-id object values', () => {
        const input = [
            {
                id: 'drop',
                blockType: 'cta',
                ctaButton: { url: '/a', label: 'Click', id: 'nested-kept' },
                count: 5,
                active: true,
                tags: null,
            },
        ]
        const out = stripArrayItemIds(input) as Array<Record<string, unknown>>
        // `id` only dropped when the containing value is an array item; nested
        // non-array objects retain their `id` because we only recurse into
        // arrays. This matches Drizzle's upsert surface — only array rows hit
        // `pages_blocks_*` PK columns.
        expect(out[0]).toEqual({
            blockType: 'cta',
            ctaButton: { url: '/a', label: 'Click', id: 'nested-kept' },
            count: 5,
            active: true,
            tags: null,
        })
    })

    it('TC-05: handles empty arrays and items without id/_uuid', () => {
        expect(stripArrayItemIds([])).toEqual([])
        expect(stripArrayItemIds([{ blockType: 'hero', headline: 'X' }])).toEqual([
            { blockType: 'hero', headline: 'X' },
        ])
    })
})
