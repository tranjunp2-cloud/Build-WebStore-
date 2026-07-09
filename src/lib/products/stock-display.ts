export type StockSeverity = 'destructive' | 'warning' | 'success'

export type StockBreakdownItem = { name: string; stock: number }

export type StockDisplay = {
    label: string
    isRange: boolean
    min: number
    max: number
    severity: StockSeverity
    /** Per-variant stock rows, or `null` when the product has no variants. */
    breakdown: StockBreakdownItem[] | null
}

/** Severity for a single stock number (e.g. one row in a per-variant breakdown). */
export function singleSeverity(inv: number): StockSeverity {
    if (inv === 0) return 'destructive'
    if (inv <= 5) return 'warning'
    return 'success'
}

// Refined per plan.md "Validation Summary" (2026-07-08): a single out-of-stock
// variant is only `destructive` when EVERY variant is out (max === 0). If some
// stock remains elsewhere, it's a `warning` — red is reserved for "nothing left".
function rangeSeverity(min: number, max: number): StockSeverity {
    if (max === 0) return 'destructive'
    if (min === 0 && max > 0) return 'warning'
    if (min > 0 && min <= 5) return 'warning'
    return 'success'
}

/**
 * Pure helper computing the Stock column display for a product list row.
 * Mirrors the `getDisplayPrice` pattern (loose/structural input, no side effects).
 *
 * - No variants (or empty variants array) → single number from `inventory`.
 * - Exactly 1 variant / all variants equal stock → single number (breakdown still populated).
 * - Variants with differing stock → `"{min} - {max}"` range label.
 */
export function computeStockDisplay(p: {
    hasVariants?: boolean
    inventory?: number
    variants?: Array<{ name: string; stock?: number | string }>
}): StockDisplay {
    const variants = p.hasVariants && p.variants && p.variants.length > 0 ? p.variants : null

    if (!variants) {
        const inv = Math.max(0, Number(p.inventory) || 0)
        return {
            label: String(inv),
            isRange: false,
            min: inv,
            max: inv,
            severity: singleSeverity(inv),
            breakdown: null,
        }
    }

    const breakdown: StockBreakdownItem[] = variants.map(v => ({
        name: v.name,
        stock: Math.max(0, Number(v.stock) || 0),
    }))

    const stocks = breakdown.map(b => b.stock)
    // reduce, not Math.min/max(...stocks) — a spread blows the call stack on very large arrays
    const min = stocks.reduce((a, b) => Math.min(a, b))
    const max = stocks.reduce((a, b) => Math.max(a, b))
    const isRange = breakdown.length > 1 && min !== max

    if (!isRange) {
        const single = breakdown[0]?.stock ?? 0
        return {
            label: String(single),
            isRange: false,
            min: single,
            max: single,
            severity: singleSeverity(single),
            breakdown,
        }
    }

    return {
        label: `${min} - ${max}`,
        isRange: true,
        min,
        max,
        severity: rangeSeverity(min, max),
        breakdown,
    }
}
