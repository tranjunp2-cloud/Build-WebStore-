// @vitest-environment node
// GH-2380: the server must reject duplicate attribute names, not only the form (GH-2260).
import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/ai/seo-queue', () => ({ queueSEOAutoGeneration: vi.fn() }))

import { ValidationError } from 'payload'
import { Products } from '@/collections/Products'
import { migrationContext } from '@/lib/migration/pw1-json/runtime'
import {
    findDuplicateAttributeIndexes,
    attributesChanged,
    DUPLICATE_ATTRIBUTE_MESSAGE,
} from '@/lib/products/attribute-names'
import { validateUniqueAttributeNames } from '@/lib/products/attribute-names-hook'

type Row = { key?: string; value?: string }
const run = async (args: { operation: 'create' | 'update'; data: { attributes?: unknown }; originalDoc?: { attributes?: Row[] }; context?: object }) =>
    validateUniqueAttributeNames({ context: {}, ...args } as never)
const thrownErrors = async (p: Promise<unknown>) => {
    try { await p } catch (e) { return (e as ValidationError).data.errors }
    return null
}

describe('[TC-F08-04-143] findDuplicateAttributeIndexes', () => {
    it('flags the later copy (trim + case-insensitive)', () => {
        expect(findDuplicateAttributeIndexes([{ key: 'Material', value: 'a' }, { key: 'Origin', value: 'b' }, { key: ' material ', value: 'c' }])).toEqual([2])
    })
    it('flags every copy after the first', () => {
        expect(findDuplicateAttributeIndexes([{ key: 'Brand' }, { key: 'BRAND' }, { key: 'brand' }])).toEqual([1, 2])
    })
    it('different names with the same value are clean; empty keys are ignored', () => {
        expect(findDuplicateAttributeIndexes([{ key: 'A', value: 'x' }, { key: 'B', value: 'x' }, { key: '' }, { key: '  ' }])).toEqual([])
    })
})

describe('[TC-F08-04-143] attributesChanged', () => {
    it('same list (case/space in key, space in value) is unchanged', () => {
        expect(attributesChanged([{ key: ' Material', value: 'Cotton ' }], [{ key: 'material', value: 'Cotton' }])).toBe(false)
    })
    it('value, order, length changes count as changed', () => {
        const a = { key: 'A', value: '1' }, b = { key: 'B', value: '2' }
        expect(attributesChanged([{ ...a, value: '9' }], [a])).toBe(true)
        expect(attributesChanged([b, a], [a, b])).toBe(true)
        expect(attributesChanged([a], [a, b])).toBe(true)
    })
})

describe('Products collection registers the hook', () => {
    it('[TC-F08-04-144] beforeValidate contains validateUniqueAttributeNames', () => {
        expect(Products.hooks?.beforeValidate).toContain(validateUniqueAttributeNames)
    })
})

describe('[TC-F08-04-144] create with duplicate attribute names', () => {
    it('throws ValidationError on the 2nd copy row', async () => {
        const errors = await thrownErrors(run({ operation: 'create', data: { attributes: [{ key: 'Material', value: 'a' }, { key: ' material ', value: 'b' }] } }))
        expect(errors).toEqual([{ path: 'attributes.1.key', message: 'Each attribute name must be unique.' }])
        expect(DUPLICATE_ATTRIBUTE_MESSAGE).toBe('Each attribute name must be unique.')
    })
    it('unique names create fine', async () => {
        const data = { attributes: [{ key: 'A', value: '1' }, { key: 'B', value: '1' }] }
        await expect(run({ operation: 'create', data })).resolves.toBe(data)
    })
})

describe('[TC-F08-04-145] update of an existing product that already has duplicates', () => {
    const originalDoc = { attributes: [{ key: 'Material', value: 'a' }, { key: 'material', value: 'b' }] }
    it('attributes not sent -> passes', async () => {
        await expect(run({ operation: 'update', data: {}, originalDoc })).resolves.toBeDefined()
    })
    it('attributes sent unchanged -> passes', async () => {
        await expect(run({ operation: 'update', data: { attributes: [...originalDoc.attributes] }, originalDoc })).resolves.toBeDefined()
    })
})

describe('[TC-F08-04-146] update that edits attributes / migration context', () => {
    const originalDoc = { attributes: [{ key: 'Material', value: 'a' }, { key: 'material', value: 'b' }] }
    it('edit that still has duplicates is blocked', async () => {
        const errors = await thrownErrors(run({ operation: 'update', data: { attributes: [{ key: 'Material', value: 'a' }, { key: 'material', value: 'changed' }] }, originalDoc }))
        expect(errors).toEqual([{ path: 'attributes.1.key', message: DUPLICATE_ATTRIBUTE_MESSAGE }])
    })
    it('edit that removes duplicates passes', async () => {
        await expect(run({ operation: 'update', data: { attributes: [{ key: 'Material', value: 'a' }, { key: 'Lining', value: 'b' }] }, originalDoc })).resolves.toBeDefined()
    })
    it('private migration context skips the check', async () => {
        await expect(run({ operation: 'create', data: { attributes: [{ key: 'A' }, { key: 'a' }] }, context: migrationContext() })).resolves.toBeDefined()
    })
    it('forged context flag does not skip the check', async () => {
        await expect(run({ operation: 'create', data: { attributes: [{ key: 'A' }, { key: 'a' }] }, context: { migrationProfile: 'pw1-json-v1' } })).rejects.toBeDefined()
    })
})
