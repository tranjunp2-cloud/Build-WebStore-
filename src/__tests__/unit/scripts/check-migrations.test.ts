/**
 * @fileoverview Regression guard for scripts/check-migrations.js's new-field
 * detection (getFieldRoles).
 * TC-IDs: TC-check-migrations-01 to 06 (provisional — no F37 QA doc owns this CI script)
 *
 * History (see docs/journals for the full adversarial-review trail): the
 * previous 3 approaches to this CI hard-gate's array-nesting safety net were
 * each broken by adversarial review — bare-name matching against the diff
 * (a brand-new top-level field's own diff line trivially "appears in the
 * diff"), single-line matching (multi-line fields carry no distinguishing
 * detail on the `name:` line alone), and block-reconstruction from adjacent
 * diff `+` lines (unsafe because `git diff | grep "^+"` discards hunk
 * boundaries, so unrelated hunks can look adjacent and get wrongly stitched
 * together).
 *
 * The current design abandons diff-line parsing for new-field detection
 * entirely: `getFieldRoles(source)` walks a FULL FILE (base branch version,
 * or current version) and classifies every field by identity `(name,
 * nested)` — nested meaning "has an ARRAY ancestor". `getNewFieldsFromDiff`
 * (not directly tested here — it shells out to `git show`) diffs the SET of
 * top-level (non-nested, non-container) names between base and current: a
 * name absent from base's top-level set is new. This sidesteps diff-line
 * adjacency entirely (no hunk-boundary dependency), and — because identity
 * is (name, nested) rather than full content — a purely cosmetic edit to an
 * EXISTING field (admin text, maxLength, adding `required: true`) never
 * produces a false "new field" flag.
 */
import { describe, it, expect } from 'vitest'

const { getFieldRoles, isPathMissingAtRef, diffNewTopLevelFieldNames } = require('../../../../scripts/check-migrations.js')

/** Thin wrapper calling the REAL production comparison (diffNewTopLevelFieldNames,
 *  imported from source above) on top of getFieldRoles — NOT a re-implementation.
 *  getNewFieldsFromDiff() itself isn't exported (it shells out to `git show`),
 *  but the comparison logic it delegates to is the exact function under test. */
function simulateNewTopLevelFields(baseContent: string, currentContent: string): string[] {
    return diffNewTopLevelFieldNames(getFieldRoles(baseContent), getFieldRoles(currentContent))
}

describe('[TC-check-migrations-01] getFieldRoles — classifies nested vs top-level fields', () => {
    it('classifies a field inside a type: array as nested', () => {
        const source = `
        {
          name: 'openingHours',
          type: 'array',
          fields: [
            { name: 'opens', type: 'text' },
          ],
        },
        `
        const roles = getFieldRoles(source)
        const opens = roles.find((r: { name: string }) => r.name === 'opens')
        expect(opens?.nested).toBe(true)
    })

    it('classifies a top-level field (no array ancestor) as not nested', () => {
        const source = `
        {
          name: 'aiCrawlersEnabled',
          type: 'checkbox',
          defaultValue: true,
        },
        `
        const roles = getFieldRoles(source)
        const field = roles.find((r: { name: string }) => r.name === 'aiCrawlersEnabled')
        expect(field?.nested).toBe(false)
        expect(field?.isContainer).toBe(false)
    })

    it('classifies the array/group field itself as a container, not counted as its own nested child', () => {
        const source = `
        {
          name: 'openingHours',
          type: 'array',
          fields: [
            { name: 'opens', type: 'text' },
          ],
        },
        `
        const roles = getFieldRoles(source)
        const container = roles.find((r: { name: string }) => r.name === 'openingHours')
        expect(container?.isContainer).toBe(true)
        expect(container?.nested).toBe(false)
    })
})

describe('[TC-check-migrations-02] getFieldRoles — Products.ts value/key nested under two different arrays', () => {
    it('reports both "value" occurrences as nested (variantConfigs.options AND attributes)', () => {
        const source = `
        {
          name: 'variantConfigs',
          type: 'array',
          fields: [
            {
              name: 'options',
              type: 'array',
              fields: [
                { name: 'value', type: 'text', required: true, maxLength: 50 }
              ]
            }
          ],
        },
        {
          name: 'attributes',
          type: 'array',
          fields: [
            { name: 'key', type: 'text', required: true, maxLength: 100 },
            { name: 'value', type: 'text', required: true, maxLength: 500 },
          ],
        },
        `
        const roles = getFieldRoles(source)
        const valueOccurrences = roles.filter((r: { name: string }) => r.name === 'value')
        expect(valueOccurrences).toHaveLength(2)
        expect(valueOccurrences.every((r: { nested: boolean }) => r.nested)).toBe(true)
    })
})

describe('[TC-check-migrations-03] simulateNewTopLevelFields — bare-name collision no longer produces a false negative', () => {
    it('flags a brand-new top-level field even when its name collides with an unrelated nested field (compact style)', () => {
        const base = `
        { name: 'attributes', type: 'array', fields: [
          { name: 'key', type: 'text' },
          { name: 'value', type: 'text' },
        ]},
        `
        const current = base + `
        { name: 'value', type: 'text', admin: { description: 'Brand-new TOP-LEVEL field, unrelated to the nested one above' } },
        `
        const result = simulateNewTopLevelFields(base, current)
        expect(result).toContain('value')
    })

    it('does NOT flag a field that is genuinely only nested (no new top-level occurrence added)', () => {
        const base = `
        { name: 'attributes', type: 'array', fields: [
          { name: 'value', type: 'text' },
        ]},
        `
        const current = `
        { name: 'attributes', type: 'array', fields: [
          { name: 'value', type: 'text', required: true },
        ]},
        `
        const result = simulateNewTopLevelFields(base, current)
        expect(result).not.toContain('value')
    })
})

describe('[TC-check-migrations-04] simulateNewTopLevelFields — MULTI-LINE vs MULTI-LINE collision (previously broken by rounds 2-3)', () => {
    it('flags a brand-new multi-line top-level field colliding by bare name with a multi-line nested field', () => {
        const base = `
        {
          name: 'items',
          type: 'array',
          fields: [
            {
              name: 'label',
              type: 'text',
              admin: { description: 'Nested label, array item' },
            },
          ],
        },
        `
        const current = base + `
        {
          name: 'label',
          type: 'select',
          options: ['a', 'b'],
          admin: { description: 'Brand new TOP-LEVEL field, totally unrelated' },
        },
        `
        const result = simulateNewTopLevelFields(base, current)
        expect(result).toContain('label')
    })
})

describe('[TC-check-migrations-05] simulateNewTopLevelFields — rename to a colliding name (previously broken by round 3, cross-hunk)', () => {
    it('flags a renamed top-level field even when the rename target name collides with an unrelated nested field', () => {
        const base = `
        { name: 'openingHours', type: 'array', fields: [
          { name: 'note', type: 'checkbox' },
        ]},
        { name: 'oldFieldName', type: 'checkbox' },
        `
        const current = `
        { name: 'openingHours', type: 'array', fields: [
          { name: 'note', type: 'checkbox' },
        ]},
        { name: 'note', type: 'checkbox' },
        `
        const result = simulateNewTopLevelFields(base, current)
        expect(result).toContain('note')
    })
})

describe('[TC-check-migrations-06] simulateNewTopLevelFields — cosmetic edits to an existing field never false-flag', () => {
    it('does not flag a field whose admin text/validation changed but whose name+nesting is unchanged', () => {
        const base = `
        {
          name: 'foo',
          type: 'text',
          admin: { description: 'old description' },
        },
        `
        const current = `
        {
          name: 'foo',
          type: 'text',
          required: true,
          admin: { description: 'NEW description, totally different text' },
        },
        `
        const result = simulateNewTopLevelFields(base, current)
        expect(result).not.toContain('foo')
    })

    it('still flags a genuinely new, unrelated top-level field added alongside a cosmetic edit', () => {
        const base = `
        { name: 'foo', type: 'text' },
        `
        const current = `
        { name: 'foo', type: 'text', required: true },
        { name: 'bar', type: 'checkbox' },
        `
        const result = simulateNewTopLevelFields(base, current)
        expect(result).toContain('bar')
        expect(result).not.toContain('foo')
    })
})

describe('[TC-check-migrations-07] isPathMissingAtRef — distinguishes "file is new" from "git show genuinely failed"', () => {
    // Real error messages captured from actual `git show` invocations (not
    // hand-written guesses) — see plans/reports for the exact commands run.
    it('recognizes the real git message for "file did not exist at that ref" as a legitimate empty baseline', () => {
        const realMessage = "fatal: path 'src/collections/NonExistentFile.ts' does not exist in 'origin/staging'\n"
        expect(isPathMissingAtRef(realMessage)).toBe(true)
    })

    it('does NOT recognize an invalid/bad ref error as "file is new" — must fail closed, not flag everything', () => {
        const realMessage = "fatal: invalid object name 'origin/totally-bad-ref-xyz'.\n"
        expect(isPathMissingAtRef(realMessage)).toBe(false)
    })

    it('does NOT recognize an empty or unrelated error message as "file is new"', () => {
        expect(isPathMissingAtRef('')).toBe(false)
        expect(isPathMissingAtRef('fatal: bad revision \'origin/totally-bad-ref-xyz\'')).toBe(false)
    })
})
