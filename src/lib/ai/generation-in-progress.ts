/**
 * Guards against a second generation touching a tenant's site (GH-2153).
 *
 * - 'in_progress': a site stays `generationStatus: 'generating'` from the first write until the pipeline
 *   finishes or fails. The route's maxDuration is 300s, so a live run is over well inside the window below;
 *   a row older than that was left behind by a crashed run and must not block the merchant forever.
 * - 'site_exists': a `completed` site is the merchant's live website. Generating again replaces every page,
 *   so it is refused. A `failed` site is not blocked: /builder/new is its "try again with AI" path.
 */
export const GENERATION_IN_PROGRESS_WINDOW_MS = 6 * 60_000

export type GenerationBlockReason = 'in_progress' | 'site_exists'
export type GenerationBlockCode = 'GENERATION_IN_PROGRESS' | 'SITE_ALREADY_EXISTS'

const CODE_BY_REASON: Record<GenerationBlockReason, GenerationBlockCode> = {
    in_progress: 'GENERATION_IN_PROGRESS',
    site_exists: 'SITE_ALREADY_EXISTS',
}

export class GenerationBlockedError extends Error {
    readonly code: GenerationBlockCode

    constructor(readonly reason: GenerationBlockReason) {
        super(reason === 'in_progress'
            ? 'A website generation is already running for this account'
            : 'This account already has a generated website')
        this.name = 'GenerationBlockedError'
        this.code = CODE_BY_REASON[reason]
    }
}

export function generationBlockReason(site: object | null | undefined, now: number = Date.now()): GenerationBlockReason | null {
    const { generationStatus, updatedAt: rawUpdatedAt } = (site ?? {}) as { generationStatus?: unknown; updatedAt?: unknown }
    if (generationStatus === 'completed') return 'site_exists'
    if (generationStatus !== 'generating') return null
    const updatedAt = typeof rawUpdatedAt === 'string' || typeof rawUpdatedAt === 'number'
        ? new Date(rawUpdatedAt).getTime()
        : NaN
    // No usable timestamp: treat as running rather than risk a second site.
    if (!Number.isFinite(updatedAt)) return 'in_progress'
    return now - updatedAt < GENERATION_IN_PROGRESS_WINDOW_MS ? 'in_progress' : null
}
