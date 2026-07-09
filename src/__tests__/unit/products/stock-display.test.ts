import { describe, it, expect } from 'vitest'
import { computeStockDisplay, type StockDisplay } from '@/lib/products/stock-display'

// ── TC-F08-1525-01..08: Stock Display Helper ───────────────────────────────────

describe('[TC-F08-1525] computeStockDisplay', () => {
	// TC-F08-1525-01: No variants → single number from inventory
	it('TC-F08-1525-01: no variants → single number from inventory', () => {
		const p = { hasVariants: false, inventory: 15 }
		const result = computeStockDisplay(p)

		expect(result.label).toBe('15')
		expect(result.isRange).toBe(false)
		expect(result.min).toBe(15)
		expect(result.max).toBe(15)
		expect(result.severity).toBe('success')
		expect(result.breakdown).toBeNull()
	})

	// TC-F08-1525-02: Exactly 1 variant → single number (breakdown still populated)
	it('TC-F08-1525-02: exactly 1 variant → single number with breakdown', () => {
		const p = {
			hasVariants: true,
			variants: [{ name: 'Red-M', stock: 8 }],
		}
		const result = computeStockDisplay(p)

		expect(result.label).toBe('8')
		expect(result.isRange).toBe(false)
		expect(result.min).toBe(8)
		expect(result.max).toBe(8)
		expect(result.severity).toBe('success')
		expect(result.breakdown).toEqual([{ name: 'Red-M', stock: 8 }])
	})

	// TC-F08-1525-03: All variants equal stock → single number
	it('TC-F08-1525-03: all variants equal stock → single number, isRange=false', () => {
		const p = {
			hasVariants: true,
			variants: [
				{ name: 'Red-M', stock: 5 },
				{ name: 'Blue-M', stock: 5 },
				{ name: 'Green-M', stock: 5 },
			],
		}
		const result = computeStockDisplay(p)

		expect(result.label).toBe('5')
		expect(result.isRange).toBe(false)
		expect(result.min).toBe(5)
		expect(result.max).toBe(5)
		expect(result.severity).toBe('warning') // stock=5 → singleSeverity=warning
		expect(result.breakdown).toHaveLength(3)
	})

	// TC-F08-1525-04: Variants differ → range label "{min} - {max}"
	it('TC-F08-1525-04: variants differ → range label and isRange=true', () => {
		const p = {
			hasVariants: true,
			variants: [
				{ name: 'Red-M', stock: 2 },
				{ name: 'Blue-L', stock: 10 },
				{ name: 'Green-XL', stock: 5 },
			],
		}
		const result = computeStockDisplay(p)

		expect(result.label).toBe('2 - 10')
		expect(result.isRange).toBe(true)
		expect(result.min).toBe(2)
		expect(result.max).toBe(10)
		expect(result.severity).toBe('warning') // min > 0 && min <= 5 → warning
		expect(result.breakdown).toHaveLength(3)
	})

	// TC-F08-1525-05: String stock coercion → converted to number
	it('TC-F08-1525-05: string stock values → coerced to numbers', () => {
		const p = {
			hasVariants: true,
			variants: [
				{ name: 'Variant A', stock: '7' },
				{ name: 'Variant B', stock: '3' },
			],
		}
		const result = computeStockDisplay(p)

		expect(result.label).toBe('3 - 7')
		expect(result.min).toBe(3)
		expect(result.max).toBe(7)
		expect(result.breakdown?.[0]?.stock).toBe(7)
		expect(result.breakdown?.[1]?.stock).toBe(3)
	})

	// TC-F08-1525-06: Severity destructive → max === 0
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
		expect(result.isRange).toBe(false)
		expect(result.severity).toBe('destructive')
	})

	// TC-F08-1525-07: Severity warning → min === 0 && max > 0
	it('TC-F08-1525-07: severity warning when min === 0 && max > 0 (mixed stock)', () => {
		const p = {
			hasVariants: true,
			variants: [
				{ name: 'Red-S', stock: 0 },
				{ name: 'Red-M', stock: 5 },
			],
		}
		const result = computeStockDisplay(p)

		expect(result.label).toBe('0 - 5')
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
		expect(result.isRange).toBe(false)
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
		expect(result.isRange).toBe(false)
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
})
