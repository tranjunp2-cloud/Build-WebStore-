// RHF's plain `register()` on a `type="number"` input stores the raw DOM value, so a
// cleared field is the empty string `''` at runtime — not `undefined` — even though
// VariantRowInput types it as `number | undefined`. `x != null` alone treats `''` as a
// real value (`Number('') === 0`), silently baking a user's in-progress clear into a
// permanent 0 on the next regenerate (code-review finding L4). Use this everywhere an
// existing row's numeric field is read as "does this have a real value".
export function hasNumericValue(v: unknown): v is number {
    return v !== undefined && v !== null && v !== ''
}

/** Returns true if the tier has a name AND at least one non-empty option value. */
export function isNonEmptyTier(tier: { name?: string; options?: string[] }): boolean {
    return !!(tier.name?.trim() && (tier.options || []).some(o => o?.trim()))
}

/** Computes the cartesian product of option values across all active tiers. Returns [] when no active tiers exist. */
export function cartesianProductOfTiers(
    tiers: Array<{ name?: string; options?: string[] }>
): string[][] {
    const valid = tiers
        .map(t => ({ ...t, options: (t.options || []).filter(o => (o || '').trim() !== '') }))
        .filter(t => isNonEmptyTier(t))
    if (valid.length === 0) return []
    let combinations: string[][] = [[]]
    for (const tier of valid) {
        const next: string[][] = []
        for (const combo of combinations) {
            for (const opt of tier.options) {
                next.push([...combo, opt])
            }
        }
        combinations = next
    }
    return combinations
}

export type VariantBaseValues = {
    price: number
    compareAtPrice?: number
    inventory: number
    sku: string
}

export type VariantRowInput = {
    id?: string
    variantName: string
    skuCode?: string
    price?: number
    compareAtPrice?: number
    stock?: number
}

export type VariantRow = Required<Pick<VariantRowInput, 'variantName'>> & {
    id: string
    skuCode: string
    price: number
    stock: number
    compareAtPrice?: number
}

/**
 * Builds the variant matrix from cartesian combinations.
 * Preserves a row's price only when the user customized it (differs from prevBasePrice),
 * and independently preserves a row's compareAtPrice only when THAT was customized
 * (differs from prevBaseCompareAtPrice) — price and compareAtPrice are tracked
 * separately so editing one doesn't gate protection of the other (GH-1525 follow-up
 * bug: regenerating silently overwrote a row's manually-edited compareAtPrice back to
 * the master value whenever that row's price happened to be unchanged).
 * When prevBaseSku is provided, auto-generated SKUs (matching `${prevBaseSku}-${suffix}`)
 * are updated to use the new base.sku prefix; manually customized SKUs are preserved.
 * hasEverGeneratedNonEmpty distinguishes a genuinely first-ever generate from a
 * cleared-then-regenerated one (both look like `currentVariants.length === 0`) so new
 * rows don't seed from a possibly-stale base.inventory (H1).
 * An existing row's own price/stock/compareAtPrice that the user cleared to '' is
 * treated as "no value" (not the number 0) via hasNumericValue — regenerating a
 * cleared price/compareAtPrice falls back to base.price/undefined instead of freezing
 * at 0 (L4).
 */
export function buildVariantMatrix(
    combinations: string[][],
    base: VariantBaseValues,
    currentVariants: VariantRowInput[],
    prevBasePrice: number | null,
    prevBaseSku?: string,
    prevBaseCompareAtPrice?: number | null,
    hasEverGeneratedNonEmpty?: boolean,
): VariantRow[] {
    return combinations.map((combo) => {
        const variantName = combo.join(' - ')
        const existing = currentVariants.find(v => v.variantName === variantName)
        const suffix = combo.map(c => c.substring(0, 3).toUpperCase()).join('-')
        const newAutoSku = `${base.sku}-${suffix}`
        const autoSkuOld = prevBaseSku ? `${prevBaseSku}-${suffix}` : null
        // Preserve user-customized SKU; replace auto-generated or empty with new prefix
        const resolveSku = (existingSku?: string) =>
            existingSku && existingSku !== autoSkuOld ? existingSku : newAutoSku

        // An existing row's stock is NEVER reset by (re)generate — only a genuinely new
        // combo seeds a default. Regenerating used to overwrite every non-price-customized
        // row's stock with `base.inventory`, which is itself kept in sync as the SUM of
        // all variant stocks (see VariantOptionsSection's baseInventory-sync effect) — so
        // each Generate click multiplied total stock by the variant count (GH-1525
        // follow-up bug: "stock cộng dồn cực lớn").
        //
        // A brand-new row's default depends on whether the product has EVER had a
        // non-empty variant matrix this session, not just on whether currentVariants is
        // empty right now — `currentVariants.length === 0` alone can't tell "genuinely
        // first-ever generate" apart from "had variants, user cleared all options, now
        // regenerating" (code-review adversarial finding H1). In the latter case
        // base.inventory is likely a stale auto-synced SUM from before the clear (per
        // GH-1525 issue-2 decision #1, master fields are never force-reset when variants
        // are cleared — see VariantOptionsSection's baseInventory-sync effect), so it is
        // NOT a meaningful per-row seed there even though currentVariants is [].
        // - Genuinely first-ever generate → seed from base.inventory (the value the user
        //   typed into Inventory before turning variants on — a real seed).
        // - Otherwise (already generated before, incl. cleared-then-regenerated, or a
        //   genuinely new row added to an existing matrix) → starts at 0 (out of stock
        //   until the merchant confirms — matches the AI bulk-create convention elsewhere).
        const isFirstEverGenerate = currentVariants.length === 0 && !hasEverGeneratedNonEmpty
        const stock = hasNumericValue(existing?.stock)
            ? Number(existing!.stock)
            : (isFirstEverGenerate ? base.inventory : 0)

        if (!existing) {
            return {
                id: crypto.randomUUID(),
                variantName,
                skuCode: resolveSku(undefined),
                price: base.price,
                stock,
                compareAtPrice: base.compareAtPrice || undefined,
            }
        }

        // Price and compareAtPrice are tracked independently — a row can have its
        // compareAtPrice customized without its price ever changing (or vice versa),
        // so neither field's "was this customized" check may gate the other's.
        // prevBasePrice/prevBaseCompareAtPrice === null (unknown baseline, e.g. first
        // generate in an edit session) → always preserve, never wipe pre-existing data.
        const priceCustomized = prevBasePrice === null || Number(existing.price) !== prevBasePrice
        const existingCompare = hasNumericValue(existing.compareAtPrice) ? Number(existing.compareAtPrice) : undefined
        const compareCustomized = prevBaseCompareAtPrice == null || existingCompare !== prevBaseCompareAtPrice

        return {
            id: existing.id || crypto.randomUUID(),
            variantName: existing.variantName,
            skuCode: resolveSku(existing.skuCode),
            price: priceCustomized && hasNumericValue(existing.price) ? Number(existing.price) : base.price,
            stock,
            compareAtPrice: compareCustomized ? existingCompare : (base.compareAtPrice || undefined),
        }
    })
}

/**
 * Returns the set of indices (within a single tier's options array) that are
 * case-insensitive duplicates of another entry. Both the first and subsequent
 * occurrences are included so all conflicting inputs can be highlighted.
 */
export function computeDuplicateIndicesForOptions(options: string[]): Set<number> {
    const seen = new Map<string, number>()
    const dups = new Set<number>()
    options.forEach((opt, oIdx) => {
        const norm = (opt || '').trim().toLowerCase()
        if (!norm) return
        if (seen.has(norm)) {
            dups.add(oIdx)
            dups.add(seen.get(norm)!)
        } else {
            seen.set(norm, oIdx)
        }
    })
    return dups
}
