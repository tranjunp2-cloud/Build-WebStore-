/** Warnings the binder writes when an empty fixed selection is deliberate (PW1 shows nothing there either). */
const DELIBERATE_EMPTY = [/removed from the fixed selection/, /listing left empty as on PW1/]

export type ProductGridRepair = { changed: false } | { changed: true; from: 'fixed'; to: 'all' }

/**
 * PW1 asks its API for `filter[id]=<fixed items>` and drops an empty value, so a fixed list without items shows
 * every active product. A migrated grid that is `fixed` with no products therefore becomes `all`.
 */
export function repairProductGrid(grid: { selectionMode?: string | null; selectedProductIds?: unknown }): ProductGridRepair {
    const ids = Array.isArray(grid.selectedProductIds) ? grid.selectedProductIds : []
    return grid.selectionMode === 'fixed' && ids.length === 0 ? { changed: true, from: 'fixed', to: 'all' } : { changed: false }
}

/** A store whose migration warned about an intentionally empty selection cannot be told apart from the PW1 fallback case by its grids alone, so it is left for review. */
export const hasDeliberateEmptySelection = (warnings: readonly string[]) => warnings.some(warning => DELIBERATE_EMPTY.some(pattern => pattern.test(warning)))
