import { describe, it, expect } from 'vitest'
import { getArrayNestedFieldNames } from '../../../../scripts/check-migrations'

// TC-CIFIX-01: check-migrations.js false-positive fix (GH-1587 CI run).
// Root cause: the diff-based scope tracker in getNewFieldsFromDiff() only
// detects an `array` ancestor when the array's own `type: 'array'` line is
// itself part of the git diff. A PR that adds a new sibling field to an
// array which already existed pre-PR (e.g. Sites.ts's `openingHours` array
// gaining `opens`/`closes` after `dayOfWeek`/`isClosed` already shipped)
// causes the new field to be misdetected as a top-level column, triggering
// a false "missing migration" CI failure.
describe('check-migrations.js — getArrayNestedFieldNames (TC-CIFIX-01)', () => {
    it('TC-CIFIX-01a: detects a field nested in an array via compact single-line syntax', () => {
        const source = `
export const Sites = {
    fields: [
        {
            name: 'localBusiness',
            type: 'group',
            fields: [
                {
                    name: 'openingHours',
                    type: 'array',
                    fields: [
                        { name: 'dayOfWeek', type: 'select' },
                        { name: 'opens', type: 'text' },
                        { name: 'closes', type: 'text' },
                    ],
                },
            ],
        },
    ],
}
`
        const nested = getArrayNestedFieldNames(source)
        expect(nested.has('opens')).toBe(true)
        expect(nested.has('closes')).toBe(true)
        expect(nested.has('dayOfWeek')).toBe(true)
    })

    it('TC-CIFIX-01b: does NOT flag the array field itself or its group ancestor as nested', () => {
        const source = `
export const Sites = {
    fields: [
        {
            name: 'localBusiness',
            type: 'group',
            fields: [
                { name: 'openingHours', type: 'array', fields: [
                    { name: 'opens', type: 'text' },
                ]},
            ],
        },
    ],
}
`
        const nested = getArrayNestedFieldNames(source)
        expect(nested.has('openingHours')).toBe(false)
        expect(nested.has('localBusiness')).toBe(false)
    })

    it('TC-CIFIX-01c: a top-level (non-array-nested) field is never flagged', () => {
        const source = `
export const Sites = {
    fields: [
        { name: 'name', type: 'text' },
        { name: 'slug', type: 'text' },
    ],
}
`
        const nested = getArrayNestedFieldNames(source)
        expect(nested.has('name')).toBe(false)
        expect(nested.has('slug')).toBe(false)
    })

    it('TC-CIFIX-01d: a field nested in a group (not an array) is never flagged — groups map to prefixed columns on the same table', () => {
        const source = `
export const Sites = {
    fields: [
        {
            name: 'seo',
            type: 'group',
            fields: [
                { name: 'metaTitle', type: 'text' },
            ],
        },
    ],
}
`
        const nested = getArrayNestedFieldNames(source)
        expect(nested.has('metaTitle')).toBe(false)
    })

    it('TC-CIFIX-01e: sibling field added after an array closes is correctly out of scope (regression guard for scope-stack popping)', () => {
        const source = `
export const Sites = {
    fields: [
        {
            name: 'openingHours',
            type: 'array',
            fields: [
                { name: 'opens', type: 'text' },
            ],
        },
        { name: 'afterArray', type: 'text' },
    ],
}
`
        const nested = getArrayNestedFieldNames(source)
        expect(nested.has('opens')).toBe(true)
        expect(nested.has('afterArray')).toBe(false)
    })
})
