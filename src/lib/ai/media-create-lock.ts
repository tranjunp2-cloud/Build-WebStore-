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
 * Cost: the locked section is the FULL payload.create({file}) — Payload runs
 * sharp resizing and the cloud-storage PUT inside it, so each create holds
 * the lock for roughly 0.5-3s, not just the DB insert. Pixabay downloads
 * still overlap freely; per-gen wall-clock impact measured acceptable on
 * staging, but keep an eye on it (follow-up: scope the lock to the drizzle
 * transaction if gen time regresses). The lock is per-process — concurrent
 * requests on the same instance serialize with each other; separate
 * instances were never affected (the race is in-process drizzle state).
 */

let chain: Promise<unknown> = Promise.resolve()

export function withMediaCreateLock<T>(fn: () => Promise<T>): Promise<T> {
    const run = chain.then(() => fn())
    // Keep the chain alive regardless of individual failures; callers still
    // receive the rejection through `run`.
    chain = run.catch(() => undefined)
    return run
}
