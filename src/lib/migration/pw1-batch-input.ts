import { DestinationSchema } from './pw1-destination'
import { z } from 'zod'
import { createHash } from 'node:crypto'
import { WebsiteInputSchema, adaptWebsiteInput } from './pw2-website-input'
const Identity = z.string().regex(/^\d+$/)
const BatchEntrySchema = z.object({
    sourceUserId: Identity, sourceStoreId: Identity,
    destination: DestinationSchema.optional(),
    linkCorrections: WebsiteInputSchema.shape.linkCorrections,
    owner: z.object({ email: z.string().email().transform(v=>v.trim().toLowerCase()), firstName: z.string().min(1), lastName: z.string().optional() }).strict(),
    source: z.object({ websiteUrl: z.string().url(), capturedAt: z.string().optional() }).strict(),
    website: WebsiteInputSchema.shape.website.extend({ pages: WebsiteInputSchema.shape.pages }).strict(),
}).strict()
export type BatchEntry = z.infer<typeof BatchEntrySchema>
export function compactInput(entry: BatchEntry) {
    const { pages, ...website } = entry.website
    return { linkCorrections: entry.linkCorrections, format:'pw2-website-input', version:'1.0.0', source:{...entry.source,storeId:entry.sourceStoreId}, website, pages }
}
/** Validate the complete array before any connection, provisioning or generation. */
export function parseBatchInput(input: unknown): BatchEntry[] {
    const entries = z.array(BatchEntrySchema).min(1).parse(input)
    const stores = new Set<string>(), users = new Map<string,string>(), emails = new Map<string,string>()
    for (const entry of entries) {
        if (stores.has(entry.sourceStoreId)) throw new Error(`Duplicate source store ${entry.sourceStoreId}`)
        stores.add(entry.sourceStoreId)
        const identity = JSON.stringify(entry.owner)
        if (users.has(entry.sourceUserId) && users.get(entry.sourceUserId)!==identity) throw new Error(`Conflicting owner for source user ${entry.sourceUserId}`)
        if (emails.has(entry.owner.email) && emails.get(entry.owner.email)!==entry.sourceUserId) throw new Error('Different source users cannot share one destination email')
        users.set(entry.sourceUserId,identity); emails.set(entry.owner.email,entry.sourceUserId)
        for (const mapping of entry.destination?.productCategories ?? []) {
            const page = entry.website.pages.find(p => p.sourceId === mapping.listingPageId)
            if (!page?.components.some(c => c.enabled !== false && c.type === 'product_listing')) throw new Error(`Category mapping requires a product listing page: ${mapping.listingPageId}`)
        }
        adaptWebsiteInput(compactInput(entry))
    }
    return entries
}
function canonical(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(canonical)
    if (value && typeof value==='object') return Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>[k,canonical(v)]))
    return value
}
export function batchEntryHash(entry: BatchEntry) { return createHash('sha256').update(JSON.stringify(canonical(entry))).digest('hex') }
export function batchAction(state: {status:string;input_hash:string|null}|undefined, hash:string, rerun=false): 'skip'|'run' {
    if (state?.status==='completed' && !rerun) {
        if(state.input_hash===hash)return 'skip'
        throw new Error('Completed store input changed; use --rerun to regenerate its mapped draft site')
    }
    return 'run'
}
export async function processBatch<T>(entries: BatchEntry[], operation:(entry:BatchEntry)=>Promise<T>, onResult?:(result:{sourceStoreId:string;result?:T;error?:string})=>Promise<void>) {
    const results: Array<{sourceStoreId:string;result?:T;error?:string}> = []
    for(const entry of entries) {
        try { results.push({sourceStoreId:entry.sourceStoreId,result:await operation(entry)}) }
        catch(error) { results.push({sourceStoreId:entry.sourceStoreId,error:error instanceof Error?error.message:'Unknown migration failure'}) }
        if(onResult)await onResult(results[results.length-1])
    }
    return results
}
