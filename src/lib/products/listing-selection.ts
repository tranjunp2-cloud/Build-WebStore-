import { createHash } from 'node:crypto'
import { z } from 'zod'

const Id = z.string().regex(/^[1-9]\d*$/).refine(value => Number.isSafeInteger(Number(value)))
export const ListingSelectionSchema = z.object({
    mode: z.enum(['all', 'fixed', 'random']).default('all'),
    ids: z.array(Id).default([]),
    includeOutOfStock: z.enum(['true', 'false']).default('true'),
    seed: z.string().regex(/^[a-zA-Z0-9_-]{1,80}$/).default('default'),
    category: Id.optional(),
})

/** Stable per-seed order lets pagination slice without repetitions or reshuffling. */
export function orderListingIds(ids: string[], mode: 'fixed' | 'random', selected: string[], seed: string): string[] {
    const available = new Set(ids)
    if (mode === 'fixed') return [...new Set(selected)].filter(id => available.has(id))
    const scored = [...available].map(id => ({ id, score: createHash('sha256').update(`${seed}:${id}`).digest('hex') }))
    return scored.sort((a, b) => a.score.localeCompare(b.score) || a.id.localeCompare(b.id)).map(item => item.id)
}
