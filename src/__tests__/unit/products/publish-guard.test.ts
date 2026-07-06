/**
 * Unit tests for productPublishBlocks (src/lib/products/publish-guard.ts).
 *
 * TC-09.37 — soft validation publishing gate (GH-1458): blocks Draft->Active when core
 * fields are missing. Mirrors the structure of activation-guard.test.ts.
 */
// @vitest-environment node

import { describe, it, expect } from 'vitest'
import { productPublishBlocks } from '@/lib/products/publish-guard'

// ── TC-09.37: non-variant mode ────────────────────────────────────────────────
describe('productPublishBlocks — TC-09.37: non-variant complete', () => {
    it('allows activation when price, sku, inventory, weight are all set', () => {
        const r = productPublishBlocks({ price: 100, sku: 'SP-A01', inventory: 10, weight: 500, hasVariants: false })
        expect(r).toEqual({ ok: true, missingFields: [] })
    })

    it('treats price:0 and inventory:0 as SET, not missing', () => {
        const r = productPublishBlocks({ price: 0, sku: 'SP-A01', inventory: 0, weight: 500, hasVariants: false })
        expect(r).toEqual({ ok: true, missingFields: [] })
    })
})

describe('productPublishBlocks — TC-09.37: non-variant missing-each', () => {
    it('flags missing price', () => {
        const r = productPublishBlocks({ price: null, sku: 'SP-A01', inventory: 10, weight: 500, hasVariants: false })
        expect(r.ok).toBe(false)
        expect(r.missingFields).toEqual(['price'])
    })

    it('flags missing sku (undefined, empty, or whitespace-only)', () => {
        expect(productPublishBlocks({ price: 100, inventory: 10, weight: 500, hasVariants: false }).missingFields).toEqual(['sku'])
        expect(productPublishBlocks({ price: 100, sku: '', inventory: 10, weight: 500, hasVariants: false }).missingFields).toEqual(['sku'])
        expect(productPublishBlocks({ price: 100, sku: '   ', inventory: 10, weight: 500, hasVariants: false }).missingFields).toEqual(['sku'])
    })

    it('flags missing inventory', () => {
        const r = productPublishBlocks({ price: 100, sku: 'SP-A01', inventory: undefined, weight: 500, hasVariants: false })
        expect(r.missingFields).toEqual(['inventory'])
    })

    it('flags all four when everything is missing', () => {
        const r = productPublishBlocks({ hasVariants: false })
        expect(r.ok).toBe(false)
        expect(r.missingFields.sort()).toEqual(['inventory', 'price', 'sku', 'weight'])
    })
})

// ── TC-09.37: weight (required in BOTH modes) ─────────────────────────────────
describe('productPublishBlocks — TC-09.37: weight', () => {
    it('flags missing weight (undefined) on an otherwise-complete non-variant product', () => {
        const r = productPublishBlocks({ price: 100, sku: 'SP-A01', inventory: 10, hasVariants: false })
        expect(r.missingFields).toEqual(['weight'])
    })

    it('flags weight:0 as missing — unlike price/inventory, 0 is never a valid physical weight', () => {
        const r = productPublishBlocks({ price: 100, sku: 'SP-A01', inventory: 10, weight: 0, hasVariants: false })
        expect(r.missingFields).toEqual(['weight'])
    })

    it('flags negative weight as missing', () => {
        const r = productPublishBlocks({ price: 100, sku: 'SP-A01', inventory: 10, weight: -5, hasVariants: false })
        expect(r.missingFields).toEqual(['weight'])
    })

    it('flags missing weight on an otherwise-complete variant product', () => {
        const r = productPublishBlocks({
            hasVariants: true,
            sku: 'SP-A01',
            variants: [{ sku: 'SP-A01-RED', price: 100, stock: 5 }],
        })
        expect(r.missingFields).toEqual(['weight'])
    })

    it('allows a small positive weight (e.g. 0.1)', () => {
        const r = productPublishBlocks({ price: 100, sku: 'SP-A01', inventory: 10, weight: 0.1, hasVariants: false })
        expect(r.ok).toBe(true)
    })
})

// ── TC-09.37: variant mode ────────────────────────────────────────────────────
describe('productPublishBlocks — TC-09.37: variant complete', () => {
    it('allows activation when base sku set and every variant has sku/price/stock', () => {
        const r = productPublishBlocks({
            hasVariants: true,
            sku: 'SP-A01',
            weight: 500,
            variants: [{ sku: 'SP-A01-RED', price: 100, stock: 5 }],
        })
        expect(r).toEqual({ ok: true, missingFields: [] })
    })

    it('treats variant price:0 and stock:0 as SET, not missing', () => {
        const r = productPublishBlocks({
            hasVariants: true,
            sku: 'SP-A01',
            weight: 500,
            variants: [{ sku: 'SP-A01-RED', price: 0, stock: 0 }],
        })
        expect(r.ok).toBe(true)
    })
})

describe('productPublishBlocks — TC-09.37: variant empty-matrix / missing-field', () => {
    it('flags "variants" when matrix is empty or absent', () => {
        expect(productPublishBlocks({ hasVariants: true, sku: 'SP-A01', weight: 500, variants: [] }).missingFields).toEqual(['variants'])
        expect(productPublishBlocks({ hasVariants: true, sku: 'SP-A01', weight: 500 }).missingFields).toEqual(['variants'])
    })

    it('flags "variants" when any single variant is missing sku/price/stock', () => {
        const missingSku = productPublishBlocks({
            hasVariants: true,
            sku: 'SP-A01',
            weight: 500,
            variants: [{ sku: '', price: 100, stock: 5 }],
        })
        expect(missingSku.missingFields).toEqual(['variants'])

        const missingPrice = productPublishBlocks({
            hasVariants: true,
            sku: 'SP-A01',
            weight: 500,
            variants: [{ sku: 'SP-A01-RED', price: null, stock: 5 }],
        })
        expect(missingPrice.missingFields).toEqual(['variants'])

        const missingStock = productPublishBlocks({
            hasVariants: true,
            sku: 'SP-A01',
            weight: 500,
            variants: [{ sku: 'SP-A01-RED', price: 100, stock: undefined }],
        })
        expect(missingStock.missingFields).toEqual(['variants'])
    })

    it('flags "sku", "weight" and "variants" when base sku missing, weight missing AND matrix incomplete', () => {
        const r = productPublishBlocks({ hasVariants: true, variants: [] })
        expect(r.missingFields.sort()).toEqual(['sku', 'variants', 'weight'])
    })
})

// ── TC-09.37: both modes / edge inputs ────────────────────────────────────────
describe('productPublishBlocks — TC-09.37: edge inputs', () => {
    it('defaults hasVariants falsy input to non-variant rules', () => {
        const r = productPublishBlocks({ price: 50, sku: 'X', inventory: 1, weight: 500 })
        expect(r.ok).toBe(true)
    })

    it('does not include "images" or "category" in missingFields per D1', () => {
        const r = productPublishBlocks({ hasVariants: false })
        expect(r.missingFields).not.toContain('images')
        expect(r.missingFields).not.toContain('category')
    })
})

// ── TC-09.46: weight type-safety (code-review fix) ─────────────────────────────
// saveProductAction's schema is .passthrough(), so weight can arrive as any type. The guard
// must not rely on JS coercion (`!value` / `value <= 0`), which treats a non-numeric string as
// "present and valid" (`!"abc"` is false, `"abc" <= 0` is false via NaN comparison).
describe('productPublishBlocks — TC-09.46: weight type-safety', () => {
    const complete = { price: 50, sku: 'X', inventory: 1 }

    it('flags "weight" when weight is a non-numeric string', () => {
        const r = productPublishBlocks({ ...complete, weight: 'abc' as unknown as number })
        expect(r.missingFields).toContain('weight')
    })

    it('flags "weight" when weight is NaN', () => {
        const r = productPublishBlocks({ ...complete, weight: NaN })
        expect(r.missingFields).toContain('weight')
    })

    it('accepts a genuine positive numeric weight', () => {
        const r = productPublishBlocks({ ...complete, weight: 500 })
        expect(r.missingFields).not.toContain('weight')
    })
})

// ── TC-09.51: price/inventory/variant-field type-safety (adversarial review fix) ──────────────
// Same class of bug as TC-09.46 (weight), but for price/inventory/variant sku-price-stock: raw
// REST/GraphQL callers aren't constrained to the types a form would send. `== null` alone treats
// a non-numeric string/object as "present and valid".
describe('productPublishBlocks — TC-09.51: price/inventory/variant type-safety', () => {
    it('flags "price" and "inventory" when they are non-numeric strings', () => {
        const r = productPublishBlocks({ price: 'abc' as unknown as number, sku: 'X', inventory: 'xyz' as unknown as number, weight: 500 })
        expect(r.missingFields).toContain('price')
        expect(r.missingFields).toContain('inventory')
    })

    it('does not throw when sku is a non-string truthy value (object/array) — flags it as missing instead', () => {
        expect(() => productPublishBlocks({ price: 50, sku: {} as unknown as string, inventory: 1, weight: 500 })).not.toThrow()
        const r = productPublishBlocks({ price: 50, sku: [] as unknown as string, inventory: 1, weight: 500 })
        expect(r.missingFields).toContain('sku')
    })

    it('flags "variants" when a variant price/stock is a non-numeric type', () => {
        const r = productPublishBlocks({
            hasVariants: true,
            sku: 'SP-A01',
            weight: 500,
            variants: [{ sku: 'SP-A01-RED', price: 'abc' as unknown as number, stock: 5 }],
        })
        expect(r.missingFields).toContain('variants')
    })

    it('does not throw when a variant sku is a non-string truthy value', () => {
        expect(() => productPublishBlocks({
            hasVariants: true,
            sku: 'SP-A01',
            weight: 500,
            variants: [{ sku: {} as unknown as string, price: 100, stock: 5 }],
        })).not.toThrow()
    })
})
