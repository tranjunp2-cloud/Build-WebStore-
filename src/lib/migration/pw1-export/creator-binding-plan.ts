import { z } from 'zod'
import { compareIds, ExportError } from './primitives'
import { validateUserActors } from './user-actors'

const targetUserSchema = z.object({
  id: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  email: z.string().email(),
  verifiedSource: z.object({
    sourceInstanceToken: z.string().min(1),
    sourceRef: z.string().regex(/^@users:users:[1-9]\d*$/),
  }).strict().optional(),
}).strict()
export type CreatorTargetUser = z.infer<typeof targetUserSchema>
type BindingStatus = 'planned' | 'missing-target' | 'ambiguous-email' | 'unverified-candidate' | 'identity-conflict'

/** Pure preflight only. The caller supplies identity verification evidence from the selected target. */
export function planCreatorBindings(input: {
  registry: unknown
  sourceInstanceToken: string
  snapshotId: string
  targetInstanceId: string
  targetUsers: readonly CreatorTargetUser[]
}) {
  if (!input.targetInstanceId.trim()) throw new ExportError('CREATOR_TARGET_INSTANCE_REQUIRED')
  const registry = validateUserActors(input.registry, input)
  const parsedTargets = z.array(targetUserSchema).safeParse(input.targetUsers)
  if (!parsedTargets.success) throw new ExportError('CREATOR_TARGET_USERS_INVALID')
  const targets = parsedTargets.data
  if (new Set(targets.map(t => t.id)).size !== targets.length)
    throw new ExportError('CREATOR_TARGET_ID_DUPLICATE')
  const normalize = (email: string) => email.toLowerCase()
  const actors = [...registry.actors].sort((a, b) => compareIds(a.sourceId, b.sourceId))
  const rows = actors.map(actor => {
    const candidates = targets.filter(t => normalize(t.email) === normalize(actor.email))
    const claims = targets.filter(t => t.verifiedSource?.sourceInstanceToken === registry.sourceInstanceToken
      && t.verifiedSource.sourceRef === actor._ref)
    let status: BindingStatus = 'missing-target'
    if (actors.filter(a => normalize(a.email) === normalize(actor.email)).length > 1 || claims.length > 1
      || claims.some(t => normalize(t.email) !== normalize(actor.email))) status = 'identity-conflict'
    else if (candidates.length > 1) status = 'ambiguous-email'
    else if (candidates.length === 1) {
      const verified = candidates[0].verifiedSource
      status = !verified ? 'unverified-candidate'
        : verified.sourceInstanceToken === registry.sourceInstanceToken && verified.sourceRef === actor._ref
          ? 'planned' : 'identity-conflict'
    }
    return {
      sourceRef: actor._ref, sourceId: actor.sourceId, sourceCreatedBy: actor.createdBy ?? null,
      status, candidateTargetIds: candidates.map(t => t.id).sort((a, b) => a - b),
      targetId: status === 'planned' ? candidates[0].id : null,
    }
  })
  const plannedIds = new Map(rows.filter(r => r.targetId !== null).map(r => [r.sourceRef, r.targetId!]))
  const bindings = rows.map(row => ({ ...row,
    creatorTargetId: row.sourceCreatedBy ? plannedIds.get(row.sourceCreatedBy) ?? null : null,
    creatorResolved: !row.sourceCreatedBy || plannedIds.has(row.sourceCreatedBy),
  }))
  return {
    version: 1 as const, purpose: 'creator-binding-preflight-only' as const,
    sourceInstanceToken: registry.sourceInstanceToken, snapshotId: registry.snapshotId,
    targetInstanceId: input.targetInstanceId,
    ready: bindings.every(b => b.status === 'planned' && b.creatorResolved),
    databaseWritten: false as const,
    bindings,
  }
}
