import { describe, it, expect } from 'vitest'
import { computeStockDisplay, type StockDisplay } from '@/lib/products/stock-display'

// ── TC-F08-1525-01..18: Stock Display Helper ───────────────────────────────────
// Addendum (product decision, 2026-07-10): the "{min} - {max}" range label was
// replaced with the master inventory total + variant count (e.g. "30 / 3 variants")
// — see TC-F08-1525-19..22 below. Severity logic is unchanged (still derived from
// the per-variant min/max spread via `rangeSeverity`, not the total).

describe('[TC-F08-1525] computeStockDisplay', () => {
	// TC-F08-1525-01: No variants → single number from inventory
	it('TC-F08-1525-01: no variants → single number from inventory', () => {
		const p = { hasVariants: false, inventory: 15 }
		const result = computeStockDisplay(p)

		expect(result.label).toBe('15')
		expect(result.showVariantCount).toBe(false)
		expect(result.min).toBe(15)
		expect(result.max).toBe(15)
		expect(result.total).toBe(15)
		expect(result.variantCount).toBe(0)
		expect(result.severity).toBe('success')
		expect(result.breakdown).toBeNull()
	})

	// TC-F08-1525-02: Exactly 1 variant → total label (same number as that variant's
	// stock), showVariantCount=true so the caller appends "1 variant"
	it('TC-F08-1525-02: exactly 1 variant → total label, showVariantCount=true, breakdown populated', () => {
		const p = {
			hasVariants: true,
			variants: [{ name: 'Red-M', stock: 8 }],
		}
		const result = computeStockDisplay(p)

		expect(result.label).toBe('8')
		expect(result.showVariantCount).toBe(true)
		expect(result.min).toBe(8)
		expect(result.max).toBe(8)
		expect(result.total).toBe(8)
		expect(result.variantCount).toBe(1)
		expect(result.severity).toBe('success')
		expect(result.breakdown).toEqual([{ name: 'Red-M', stock: 8 }])
	})

	// TC-F08-1525-03: All variants equal stock → total (sum), not the per-variant value
	it('TC-F08-1525-03: all variants equal stock → label is the summed total, not one variant\'s stock', () => {
		const p = {
			hasVariants: true,
			variants: [
				{ name: 'Red-M', stock: 5 },
				{ name: 'Blue-M', stock: 5 },
				{ name: 'Green-M', stock: 5 },
			],
		}
		const result = computeStockDisplay(p)

		expect(result.label).toBe('15') // 5+5+5, not '5'
		expect(result.showVariantCount).toBe(true)
		expect(result.variantCount).toBe(3)
		expect(result.min).toBe(5)
		expect(result.max).toBe(5)
		expect(result.total).toBe(15)
		expect(result.severity).toBe('warning') // per-variant min=5 → warning, unchanged by the label change
		expect(result.breakdown).toHaveLength(3)
	})

	// TC-F08-1525-04: Variants differ → total label (no longer a "{min} - {max}" range)
	it('TC-F08-1525-04: variants differ → total label (not a min-max range)', () => {
		const p = {
			hasVariants: true,
			variants: [
				{ name: 'Red-M', stock: 2 },
				{ name: 'Blue-L', stock: 10 },
				{ name: 'Green-XL', stock: 5 },
			],
		}
		const result = computeStockDisplay(p)

		expect(result.label).toBe('17') // 2+10+5, not '2 - 10'
		expect(result.showVariantCount).toBe(true)
		expect(result.variantCount).toBe(3)
		expect(result.min).toBe(2)
		expect(result.max).toBe(10)
		expect(result.total).toBe(17)
		expect(result.severity).toBe('warning') // min > 0 && min <= 5 → warning, unchanged
		expect(result.breakdown).toHaveLength(3)
	})

	// TC-F08-1525-05: String stock coercion → converted to number, summed into total
	it('TC-F08-1525-05: string stock values → coerced to numbers before summing', () => {
		const p = {
			hasVariants: true,
			variants: [
				{ name: 'Variant A', stock: '7' },
				{ name: 'Variant B', stock: '3' },
			],
		}
		const result = computeStockDisplay(p)

		expect(result.label).toBe('10') // 7+3
		expect(result.min).toBe(3)
		expect(result.max).toBe(7)
		expect(result.total).toBe(10)
		expect(result.breakdown?.[0]?.stock).toBe(7)
		expect(result.breakdown?.[1]?.stock).toBe(3)
	})

	// TC-F08-1525-06: Severity destructive → max === 0 (unaffected by the label change)
	it('TC-F08-1525-06: severity destructive when max === 0', () => {
		const p = {
			hasVariants: true,
			variants: [
				{ name: 'Red', stock: 0 },
				{ name: 'Blue', stock: 0 },
			],
		}
		const result = computeStockDisplay(p)

		expect(result.label).toBe('0')
		expect(result.showVariantCount).toBe(true)
		expect(result.severity).toBe('destructive')
	})

	// TC-F08-1525-07: Severity warning → min === 0 && max > 0 (mixed stock); label is the total
	it('TC-F08-1525-07: severity warning when min === 0 && max > 0 (mixed stock), label is total', () => {
		const p = {
			hasVariants: true,
			variants: [
				{ name: 'Red-S', stock: 0 },
				{ name: 'Red-M', stock: 5 },
			],
		}
		const result = computeStockDisplay(p)

		expect(result.label).toBe('5') // 0+5, not '0 - 5'
		expect(result.severity).toBe('warning')
	})

	// TC-F08-1525-08: Severity success → min > 5
	it('TC-F08-1525-08: severity success when min > 5 (healthy stock)', () => {
		const p = {
			hasVariants: true,
			variants: [
				{ name: 'Red', stock: 10 },
				{ name: 'Blue', stock: 20 },
			],
		}
		const result = computeStockDisplay(p)

		expect(result.severity).toBe('success')
	})

	// TC-F08-1525-09: Empty variants array → single inventory fallback
	it('TC-F08-1525-09: empty variants array → fallback to single inventory', () => {
		const p = {
			hasVariants: true,
			variants: [],
			inventory: 12,
		}
		const result = computeStockDisplay(p)

		expect(result.label).toBe('12')
		expect(result.showVariantCount).toBe(false)
		expect(result.variantCount).toBe(0)
		expect(result.breakdown).toBeNull()
	})

	// TC-F08-1525-15: Missing inventory defaults to 0
	// (numbered 15, not 10 — TC-F08-1525-10..14 are already claimed by
	// master-fields-disable.test.tsx for unrelated scenarios)
	it('TC-F08-1525-15: missing inventory → defaults to 0', () => {
		const p = { hasVariants: false }
		const result = computeStockDisplay(p)

		expect(result.label).toBe('0')
		expect(result.severity).toBe('destructive')
	})

	// TC-F08-1525-16: Range severity: min > 0 && min <= 5 → warning
	it('TC-F08-1525-16: range severity warning when 0 < min <= 5', () => {
		const p = {
			hasVariants: true,
			variants: [
				{ name: 'V1', stock: 3 },
				{ name: 'V2', stock: 15 },
			],
		}
		const result = computeStockDisplay(p)

		expect(result.severity).toBe('warning') // min=3, 0 < 3 <= 5
	})

	// TC-F08-1525-17: hasVariants=false → ignores a populated variants array, uses inventory
	it('TC-F08-1525-17: hasVariants=false with variants present → ignores variants, uses inventory', () => {
		const p = {
			hasVariants: false,
			inventory: 5,
			variants: [
				{ name: 'Red-M', stock: 2 },
				{ name: 'Blue-L', stock: 10 },
			],
		}
		const result = computeStockDisplay(p)

		expect(result.label).toBe('5')
		expect(result.showVariantCount).toBe(false)
		expect(result.breakdown).toBeNull()
	})

	// TC-F08-1525-18: Negative stock (corrupted/legacy data) clamped to 0, never masked as healthy
	// (adversarial-review fix — `Number(v.stock) || 0` alone lets negative values pass through
	// unchanged since they're truthy, which could render a false "success" badge on oversold stock)
	it('TC-F08-1525-18: negative stock values clamp to 0 instead of producing a false-healthy severity', () => {
		const single = computeStockDisplay({ hasVariants: false, inventory: -5 })
		expect(single.label).toBe('0')
		expect(single.severity).toBe('destructive')

		const range = computeStockDisplay({
			hasVariants: true,
			variants: [
				{ name: 'Red', stock: -5 },
				{ name: 'Blue', stock: 3 },
			],
		})
		expect(range.min).toBe(0)
		expect(range.breakdown?.[0]?.stock).toBe(0)
		expect(range.severity).not.toBe('success')
	})

	// ── TC-F08-1525-71..74: master-inventory-total label (2026-07-10 product decision) ──
	// (71-74, not 19-22 — those numbers were already claimed by
	// products-stock-cell.test.tsx's "Products List Stock Cell Rendering" section;
	// found + renumbered by adversarial code review.)

	// TC-F08-1525-71: canonical example from the request — 3 variants, total 30
	it('TC-F08-1525-71: 3 variants totalling 30 → label "30", showVariantCount=true, variantCount=3', () => {
		const p = {
			hasVariants: true,
			variants: [
				{ name: 'S', stock: 10 },
				{ name: 'M', stock: 10 },
				{ name: 'L', stock: 10 },
			],
		}
		const result = computeStockDisplay(p)

		expect(result.label).toBe('30')
		expect(result.showVariantCount).toBe(true)
		expect(result.variantCount).toBe(3)
		expect(result.total).toBe(30)
	})

	// TC-F08-1525-72: total type consistency — `label` is always `String(total)` for variant products
	it('TC-F08-1525-72: label always equals String(total) whenever showVariantCount is true', () => {
		const result = computeStockDisplay({
			hasVariants: true,
			variants: [
				{ name: 'A', stock: 4 },
				{ name: 'B', stock: 0 },
				{ name: 'C', stock: 11 },
			],
		})

		expect(result.label).toBe(String(result.total))
	})

	// TC-F08-1525-73: variantCount matches breakdown length exactly
	it('TC-F08-1525-73: variantCount equals breakdown.length', () => {
		const result = computeStockDisplay({
			hasVariants: true,
			variants: [
				{ name: 'A', stock: 1 },
				{ name: 'B', stock: 2 },
				{ name: 'C', stock: 3 },
				{ name: 'D', stock: 4 },
			],
		})

		expect(result.variantCount).toBe(result.breakdown?.length)
		expect(result.variantCount).toBe(4)
	})

	// TC-F08-1525-74: no-variants case never sets showVariantCount, regardless of inventory value
	it('TC-F08-1525-74: showVariantCount stays false for non-variant products even with high inventory', () => {
		const result: StockDisplay = computeStockDisplay({ hasVariants: false, inventory: 999 })

		expect(result.showVariantCount).toBe(false)
		expect(result.variantCount).toBe(0)
		expect(result.label).toBe('999')
	})
})
