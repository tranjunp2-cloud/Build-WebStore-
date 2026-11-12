/** PW1 filter components write page-wide URL state; proximity is not a binding. */
export type FilterComponent = {
    sourceId: string
    type: string
    enabled: boolean
    config: { criteria?: Record<string, number | boolean>; sourceSettings?: Record<string, unknown> }
}
export type FilterMapping = {
    pageId: string
    sourceId: string
    type: string
    status: 'mapped' | 'skipped-intentionally' | 'unsupported' | 'invalid-data'
    targetIds: string[]
    reason: string
}
export type FilterControls = { category: boolean; price: boolean; search: boolean; attributes: boolean }
export function mapPageFilters(page: { sourceId: string; components: FilterComponent[] }) {
    const mappings: FilterMapping[] = []
    const product: FilterControls = { category: false, price: false, search: false, attributes: false }
    let hasProductFilter = false
    let articleCategory = false
    let hasArticleFilter = false
    for (const component of page.components.filter(c => c.enabled && /_(filter|sort)$/.test(c.type))) {
        const base = { pageId: page.sourceId, sourceId: component.sourceId, type: component.type, targetIds: [] as string[] }
        if (component.type.endsWith('_sort')) {
            mappings.push({ ...base, status: 'skipped-intentionally', reason: 'Legacy sorting is outside the requested migration scope.' })
            continue
        }
        const isProduct = component.type === 'product_filter'
        if (isProduct) hasProductFilter = true
        else hasArticleFilter = true
        const listings = page.components.filter(c => c.enabled && c.type === (isProduct ? 'product_listing' : 'article_listing'))
        const targets = listings.filter(c => isProduct || !c.config.sourceSettings?.list_type || c.config.sourceSettings.list_type === 'all')
        const unsupportedSelection = listings.length !== targets.length
        base.targetIds = targets.map(c => c.sourceId)
        let raw: unknown = component.config.criteria ?? component.config.sourceSettings?.criteria
        try { if (typeof raw === 'string') raw = JSON.parse(raw) } catch {
            mappings.push({ ...base, status: 'invalid-data', reason: 'Filter criteria is invalid JSON.' }); continue
        }
        if (!raw || typeof raw !== 'object' || Array.isArray(raw) || Object.values(raw).some(v => ![0, 1, false, true, '0', '1'].includes(v))) {
            mappings.push({ ...base, status: 'invalid-data', reason: 'Filter criteria must contain explicit enabled/disabled values.' }); continue
        }
        const enabled = Object.entries(raw).filter(([, v]) => v === 1 || v === true || v === '1').map(([k]) => k)
        if (!targets.length && enabled.length) {
            mappings.push({ ...base, status: 'unsupported', reason: unsupportedSelection ? 'Article fixed/random selection is not mapped; filter cannot be bound faithfully.' : 'No matching listing exists on this page; no target inferred from position.' }); continue
        }
        const unsupported = enabled.filter(k => !(isProduct ? ['category', 'price'] : ['category']).includes(k))
        if (unsupportedSelection) unsupported.push('article listing selection mode (fixed/random)')
        if (isProduct) {
            product.category ||= enabled.includes('category')
            product.price ||= enabled.includes('price')
            // PW1 variant IDs cannot be treated as PW2 attribute keys: the BE handoff
            // currently retains variant names/stock but no filterable attribute identity.
        } else articleCategory ||= enabled.includes('category')
        mappings.push({ ...base, status: unsupported.length ? 'unsupported' : 'mapped', reason: unsupported.length
            ? `Supported criteria mapped; no PW2 equivalent for: ${unsupported.join(', ')}.`
            : 'Page-wide criteria merged into matching listings; no independent filter block emitted.' })
    }
    return { mappings, product: hasProductFilter ? product : undefined, articleCategory: hasArticleFilter ? articleCategory : undefined }
}
