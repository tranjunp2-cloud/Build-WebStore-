import { PW1_PUBLISH_HEADER, signPw1PublishGrant } from './pw1-publish-grant'
import { SignJWT } from 'jose'
import { setTimeout as delay } from 'node:timers/promises'
import type { Payload } from 'payload'
import type { Client } from 'pg'
import { batchEntryHash, type BatchEntry } from './pw1-batch-input'
import { retryDelayMs } from './pw1-errors'

export type PublishResult = { status: 'published' | 'already-published' | 'failed' | 'deferred'; attempts: number; error?: string }
export function publishOrigin(value: string | undefined): string {
    if (!value) throw new Error('Automatic publication requires NEXT_PUBLIC_SERVER_URL')
    const url = new URL(value)
    if (url.username || url.password || url.pathname !== '/' || url.search || url.hash ||
        (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost','127.0.0.1','[::1]'].includes(url.hostname)))) throw new Error('Publish URL must be an HTTPS origin (HTTP allowed for localhost only)')
    return url.origin
}

/** Post-migration only. Never modify the generation ledger or regenerate on publish failure. */
export async function publishMigratedStore(payload: Payload, client: Client, entry: BatchEntry, origin: string, maxAttempts: number, signal?: AbortSignal): Promise<PublishResult> {
    let attempts = 0
    const id = (value: unknown): string => String(value && typeof value === 'object' && 'id' in value ? value.id : value)
    try {
        const mapping = (await client.query<{site_id:number;tenant_id:number;source_user_id:string;status:string;input_hash:string}>('SELECT * FROM pw1_migration_stores WHERE source_store_id=$1', [entry.sourceStoreId])).rows[0]
        if (!mapping || mapping.status !== 'completed' || mapping.input_hash !== batchEntryHash(entry) || mapping.source_user_id !== entry.sourceUserId) throw new Error('Publish requires a completed migration matching this exact input and owner')
        const users = await payload.find({collection:'users',where:{email:{equals:entry.owner.email}},depth:0,limit:2})
        if (users.docs.length !== 1) throw new Error('Publish owner is not unique')
        const user = users.docs[0]
        if (!(user.tenants as Array<{tenant:unknown;role?:string;status?:string}> | undefined)?.some(m => id(m.tenant) === String(mapping.tenant_id) && m.role === 'owner' && m.status === 'active')) throw new Error('Publish owner membership mismatch')
        const site = await payload.findByID({collection:'sites',id:mapping.site_id,depth:0})
        if (id(site.tenant) !== String(mapping.tenant_id)) throw new Error('Publish tenant mismatch')
        if (site.status === 'published') return {status:'already-published',attempts:0}
        if (site.status !== 'draft') throw new Error('Only migrated draft sites may be published')
        const secret = process.env.PAYLOAD_SECRET
        if (!secret) throw new Error('PAYLOAD_SECRET is required for publish')
        let retryAfterMs = 0
        let failure = 'Publish attempts exhausted'
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            if (signal?.aborted) return {status:'deferred',attempts:attempt-1,error:'Publish interrupted'}
            attempts = attempt
            retryAfterMs = 0
            try {
                // Authenticate as the verified migration owner; normal API authorization,
                // page-version promotion and cache invalidation apply. A scoped grant waives billing only.
                const token = await new SignJWT({id:user.id,collection:'users',mfa_verified:true}).setProtectedHeader({alg:'HS256'}).setIssuedAt().setExpirationTime('2m').sign(new TextEncoder().encode(secret))
                const grant = await signPw1PublishGrant({ userId: String(user.id), siteId: String(mapping.site_id), tenantId: String(mapping.tenant_id), sourceStoreId: entry.sourceStoreId, inputHash: mapping.input_hash }, secret)
                const response = await fetch(`${origin}/api/sites/${mapping.site_id}/publish`, {method:'PATCH',redirect:'error',headers:{cookie:`payload-token=${token}`,[PW1_PUBLISH_HEADER]:grant},signal:signal ? AbortSignal.any([signal,AbortSignal.timeout(60000)]) : AbortSignal.timeout(60000)})
                const retryAfter = Number(response.headers.get('retry-after'))
                if (response.status === 429 && Number.isFinite(retryAfter) && retryAfter > 0) retryAfterMs = Math.min(60000,retryAfter*1000)
                const body = await response.json() as {success?:boolean;error?:{code?:string;message?:string}}
                if (!response.ok || body.success !== true) throw new Error(`Publish HTTP ${response.status}: ${body.error?.code ?? 'unsuccessful response'}`)
                const published = await payload.findByID({collection:'sites',id:mapping.site_id,depth:0})
                if (published.status !== 'published') throw new Error('Publish API succeeded but destination DB is not published')
                return {status:'published',attempts:attempt}
            } catch (error) {
                if (signal?.aborted) return {status:'deferred',attempts:attempt,error:'Publish interrupted'}
                failure = error instanceof Error ? error.message : 'Publish failed'
                // A timed-out request may have committed. Do not republish live drafts.
                const latest = await payload.findByID({collection:'sites',id:mapping.site_id,depth:0})
                if (latest.status === 'published') return {status:'published',attempts:attempt}
                console.error(`[${entry.sourceStoreId}] publish attempt ${attempt}/${maxAttempts}: ${failure}`)
                if (attempt < maxAttempts) await delay(Math.max(retryDelayMs(attempt),retryAfterMs),undefined,{signal})
            }
        }
        return {status:'failed',attempts:maxAttempts,error:failure}
    } catch (error) {
        return {status:signal?.aborted?'deferred':'failed',attempts,error:error instanceof Error?error.message:'Publish preflight failed'}
    }
}
