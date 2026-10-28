import type { Payload } from 'payload'
import { isAiTasksEnabled } from '@/lib/ai-platform/config'
import { actorForUserInTenant, AgentAccessError, type AgentActor } from '@/lib/ai-platform/context'
import type { PlatformUser } from '@/types/user'

type Relation = string | number | { id: string | number } | null | undefined

const relationId = (value: unknown): string | null => {
    const ref = value as Relation
    if (ref == null) return null
    return String(typeof ref === 'object' ? ref.id : ref)
}

/**
 * Why a generation ran without AI although the platform may be configured. Recorded on the
 * generation outcome so an admin can tell "rule-based because nobody could be billed" from
 * "rule-based because the model failed" — both used to look like a plain success.
 */
export type AiSkipReason =
    | 'ai_unconfigured'
    | 'no_workspace'
    | 'record_missing_user'
    | 'record_missing_workspace'
    | 'not_workspace_member'
    | 'actor_lookup_failed'

export type ActorResolution =
    | { actor: AgentActor; skipReason?: undefined }
    | { actor: null; skipReason: AiSkipReason }

/** A membership refusal (incl. super-admin outside the workspace) vs. an unexpected failure. */
export function classifyActorFailure(error: unknown): AiSkipReason {
    return error instanceof AgentAccessError ? 'not_workspace_member' : 'actor_lookup_failed'
}

/**
 * Admin rerun and the recovery worker regenerate a merchant's request: they
 * run as the user who made it, inside that record's workspace, so the model
 * usage is billed to the merchant's quota and ledger — never to platform staff
 * (who are not members of merchant workspaces). No actor → rule-based generation,
 * with the reason.
 */
export async function resolveGenerationRecordActor(
    payload: Payload,
    record: { user?: unknown; tenant?: unknown },
): Promise<ActorResolution> {
    if (!isAiTasksEnabled()) return { actor: null, skipReason: 'ai_unconfigured' }
    const userId = relationId(record.user)
    if (!userId) return { actor: null, skipReason: 'record_missing_user' }
    const tenantId = relationId(record.tenant)
    if (!tenantId) return { actor: null, skipReason: 'record_missing_workspace' }
    try {
        const user = await payload.findByID({ collection: 'users', id: userId, depth: 1, overrideAccess: true })
        return { actor: actorForUserInTenant(user as unknown as PlatformUser, tenantId) }
    } catch (error) {
        return { actor: null, skipReason: classifyActorFailure(error) }
    }
}

/** Actor only; callers that must show why no actor was found use `resolveGenerationRecordActor`. */
export async function actorForGenerationRecord(
    payload: Payload,
    record: { user?: unknown; tenant?: unknown },
): Promise<AgentActor | null> {
    return (await resolveGenerationRecordActor(payload, record)).actor
}
