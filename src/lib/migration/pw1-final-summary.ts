import { readFile } from 'node:fs/promises'
import { Client } from 'pg'
import { batchEntryHash } from './pw1-batch-input'
import { validateMigrationBatch } from './pw1-batch-validation'
import type { PreparedPart } from './pw1-prepared-input'

type FinalRow = { source_store_id: string; status: string; input_hash: string; site_id: number; tenant_slug: string | null; site_status: string | null }
export function finalStoreResult(sourceStoreId: string, expectedHash: string | undefined, row: FinalRow | undefined) {
    const migrated = Boolean(expectedHash && row?.status === 'completed' && row.input_hash === expectedHash)
    return { sourceStoreId, migrated, migrationStatus: !expectedHash ? 'input-excluded' : !row ? 'not-started' : row.input_hash !== expectedHash ? 'input-changed' : row.status,
        siteId: row?.site_id ?? null, publicationStatus: migrated ? row?.site_status ?? 'missing-site' : 'not-ready',
        websitePath: migrated && row?.site_status === 'published' && row.tenant_slug ? `/sites/${encodeURIComponent(row.tenant_slug)}` : null }
}

/** Current DB outcomes for this exact input, independent of retry/batch counters. */
export async function readFinalMigrationSummary(parts: PreparedPart[], store?: string) {
    const hashes = new Map<string, string>()
    const exclusions = new Map<string, string>()
    const ids = new Set(parts.flatMap(part => part.storeIds).filter(id => !store || id === store))
    for (const part of parts) {
        const parsed = validateMigrationBatch(JSON.parse(await readFile(part.path, 'utf8')))
        for (const entry of parsed.entries) {
            if (store && entry.sourceStoreId !== store) continue
            const hash = batchEntryHash(entry)
            if (hashes.has(entry.sourceStoreId) && hashes.get(entry.sourceStoreId) !== hash) throw new Error(`Conflicting input for store ${entry.sourceStoreId}`)
            ids.add(entry.sourceStoreId)
            hashes.set(entry.sourceStoreId, hash)
        }
        for (const item of [...parsed.errors, ...parsed.skipped]) if (item.sourceStoreId && (!store || item.sourceStoreId === store)) {
            ids.add(item.sourceStoreId)
            exclusions.set(item.sourceStoreId, 'error' in item ? item.error : item.reason)
        }
    }
    const client = new Client({ connectionString: process.env.DATABASE_URI || process.env.DATABASE_URL })
    await client.connect()
    try {
        const rows = (await client.query<FinalRow>(`SELECT m.source_store_id,m.status,m.input_hash,m.site_id,t.slug tenant_slug,s.status site_status
            FROM pw1_migration_stores m LEFT JOIN sites s ON s.id=m.site_id LEFT JOIN tenants t ON t.id=m.tenant_id
            WHERE m.source_store_id=ANY($1::text[])`, [[...ids]])).rows
        const mappings = new Map(rows.map(row => [row.source_store_id, row]))
        const stores = [...ids].sort((a,b) => a.localeCompare(b, undefined, { numeric: true })).map(id => ({ ...finalStoreResult(id, exclusions.has(id) ? undefined : hashes.get(id), mappings.get(id)), reason: exclusions.get(id) ?? null }))
        const successfulStores = stores.filter(item => item.migrated)
        return { generatedAt: new Date().toISOString(), scope: 'Current destination DB state matching this run input; includes previous successful runs',
            totals: { stores: stores.length, migrated: successfulStores.length, notMigrated: stores.length-successfulStores.length,
                published: successfulStores.filter(item => item.publicationStatus === 'published').length,
                draft: successfulStores.filter(item => item.publicationStatus === 'draft').length },
            successfulStores, stores }
    } finally { await client.end() }
}
