import { SignJWT, jwtVerify } from 'jose'
import { sql } from 'drizzle-orm'
import type { Payload } from 'payload'

const audience = 'pw1-cli-publication'
export const PW1_PUBLISH_HEADER = 'x-pw1-publish-grant'
type Grant = { userId: string; siteId: string; tenantId: string; sourceStoreId: string; inputHash: string }

/** Internal CLI credential, never issued by an HTTP endpoint or accepted as a login token. */
export async function signPw1PublishGrant(grant: Grant, secret: string): Promise<string> {
    return new SignJWT(grant).setProtectedHeader({ alg: 'HS256' }).setAudience(audience)
        .setIssuedAt().setExpirationTime('2m').sign(new TextEncoder().encode(secret))
}

export async function verifyPw1PublishGrant(token: string, secret: string, target: Pick<Grant, 'userId' | 'siteId' | 'tenantId'>): Promise<Grant | null> {
    try {
        const { payload } = await jwtVerify(token, new TextEncoder().encode(secret), { algorithms: ['HS256'], audience, maxTokenAge: '2m' })
        for (const key of ['userId', 'siteId', 'tenantId'] as const) if (payload[key] !== target[key]) return null
        if (typeof payload.sourceStoreId !== 'string' || typeof payload.inputHash !== 'string') return null
        return { ...target, sourceStoreId: payload.sourceStoreId, inputHash: payload.inputHash }
    } catch {
        return null // Invalid/expired credentials never waive the normal subscription checks.
    }
}

export async function hasCompletedPw1PublishGrant(payload: Payload, token: string | null, target: Pick<Grant, 'userId' | 'siteId' | 'tenantId'>): Promise<boolean> {
    if (!token || !process.env.PAYLOAD_SECRET) return false
    const grant = await verifyPw1PublishGrant(token, process.env.PAYLOAD_SECRET, target)
    if (!grant) return false
    const db = payload.db.drizzle as { execute(query: unknown): Promise<{ rows: Array<{ source_store_id: string }> }> }
    const result = await db.execute(sql`SELECT source_store_id FROM pw1_migration_stores
        WHERE source_store_id=${grant.sourceStoreId} AND input_hash=${grant.inputHash}
        AND site_id=${Number(target.siteId)} AND tenant_id=${Number(target.tenantId)} AND status='completed'`)
    return result.rows.length === 1
}
