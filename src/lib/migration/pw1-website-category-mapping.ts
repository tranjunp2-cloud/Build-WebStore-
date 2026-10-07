import { z } from 'zod'
import type { VerifiedCategoryMapping } from './pw1-destination'

const Reference = z.object({
    sourceId: z.string().regex(/^\d+$/),
    sourcePath: z.string().regex(/^\/(?!\/)[^?#]*$/),
    status: z.enum(['pending', 'unavailable']),
}).strict()
export const WebsiteCategoryMappingsSchema = z.array(Reference).superRefine((rows, ctx) => {
    const keys = rows.map(row => `${row.sourcePath}:${row.sourceId}`)
    if (new Set(keys).size !== keys.length) ctx.addIssue({code:'custom',message:'Duplicate website category mapping'})
}).optional()

/** Website-only manifest; destination IDs come exclusively from verified BE mappings. */
export function resolveWebsiteCategoryMappings(references: z.infer<typeof WebsiteCategoryMappingsSchema>, verified: readonly VerifiedCategoryMapping[]) {
    const rows = (references ?? []).map(reference => {
        const mapping = verified.find(row => row.sourceId === reference.sourceId && row.sourcePath === reference.sourcePath)
        return mapping
            ? { ...reference, status: 'mapped' as const, destinationId: mapping.destinationId, listingPageId: mapping.listingPageId }
            : { ...reference, status: reference.status === 'unavailable' ? 'unavailable' as const : 'unverified' as const, destinationId: null }
    })
    for (const mapping of verified) {
        if (!rows.some(row => row.sourceId === mapping.sourceId && row.sourcePath === mapping.sourcePath)) {
            rows.push({...mapping,status:'mapped'})
        }
    }
    return rows
}
