/**
 * @fileoverview Regression guard for scripts/check-migrations.js's array-nesting
 * safety net (getArrayNestedFieldNames + resolveArrayNestedSkipNames).
 * TC-IDs: TC-check-migrations-01/02/03 (provisional — no F37 QA doc owns this CI script)
 *
 * Bug this prevents: the safety-net used to be applied file-wide by BARE FIELD
 * NAME (skip any field named X if X is array-nested anywhere in the file, or —
 * an earlier, still-broken fix — skip X if the name X merely appears anywhere
 * in the diff). Both are false-negative-prone: a genuine new TOP-LEVEL field's
 * own declaration line is itself part of the diff, so a bare-name check never
 * actually distinguishes "this diff-added occurrence is nested" from "this
 * diff-added occurrence is a brand-new top-level field that happens to share
 * a name with an unrelated nested field elsewhere" (e.g. Products.ts nests
 * `value`/`key` under both `variantConfigs.options` and `attributes`).
 *
 * The fix matches by EXACT LINE CONTENT (trimmed), not bare name —
 * `getArrayNestedFieldNames` now returns line signatures, and
 * `resolveArrayNestedSkipNames` (TC-check-migrations-03) only skips a
 * diff-added field when its diff line is byte-identical to a confirmed nested
 * line in the full file, which a genuinely different field's declaration
 * (different admin text/maxLength/validate/etc.) will not be.
 */
import { describe, it, expect } from 'vitest'

const { getArrayNestedFieldNames, resolveArrayNestedSkipNames } = require('../../../../scripts/check-migrations.js')

describe('[TC-check-migrations-01] getArrayNestedFieldNames — identifies array-nested line signatures', () => {
    it('reports a field nested inside a type: array as an array-nested line', () => {
        const source = `
        {
          name: 'openingHours',
          type: 'array',
          fields: [
            { name: 'opens', type: 'text' },
          ],
        },
        `
        const result = getArrayNestedFieldNames(source)
        expect(result.has(`{ name: 'opens', type: 'text' },`)).toBe(true)
    })

    it('does NOT report a top-level field (no array ancestor) as array-nested', () => {
        const source = `
        {
          name: 'aiCrawlersEnabled',
          type: 'checkbox',
          defaultValue: true,
        },
        `
        const result = getArrayNestedFieldNames(source)
        expect([...result].some(line => line.includes("name: 'aiCrawlersEnabled'"))).toBe(false)
    })
})

describe('[TC-check-migrations-02] getArrayNestedFieldNames — Products.ts value/key collision', () => {
    it('reports the "value" and "key" LINES as array-nested when they appear under two different arrays in the same file', () => {
        // Mirrors the real shape in Products.ts: `value` nested under
        // variantConfigs.options AND under attributes; `key` nested under attributes.
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
        const result = getArrayNestedFieldNames(source)
        expect(result.has(`{ name: 'value', type: 'text', required: true, maxLength: 50 }`)).toBe(true)
        expect(result.has(`{ name: 'key', type: 'text', required: true, maxLength: 100 },`)).toBe(true)
        expect(result.has(`{ name: 'value', type: 'text', required: true, maxLength: 500 },`)).toBe(true)
    })
})

describe('[TC-check-migrations-03] resolveArrayNestedSkipNames — collision no longer produces a false negative', () => {
    // The full file has `value` nested under BOTH variantConfigs.options and
    // attributes (real Products.ts shape) — this is the name that a naive
    // bare-name intersection would wrongly treat as "always nested".
    const fullFileContent = `
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
        {
          name: 'value',
          type: 'text',
          admin: { description: 'Brand-new TOP-LEVEL field, unrelated to the nested ones above' },
        },
    `

    it('does NOT skip a brand-new top-level field whose bare name collides with an unrelated nested field (the adversarial-review scenario)', () => {
        // The diff only touches the NEW top-level field — its own declaration
        // line is, unavoidably, part of the diff. A bare-name check would see
        // "value" appears in the diff AND "value" is array-nested somewhere in
        // the file, and wrongly skip it. Exact-line matching must not.
        const diffPlusLines = [
            `+          name: 'value',`,
            `+          type: 'text',`,
            `+          admin: { description: 'Brand-new TOP-LEVEL field, unrelated to the nested ones above' },`,
        ]
        const skip = resolveArrayNestedSkipNames(diffPlusLines, fullFileContent)
        expect(skip.has('value')).toBe(false)
    })

    it('DOES skip a diff-added field whose exact line matches a confirmed array-nested occurrence (the original safety-net case)', () => {
        // The diff touches the compact `value` line INSIDE `attributes` verbatim
        // (e.g. a PR adding `required: true` there) — this line signature exists
        // in the full file as a nested occurrence, so it must still be skipped.
        const diffPlusLines = [
            `+            { name: 'value', type: 'text', required: true, maxLength: 500 },`,
        ]
        const skip = resolveArrayNestedSkipNames(diffPlusLines, fullFileContent)
        expect(skip.has('value')).toBe(true)
    })
})
