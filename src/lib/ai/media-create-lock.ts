/**
 * Global mutex serializing Payload media `create` calls.
 *
 * GH-1185: concurrent payload.create({ collection: 'media', file }) silently
 * loses rows — the drizzle adapter races on parallel upload transactions:
 * create() resolves with an ID, the cloud-storage afterChange hook then fails
 * with "Failed to persist upload data … NotFound" and the row is rolled back,
 * so blocks referencing the ID get stripped and render template fallbacks.
 * Reproduced deterministically (scripts, local): 6 sequential creates → 6 rows
 * persisted; 6 parallel creates → 1 row persisted; 12 parallel → TypeError in
 * @payloadcms/drizzle upsertRow.
 *
 * Only the DB create is serialized (~50-100ms each). Image downloads and S3
 * PUTs remain parallel, so wall-clock cost per generation is negligible.
 */

let chain: Promise<unknown> = Promise.resolve()

export function withMediaCreateLock<T>(fn: () => Promise<T>): Promise<T> {
    const run = chain.then(() => fn())
    // Keep the chain alive regardless of individual failures; callers still
    // receive the rejection through `run`.
    chain = run.catch(() => undefined)
    return run
}
