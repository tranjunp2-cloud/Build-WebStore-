/**
 * Phase 04 — section-field-diff helpers.
 *
 * Coverage:
 *   TC-P04.10 — flattenConfig: primitives at top level
 *   TC-P04.11 — flattenConfig: nested objects
 *   TC-P04.12 — flattenConfig: arrays of primitives
 *   TC-P04.13 — flattenConfig: arrays of objects (recurse)
 *   TC-P04.14 — countChangedFields: no change → 0
 *   TC-P04.15 — countChangedFields: single field changed → 1
 *   TC-P04.16 — countChangedFields: whitespace-only change ignored
 *   TC-P04.17 — countChangedFields: new block added counts all its fields
 *   TC-P04.18 — countChangedFields: removed block counts all its fields
 *   TC-P04.19 — countChangedFields: multiple fields changed across blocks
 *   TC-P04.20 — countChangedFields: empty old → everything new is "edited"
 *
 * Plan: plans/260420-1028-studio-ui-visual-feature-audit/phase-04-schema-additions.md
 */

import { describe, it, expect } from 'vitest'
import { flattenConfig, countChangedFields } from '@/lib/admin/section-field-diff'

// ── TC-P04.10–13: flattenConfig ───────────────────────────────────────────────

describe('flattenConfig', () => {
    it('TC-P04.10 — flattens top-level primitives', () => {
        const result = flattenConfig({ headline: 'Hello', count: 5, active: true })
        expect(result).toEqual({ headline: 'Hello', count: '5', active: 'true' })
    })

    it('TC-P04.11 — flattens nested objects with dot notation', () => {
        const result = flattenConfig({ cta: { label: 'Buy', href: '/shop' } })
        expect(result).toEqual({ 'cta.label': 'Buy', 'cta.href': '/shop' })
    })

    it('TC-P04.12 — flattens arrays of primitives with index notation', () => {
        const result = flattenConfig({ tags: ['a', 'b', 'c'] })
        expect(result).toEqual({ 'tags[0]': 'a', 'tags[1]': 'b', 'tags[2]': 'c' })
    })

    it('TC-P04.13 — recurses into arrays of objects', () => {
        const result = flattenConfig({
            items: [
                { label: 'Item 1', desc: 'First' },
                { label: 'Item 2', desc: '' },
            ],
        })
        expect(result['items[0].label']).toBe('Item 1')
        expect(result['items[0].desc']).toBe('First')
        expect(result['items[1].label']).toBe('Item 2')
        expect(result['items[1].desc']).toBe('')
    })

    it('returns empty object for empty input', () => {
        expect(flattenConfig({})).toEqual({})
    })

    it('ignores null values', () => {
        const result = flattenConfig({ a: 'hello', b: null as unknown as string })
        expect(result).toEqual({ a: 'hello' })
    })
})

// ── TC-P04.14–20: countChangedFields ─────────────────────────────────────────

describe('countChangedFields', () => {
    const makeSection = (id: string, config: Record<string, unknown>) => ({
        id,
        blockType: 'hero',
        config,
    })

    it('TC-P04.14 — identical sections → 0 changed', () => {
        const old = [{ id: 's1', config: { headline: 'Hello', sub: 'World' } }]
        const next = [makeSection('s1', { headline: 'Hello', sub: 'World' })]
        expect(countChangedFields(old, next)).toBe(0)
    })

    it('TC-P04.15 — single field changed → 1', () => {
        const old = [{ id: 's1', config: { headline: 'Hello', sub: 'World' } }]
        const next = [makeSection('s1', { headline: 'Hi there', sub: 'World' })]
        expect(countChangedFields(old, next)).toBe(1)
    })

    it('TC-P04.16 — whitespace-only change ignored', () => {
        const old = [{ id: 's1', config: { headline: 'Hello' } }]
        const next = [makeSection('s1', { headline: '  Hello  ' })]
        expect(countChangedFields(old, next)).toBe(0)
    })

    it('TC-P04.17 — new block added counts all its fields', () => {
        const old: Array<Record<string, unknown>> = []
        const next = [makeSection('s-new', { headline: 'New', sub: 'Block', cta: 'Click' })]
        // 3 fields in a brand-new block
        expect(countChangedFields(old, next)).toBe(3)
    })

    it('TC-P04.18 — removed block counts all its fields as changed', () => {
        const old = [{ id: 's1', config: { headline: 'Hello', sub: 'World' } }]
        const next: ReturnType<typeof makeSection>[] = []
        // 2 fields in the removed block
        expect(countChangedFields(old, next)).toBe(2)
    })

    it('TC-P04.19 — multiple fields changed across blocks', () => {
        const old = [
            { id: 's1', config: { headline: 'A', sub: 'B' } },
            { id: 's2', config: { text: 'C', label: 'D' } },
        ]
        const next = [
            makeSection('s1', { headline: 'A-changed', sub: 'B' }),
            makeSection('s2', { text: 'C', label: 'D-changed' }),
        ]
        expect(countChangedFields(old, next)).toBe(2)
    })

    it('TC-P04.20 — empty old sections → every new field counts as edited', () => {
        const old: Array<Record<string, unknown>> = []
        const next = [
            makeSection('s1', { a: '1', b: '2' }),
            makeSection('s2', { c: '3' }),
        ]
        expect(countChangedFields(old, next)).toBe(3)
    })

    it('handles sections with no config fields → 0 changes', () => {
        const old = [{ id: 's1', config: {} }]
        const next = [makeSection('s1', {})]
        expect(countChangedFields(old, next)).toBe(0)
    })
})
