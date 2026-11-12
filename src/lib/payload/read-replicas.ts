/**
 * Read replicas for Payload's Postgres adapter (`readReplicas` in @payloadcms/db-postgres): reads go to a replica,
 * writes and transactions to the primary, and reads within 2 s of a write on the same instance stay on the primary.
 * Each replica gets its own pool with the same options as the primary (Payload copies `pool`, only the
 * connection string changes), so every instance opens up to `DATABASE_POOL_MAX` connections per replica too.
 *
 * `DATABASE_URI_READ_REPLICA` = comma-separated connection strings. On Neon a read replica is a second (read-only)
 * compute on the same branch; use its `-pooler` host. Unset or empty = no replicas (everything on the primary).
 * Pure: the raw env string comes in, so it is unit-testable (TC-PERF-030..032).
 */

export interface ReadReplicaOptions {
    readReplicas?: string[]
}

/** `sslmode` dropped so it cannot override `pool.ssl` (primary and replicas). */
export function withoutSslmode(raw: string): string {
    // keeps the other parameters: `?sslmode=require&application_name=x` → `?application_name=x`
    return raw.replace(/([?&])sslmode=[^&]*&?/g, '$1').replace(/[?&]$/, '')
}

/**
 * `{ readReplicas: [...] }` for the adapter when `DATABASE_URI_READ_REPLICA` lists at least one postgres URL, else `{}`.
 * Blank entries, non-postgres values, duplicates and the primary itself are dropped.
 */
export function readReplicaOptions(raw: string | undefined, primary: string): ReadReplicaOptions {
    if (!raw || raw.trim() === '') return {}
    const primaryClean = withoutSslmode(primary.trim())
    const replicas: string[] = []
    for (const part of raw.split(',')) {
        const value = part.trim()
        if (!/^postgres(ql)?:\/\//i.test(value)) continue
        const clean = withoutSslmode(value)
        if (clean === primaryClean || replicas.includes(clean)) continue
        replicas.push(clean)
    }
    return replicas.length > 0 ? { readReplicas: replicas } : {}
}
