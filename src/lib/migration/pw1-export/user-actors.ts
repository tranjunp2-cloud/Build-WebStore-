import { z } from 'zod'
import { type MappingContext, type StoreOutput, ref, live } from './contracts'
import { ExportError, compareIds } from './primitives'
import { sourceTime } from './mappers/identity-lifecycle'

const sourceId = z.string().regex(/^[1-9]\d*$/)
const safeText = z.string().min(1).max(512).refine(v => !/[\u0000-\u001f\u007f]/.test(v))
const actorSchema = z.object({
  _ref: z.string().regex(/^@users:users:[1-9]\d*$/),
  sourceId,
  name: safeText,
  email: z.string().email().max(320),
  createdBy: z.string().regex(/^@users:users:[1-9]\d*$/).optional(),
  source: z.object({
    table: z.literal('users'), storeId: z.null(), deletedAt: z.null(),
    isFrontend: z.literal('0'), status: z.enum(['0', '1', '2', '3']),
    createdAt: z.string().datetime({ offset: true }), updatedAt: z.string().datetime({ offset: true }),
    roles: z.array(z.object({ id: sourceId, name: safeText, guardName: safeText }).strict()),
  }).strict(),
}).strict()
export const userActorsSchema = z.object({
  version: z.literal(1),
  purpose: z.literal('creator-target-binding-required'),
  sourceInstanceToken: z.string().regex(/^[A-Za-z0-9]+$/),
  snapshotId: z.string().min(1),
  actors: z.array(actorSchema),
}).strict()
export type UserActor = z.infer<typeof actorSchema>
export type UserActors = z.infer<typeof userActorsSchema>

/** Identity dependencies only: never Payload Users, credentials, memberships or granted roles. */
export function globalCreatorChain(ctx: MappingContext, id: string): UserActor[] | undefined {
  const result: UserActor[] = []
  const seen = new Set<string>()
  let current: string | null | undefined = id
  while (current && current !== '0') {
    if (seen.has(current)) return undefined
    seen.add(current)
    const row = ctx.find('users', current)
    if (!row || !live(row) || row.store_id || row.is_frontend !== '0') return undefined
    try {
      const roles: UserActor['source']['roles'] = []
      for (const link of ctx.tables.model_has_roles ?? []) {
        if (link.model_type !== 'App\\Models\\User' || link.model_id !== current) continue
        const role = ctx.find('roles', link.role_id)
        if (!role || !live(role)) return undefined
        roles.push({ id: role.id!, name: role.name!, guardName: role.guard_name! })
      }
      roles.sort((a, b) => compareIds(a.id, b.id))
      const actor = actorSchema.safeParse({
        _ref: ref('users', 'users', current), sourceId: current,
        name: row.name?.trim(), email: row.email,
        ...(row.created_by && row.created_by !== '0' ? { createdBy: ref('users', 'users', row.created_by) } : {}),
        source: { table: 'users', storeId: null, deletedAt: null, isFrontend: '0', status: row.status,
          createdAt: sourceTime(row.created_at, ctx), updatedAt: sourceTime(row.updated_at, ctx), roles },
      })
      if (!actor.success) return undefined
      result.push(actor.data)
      current = row.created_by
    } catch { return undefined }
  }
  return result
}

export function validateUserActors(value: unknown, provenance: { sourceInstanceToken: string; snapshotId: string }): UserActors {
  const parsed = userActorsSchema.safeParse(value)
  if (!parsed.success) throw new ExportError('USER_ACTORS_SCHEMA_INVALID')
  const registry = parsed.data
  if (registry.sourceInstanceToken !== provenance.sourceInstanceToken || registry.snapshotId !== provenance.snapshotId)
    throw new ExportError('USER_ACTORS_PROVENANCE_INVALID')
  const actors = new Map(registry.actors.map(actor => [actor._ref, actor]))
  if (actors.size !== registry.actors.length || registry.actors.some(a => a._ref !== ref('users', 'users', a.sourceId)))
    throw new ExportError('USER_ACTORS_IDENTITY_INVALID')
  for (const actor of registry.actors) {
    const seen = new Set<string>()
    let current: UserActor | undefined = actor
    while (current) {
      if (seen.has(current._ref)) throw new ExportError('USER_ACTORS_CHAIN_INVALID')
      seen.add(current._ref)
      if (!current.createdBy) break
      current = actors.get(current.createdBy)
      if (!current) throw new ExportError('USER_ACTORS_CHAIN_INVALID')
    }
  }
  return registry
}

export function collectUserActors(stores: StoreOutput[], ctx: MappingContext): UserActors | undefined {
  if (!ctx.config.migrationPolicy?.preserveUserCreators) return undefined
  const userRefs = new Set(stores.flatMap(store => store.users.map(user => user._ref)))
  const actors = new Map<string, UserActor>()
  for (const store of stores) for (const user of store.users) {
    if (typeof user.createdBy !== 'string' || userRefs.has(user.createdBy)) continue
    const id = user.createdBy.slice('@users:users:'.length)
    const chain = globalCreatorChain(ctx, id)
    if (!chain) throw new ExportError('USER_ACTORS_SOURCE_INVALID')
    for (const actor of chain) actors.set(actor._ref, actor)
  }
  if (!actors.size) return undefined
  return validateUserActors({ version: 1, purpose: 'creator-target-binding-required',
    sourceInstanceToken: ctx.config.sourceInstanceToken, snapshotId: ctx.config.snapshotId,
    actors: [...actors.values()].sort((a, b) => compareIds(a.sourceId, b.sourceId)),
  }, ctx.config)
}
