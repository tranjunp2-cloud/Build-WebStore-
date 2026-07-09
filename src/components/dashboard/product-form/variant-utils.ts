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
 */
export function buildVariantMatrix(
    combinations: string[][],
    base: VariantBaseValues,
    currentVariants: VariantRowInput[],
    prevBasePrice: number | null,
    prevBaseSku?: string,
    prevBaseCompareAtPrice?: number | null,
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
        // A brand-new row's default depends on whether the product already had variants
        // BEFORE this generate call:
        // - First-ever generate (currentVariants empty) → seed from base.inventory (the
        //   value the user typed into Inventory before turning variants on — a real seed).
        // - Product already has variants → base.inventory is the auto-synced SUM of all
        //   existing stock, not a meaningful per-row seed, so a genuinely new row (e.g.
        //   from adding an option to an existing matrix) starts at 0 (out of stock until
        //   the merchant confirms — matches the AI bulk-create convention elsewhere).
        const isFirstEverGenerate = currentVariants.length === 0
        const stock = existing?.stock != null
            ? Number(existing.stock)
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
        const existingCompare = existing.compareAtPrice != null ? Number(existing.compareAtPrice) : undefined
        const compareCustomized = prevBaseCompareAtPrice == null || existingCompare !== prevBaseCompareAtPrice

        return {
            id: existing.id || crypto.randomUUID(),
            variantName: existing.variantName,
            skuCode: resolveSku(existing.skuCode),
            price: priceCustomized && existing.price != null ? Number(existing.price) : base.price,
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
