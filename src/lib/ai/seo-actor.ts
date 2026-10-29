import type { Payload } from 'payload'
import type { AgentActor } from '@/lib/ai-platform/context'
import type { PlatformUser } from '@/types/user'
import { resolveGenerationRecordActor, classifyActorFailure, type AiSkipReason } from './generation-actor'

/**
 * Who background SEO (hook → after()) runs as. A collection hook only knows `req.user`, and that is empty
 * whenever the write came from server code (site generation creating sample products, a status toggle
 * written with `overrideAccess`). So the actor is taken, in order, from:
 *   1. the AI actor scope active when the write was enqueued (site generation, a copilot apply);
 *   2. the user whose request fired the hook (`req.user`);
 *   3. the user who generated the site (its latest `site-generator` record) — a merchant of that workspace.
 * Nobody found → template meta, with the reason. Every actor is checked against the site's own workspace,
 * so usage is never billed to another one.
 *
 * Platform modules are imported lazily: this file is reachable from collection hooks (payload config),
 * which must not pull `server-only` code at load.
 */

export type SeoActorResolution =
    | { actor: AgentActor; skipReason?: undefined }
    | { actor: null; skipReason: AiSkipReason }

const idOf = (value: unknown): string | null => {
    if (value == null) return null
    return String(typeof value === 'object' ? (value as { id: unknown }).id : value)
}

/** The actor of the enclosing AI scope, read at enqueue time (before the work leaves the request). */
export async function captureScopeActor(): Promise<AgentActor | null> {
    try {
        const { currentAiActor } = await import('@/lib/ai-platform/actor-scope')
        return currentAiActor()
    } catch {
        return null
    }
}

/** Runs `run` inside `actor`'s AI scope so every model call below it bills that workspace. */
export async function runAsAiActor<T>(actor: AgentActor | null, run: () => Promise<T>): Promise<T> {
    if (!actor) return run()
    const { runWithAiActor } = await import('@/lib/ai-platform/actor-scope')
    return runWithAiActor(actor, run)
}

/**
 * For writes made with `overrideAccess` and no `req.user` (status toggle): runs the write as `user` in
 * `tenantId`, so the SEO its hook enqueues is billed to them. Anyone who can't act (no platform, not a
 * member) runs the write plainly — the queue then falls back on the site's own record.
 */
export async function withAiActorFor<T>(user: unknown, tenantId: string | number | null, run: () => Promise<T>): Promise<T> {
    if (!user || tenantId == null) return run()
    let actor: AgentActor | null = null
    try {
        const { isAiTasksEnabled } = await import('@/lib/ai-platform/config')
        if (isAiTasksEnabled()) {
            const { actorForUserInTenant } = await import('@/lib/ai-platform/context')
            actor = actorForUserInTenant(user as PlatformUser, String(tenantId))
        }
    } catch {
        actor = null
    }
    // outside the try: a failure of the write itself must reach the caller, not run the write twice
    return runAsAiActor(actor, run)
}

async function publisherActor(publisher: unknown, tenantId: string): Promise<SeoActorResolution> {
    try {
        const { actorForUserInTenant } = await import('@/lib/ai-platform/context')
        return { actor: actorForUserInTenant(publisher as PlatformUser, tenantId) }
    } catch (error) {
        return { actor: null, skipReason: classifyActorFailure(error) }
    }
}

export async function resolveSeoActor(
    payload: Payload,
    site: { id?: unknown; tenant?: unknown },
    sources: { scoped?: AgentActor | null; publisher?: unknown },
): Promise<SeoActorResolution> {
    const { isAiTasksEnabled } = await import('@/lib/ai-platform/config')
    if (!isAiTasksEnabled()) return { actor: null, skipReason: 'ai_unconfigured' }
    const tenantId = idOf(site.tenant)
    if (!tenantId) return { actor: null, skipReason: 'record_missing_workspace' }

    if (sources.scoped && String(sources.scoped.tenantId) === tenantId) return { actor: sources.scoped }

    let failure: AiSkipReason | null = sources.scoped ? 'not_workspace_member' : null
    if (sources.publisher) {
        const viaPublisher = await publisherActor(sources.publisher, tenantId)
        if (viaPublisher.actor) return viaPublisher
        failure = viaPublisher.skipReason
    }

    const siteId = idOf(site.id)
    if (siteId) {
        try {
            const found = await payload.find({
                collection: 'ai-generation-records',
                where: { and: [{ site: { equals: siteId } }, { endpoint: { equals: 'site-generator' } }, { user: { exists: true } }] },
                sort: '-createdAt',
                limit: 1,
                depth: 0,
                pagination: false,
                overrideAccess: true,
            })
            const record = found.docs[0] as { user?: unknown } | undefined
            if (record) {
                const viaRecord = await resolveGenerationRecordActor(payload, { user: record.user, tenant: tenantId })
                if (viaRecord.actor) return viaRecord
                failure = failure ?? viaRecord.skipReason
            }
        } catch (error) {
            failure = failure ?? classifyActorFailure(error)
        }
    }
    return { actor: null, skipReason: failure ?? 'record_missing_user' }
}
