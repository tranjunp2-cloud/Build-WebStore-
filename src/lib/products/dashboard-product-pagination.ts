import { z } from 'zod'
import { getDisplayPrice } from './display-price'

export const productPageInputSchema = z.object({
    page: z.number().int().min(1).default(1),
    limit: z.union([z.literal(10), z.literal(25), z.literal(50), z.literal(100)]).default(10),
    status: z.enum(['all', 'active', 'draft', 'archived']).default('all'),
    search: z.string().max(512).default(''),
    categories: z.array(z.string().max(512)).max(100).default([]),
    lowStock: z.boolean().default(false),
    sale: z.enum(['All Products', 'On Sale', 'Regular Price']).default('All Products'),
    sort: z.enum(['Latest', 'Oldest', 'Name: A > Z', 'Name: Z > A', 'Price: Low > High', 'Price: High > Low', 'Inventory: Low > High', 'Inventory: High > Low']).default('Latest'),
}).strict()

export const productCandidateSchema = z.object({
    id: z.number(), name: z.string(), sku: z.string().nullish(), status: z.string().nullish(),
    inventory: z.number().nullish(), price: z.number().nullish(), compareAtPrice: z.number().nullish(),
    hasVariants: z.boolean().nullish(), variants: z.array(z.object({ price: z.number() })).nullish(),
    category: z.array(z.union([z.number(), z.object({ name: z.string() })])).nullish(), createdAt: z.string(),
})
type Candidate = z.infer<typeof productCandidateSchema>

// Case-insensitive, numeric-aware ("Item 2" before "Item 10"). One shared collator:
// localeCompare with options builds a new one per comparison (~40x slower on big catalogs).
const NAME_COLLATOR = new Intl.Collator('en', { sensitivity: 'base', numeric: true })


/** Pure selection keeps legacy display-price and sale semantics across all pages. */
export function selectProductPage(products: Candidate[], input: z.infer<typeof productPageInputSchema>) {
    const counts = { all: products.length, active: 0, draft: 0, archived: 0 }
    for (const product of products) if (product.status === 'active' || product.status === 'draft' || product.status === 'archived') counts[product.status]++
    const search = input.search.toLowerCase()
    const filtered = products.filter(product => {
        if (input.status !== 'all' && product.status !== input.status) return false
        if (search && !product.name.toLowerCase().includes(search) && !product.sku?.toLowerCase().includes(search)) return false
        if (input.lowStock && (product.inventory == null || product.inventory > 5)) return false
        const onSale = !!product.compareAtPrice && product.compareAtPrice > (product.price ?? 0)
        if (input.sale === 'On Sale' && !onSale || input.sale === 'Regular Price' && onSale) return false
        if (input.categories.length && !product.category?.some(category => typeof category === 'object' && input.categories.includes(category.name))) return false
        return true
    })
    const byName = (a: Candidate, b: Candidate) => NAME_COLLATOR.compare(a.name, b.name)
    const price = (product: Candidate) => getDisplayPrice({ price: product.price ?? undefined, hasVariants: product.hasVariants ?? undefined, variants: product.variants ?? undefined }).value
    filtered.sort((a, b) => {
        let difference = 0
        switch (input.sort) {
            case 'Oldest': difference = Date.parse(a.createdAt) - Date.parse(b.createdAt); break
            case 'Name: A > Z': difference = byName(a, b); break
            case 'Name: Z > A': difference = byName(b, a); break
            case 'Price: Low > High': difference = price(a) - price(b); break
            case 'Price: High > Low': difference = price(b) - price(a); break
            case 'Inventory: Low > High': difference = (a.inventory ?? 0) - (b.inventory ?? 0); break
            case 'Inventory: High > Low': difference = (b.inventory ?? 0) - (a.inventory ?? 0); break
            default: difference = Date.parse(b.createdAt) - Date.parse(a.createdAt)
        }
        return difference || b.id - a.id
    })
    const totalDocs = filtered.length
    const page = Math.min(input.page, Math.max(1, Math.ceil(totalDocs / input.limit)))
    return { ids: filtered.slice((page - 1) * input.limit, page * input.limit).map(product => product.id), page, totalDocs, counts }
}
