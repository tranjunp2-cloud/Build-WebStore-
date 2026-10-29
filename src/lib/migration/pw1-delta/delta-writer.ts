/**
 * Single-document writes for the delta, following the original writer's rules
 * (pw1-json/writer.ts): media rows keep external URLs without upload, users get their PW1 password
 * (or a reset-required random one), source timestamps are restored after Payload sets its own.
 */
import type { CollectionSlug, PayloadRequest } from 'payload'
import { resolveData, targetProjectionMatches, type Entity } from '../pw1-json/projection'
import type { QueryClient } from '../pw1-json/runtime'
import type { ImportDocument, SourceCredential } from '../pw1-json/types'
import { legacyEmailAuth, passwordFor, userAuth } from '../pw1-json/user-auth'
import type { DeltaRuntime } from './delta-runtime'

type Doc = ImportDocument

/** Soft retirement applied when a document disappears from PW1; other collections are only reported. */
export const RETIRE_PATCH: Record<string, Doc> = {
  products: { status: 'archived' }, blogs: { status: 'draft' }, tenants: { status: 'suspended' },
}

export class DeltaWriteError extends Error {
  constructor(readonly code: string, detail?: string) { super(detail ? `${code}: ${detail}` : code) }
}

function tableName(runtime: DeltaRuntime, collection: string): string {
  const config = runtime.payload.collections[collection as CollectionSlug].config
  const name = typeof config.dbName === 'string' ? config.dbName : collection.replaceAll('-', '_')
  if (!/^[a-z_][a-z0-9_]*$/.test(name)) throw new DeltaWriteError('TARGET_TABLE_INVALID', name)
  return `"${name}"`
}

async function restoreTimestamps(runtime: DeltaRuntime, client: QueryClient, collection: string, id: number, data: Doc): Promise<void> {
  if (!data.createdAt || !data.updatedAt) return
  await client.query(`UPDATE ${tableName(runtime, collection)} SET created_at=$1::timestamptz, updated_at=$2::timestamptz WHERE id=$3`, [data.createdAt, data.updatedAt, id])
}

/** Source timestamps are mandatory except where the original writer defaulted them to the run clock. */
function withClock(entity: Entity, data: Doc, clock: string): Doc {
  for (const field of ['createdAt', 'updatedAt']) if (data[field] == null) {
    if (!['users', 'sites', 'media'].includes(entity.collection)) throw new DeltaWriteError('SOURCE_TIMESTAMP_REQUIRED', entity.ref)
    data[field] = clock
  }
  return data
}

export async function createDocument(
  runtime: DeltaRuntime, req: Partial<PayloadRequest>, client: QueryClient, entity: Entity,
  targets: Map<string, number>, credentials: Map<string, SourceCredential>, clock: string,
): Promise<{ id: number; deferred: boolean; passwordResetRequired?: boolean }> {
  const resolved = resolveData(entity, targets, true)
  const data = withClock(entity, resolved.data, clock)
  let doc: { id: number | string }
  let passwordResetRequired: boolean | undefined
  if (entity.collection === 'media') {
    doc = await runtime.payload.db.create({ collection: 'media', data: { ...data, filename: null }, req: req as PayloadRequest })
  } else if (entity.collection === 'users') {
    const password = await passwordFor(entity, credentials, true)
    passwordResetRequired = password === null
    doc = entity.preserveInvalidEmail
      ? await runtime.payload.db.create({ collection: 'users', req: req as PayloadRequest,
        data: { loginAttempts: 0, prefer_lang: 'en', has_seen_ai_wizard: false, migrationStatus: 'migrated', ...data, ...await legacyEmailAuth(password) } })
      : await runtime.payload.create({ collection: 'users', data: { ...data, ...userAuth(password) } as never, depth: 0,
        overrideAccess: true, req, context: req.context, disableVerificationEmail: true }) as unknown as { id: number }
  } else {
    doc = await runtime.payload.create({ collection: entity.collection as CollectionSlug, data: data as never, depth: 0,
      overrideAccess: true, req, context: req.context }) as unknown as { id: number }
  }
  const id = Number(doc.id)
  await restoreTimestamps(runtime, client, entity.collection, id, data)
  return { id, deferred: resolved.deferred, ...(passwordResetRequired === undefined ? {} : { passwordResetRequired }) }
}

/** Refuses to overwrite a document that was edited in PW2 after the import (current ≠ old projection). */
export async function updateDocument(
  runtime: DeltaRuntime, req: Partial<PayloadRequest>, client: QueryClient, entity: Entity, id: number,
  targets: Map<string, number>, previous: Doc | null, allowDeferred = true,
): Promise<{ data: Doc; deferred: boolean }> {
  const collection = entity.collection as CollectionSlug
  if (previous) {
    const current = await runtime.payload.findByID({ collection, id, depth: 0, overrideAccess: true, disableErrors: true, req, showHiddenFields: false })
    if (!current) throw new DeltaWriteError('TARGET_MISSING', `${entity.collection}/${id}`)
    if (!targetProjectionMatches(previous, current)) throw new DeltaWriteError('PW2_EDITED_CONFLICT', `${entity.collection}/${id}`)
  }
  const { data, deferred } = resolveData(entity, targets, allowDeferred)
  if (entity.collection === 'users' && entity.preserveInvalidEmail) await runtime.payload.db.updateOne({ collection: 'users', id, data, req: req as PayloadRequest })
  else await runtime.payload.update({ collection, id, data: data as never, depth: 0, overrideAccess: true, req, context: req.context })
  await restoreTimestamps(runtime, client, entity.collection, id, data)
  return { data, deferred }
}

export async function retireDocument(runtime: DeltaRuntime, req: Partial<PayloadRequest>, collection: string, id: number): Promise<Doc | null> {
  const patch = RETIRE_PATCH[collection]
  if (!patch) return null
  await runtime.payload.update({ collection: collection as CollectionSlug, id, data: patch as never, depth: 0, overrideAccess: true, req, context: req.context })
  return patch
}
