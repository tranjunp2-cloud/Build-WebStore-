/**
 * Optimistic-concurrency guard for the merchant's manual saves. A form remembers the `updatedAt` it loaded and sends
 * it as `expectedUpdatedAt`; a save made against an older version is refused (code VERSION_CONFLICT, HTTP 409 on
 * routes) and writes nothing, so it never silently replaces a newer change (the copilot, another tab, a colleague).
 * No `expectedUpdatedAt` = no check (other code paths, the copilot's own appliers, imports).
 * `null` is meaningful only for rows that may not exist yet (email templates): "expect no row".
 */

export const VERSION_CONFLICT = 'VERSION_CONFLICT'

/** What a refused save answers with. `current`: the stored `updatedAt` now (null: the record is gone / has no row). */
export type VersionConflict = { ok: false; code: typeof VERSION_CONFLICT; current: string | null }

export class VersionConflictError extends Error {
    constructor(readonly current: string | null) {
        super('This record was changed after it was opened.')
        this.name = 'VersionConflictError'
    }

    toResult(): VersionConflict {
        return { ok: false, code: VERSION_CONFLICT, current: this.current }
    }
}

const toIso = (value: unknown): string | null => {
    if (value == null || value === '') return null
    const time = new Date(value as string | number | Date).getTime()
    // not a date: compared as text, so an odd stamp still equals itself
    return Number.isNaN(time) ? String(value) : new Date(time).toISOString()
}

/** The stored timestamp as an ISO string (what clients send back), or null. */
export const versionOf = (stored: unknown): string | null => toIso(stored)

/** Is a save made against `expected` stale? Compares instants, not strings. */
export function isStaleVersion(expected: string | null | undefined, stored: unknown): boolean {
    if (expected === undefined) return false
    const current = toIso(stored)
    if (expected === null) return current !== null
    return current === null || current !== toIso(expected)
}

/** Throws VersionConflictError when the save is stale. */
export function assertFreshVersion(expected: string | null | undefined, stored: unknown): void {
    if (isStaleVersion(expected, stored)) throw new VersionConflictError(toIso(stored))
}

/** A server action's body: the conflict as a typed result instead of a throw. */
export async function withVersionGuard<T>(run: () => Promise<T>): Promise<T | VersionConflict> {
    try {
        return await run()
    } catch (err) {
        if (err instanceof VersionConflictError) return err.toResult()
        throw err
    }
}

export function isVersionConflict(value: unknown): value is VersionConflict {
    return typeof value === 'object' && value !== null && (value as { code?: unknown }).code === VERSION_CONFLICT
}
