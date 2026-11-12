/**
 * Guards against a second generation touching a tenant's site (GH-2153).
 *
 * - 'in_progress': a site stays `generationStatus: 'generating'` from the first write until the pipeline
 *   finishes or fails. The route's maxDuration is 300s, so a live run is over well inside the window below;
 *   a row older than that was left behind by a crashed run and must not block the merchant forever.
 * - 'site_exists' (GH-2154): any site that is not `failed` is the merchant's website, whatever its status
 *   (`completed`, or `none`/missing for sites created by the PW1 migration or before the field existed).
 *   Generating again replaces every page and renames the subdomain, so it is refused. A `failed` site is
 *   not blocked: /builder/new is its "try again with AI" path. No site at all is also allowed.
 */
import { NextResponse } from 'next/server'

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

/** `site` is one tenant site row; null/undefined means the tenant has no site yet. */
export function generationBlockReason(site: object | null | undefined, now: number = Date.now()): GenerationBlockReason | null {
    if (!site) return null
    const { generationStatus, updatedAt: rawUpdatedAt } = site as { generationStatus?: unknown; updatedAt?: unknown }
    if (generationStatus === 'failed') return null
    if (generationStatus !== 'generating') return 'site_exists'
    const updatedAt = typeof rawUpdatedAt === 'string' || typeof rawUpdatedAt === 'number'
        ? new Date(rawUpdatedAt).getTime()
        : NaN
    // No usable timestamp: treat as running rather than risk a second site.
    if (!Number.isFinite(updatedAt)) return 'in_progress'
    return now - updatedAt < GENERATION_IN_PROGRESS_WINDOW_MS ? 'in_progress' : null
}

/** Strongest block across all of a tenant's sites: a running generation beats an existing site. */
export function firstGenerationBlock(sites: ReadonlyArray<object>, now: number = Date.now()): GenerationBlockReason | null {
    const reasons = sites.map((site) => generationBlockReason(site, now))
    if (reasons.includes('in_progress')) return 'in_progress'
    return reasons.includes('site_exists') ? 'site_exists' : null
}

/** The 409 body shared by every route that refuses to create or overwrite a site (generate-site, apply-template). */
export function generationBlockedResponse(code: GenerationBlockCode): NextResponse {
    return NextResponse.json(
        {
            success: false,
            error: {
                code,
                message: code === 'GENERATION_IN_PROGRESS'
                    ? 'A website generation is already running for this account.'
                    : 'This account already has a website. Open it from the dashboard instead of generating a new one.',
            },
        },
        { status: 409 },
    )
}
