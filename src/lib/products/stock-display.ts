export type StockSeverity = 'destructive' | 'warning' | 'success'

export type StockBreakdownItem = { name: string; stock: number }

export type StockDisplay = {
    /** Plain number as a string — never includes i18n words. For a variant
     * product this is the summed total (master inventory), not a min-max range;
     * the caller appends "1 variant" / "{count} variants" (i18n, singular-aware)
     * when `showVariantCount` is true, mirroring how `getDisplayPrice`'s "From "
     * prefix is composed by the caller rather than baked into this pure helper. */
    label: string
    /** True whenever the product has 1+ variants — `label` is the total, and the
     * caller should render it as `"{label} / {variantCount} variant(s)"`. */
    showVariantCount: boolean
    min: number
    max: number
    /** Sum of all variant stocks (variant product), or same as `min`/`max` otherwise. */
    total: number
    /** Number of variant rows; 0 when the product has no variants. */
    variantCount: number
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
 * - No variants (or empty variants array) → single number from `inventory`, no suffix.
 * - 1+ variants → master inventory total as the label (`showVariantCount: true`); the
 *   caller renders `"{label} / {variantCount} variant(s)"`. No longer a `"{min} - {max}"`
 *   range — replaced per product decision (was ambiguous vs. the actual saved total).
 *   Severity is unchanged: still derived from the per-variant min/max spread, not the
 *   total — a healthy-looking total can hide a fully-dead variant. For exactly 1 variant
 *   `min === max === total`, so this is equivalent to `singleSeverity`.
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
            showVariantCount: false,
            min: inv,
            max: inv,
            total: inv,
            variantCount: 0,
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
    const total = stocks.reduce((a, b) => a + b, 0)

    return {
        label: String(total),
        showVariantCount: true,
        min,
        max,
        total,
        variantCount: breakdown.length,
        severity: rangeSeverity(min, max),
        breakdown,
    }
}
