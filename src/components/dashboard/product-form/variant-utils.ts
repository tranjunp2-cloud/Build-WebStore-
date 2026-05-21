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
 * Preserves a row only when the user customized its price (differs from prevBasePrice).
 * When prevBaseSku is provided, auto-generated SKUs (matching `${prevBaseSku}-${suffix}`)
 * are updated to use the new base.sku prefix; manually customized SKUs are preserved.
 */
export function buildVariantMatrix(
    combinations: string[][],
    base: VariantBaseValues,
    currentVariants: VariantRowInput[],
    prevBasePrice: number | null,
    prevBaseSku?: string,
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

        if (existing && (prevBasePrice === null || Number(existing.price) !== prevBasePrice)) {
            return {
                id: existing.id || crypto.randomUUID(),
                variantName: existing.variantName,
                skuCode: resolveSku(existing.skuCode),
                price: existing.price != null ? Number(existing.price) : base.price,
                stock: existing.stock != null ? existing.stock : base.inventory,
                compareAtPrice: existing.compareAtPrice ?? base.compareAtPrice,
            }
        }
        return {
            id: existing?.id || crypto.randomUUID(),
            variantName,
            skuCode: resolveSku(existing?.skuCode),
            price: base.price,
            stock: base.inventory,
            compareAtPrice: base.compareAtPrice || undefined,
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
