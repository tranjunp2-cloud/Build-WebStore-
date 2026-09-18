import { compare } from 'bcryptjs'
import type { CollectionSlug, PayloadRequest, SanitizedCollectionConfig, Where } from 'payload'
import { encryptPassword } from '../../sso/sso-api-client'
import { recoverPw1Password } from './laravel6-credential'
import { checksum, object, projectionMatches, resolveData, type Entity } from './projection'
import { findClaim, findOperation, recordEntity, lockStore, assertFence, type LedgerBatch, type LedgerLease, type EntityClaim, type SqlClient } from './ledger'
import { MigrationError } from './errors'
import type { Runtime } from './runtime'
import type { SourceCredential } from './types'
import { bindCreatorReferences, externalCreatorRefs, verifyCreatorReferences, type CreatorContext } from './creator-bindings'

type Doc = Record<string, unknown>
export interface PreflightRegistry { sourceChecksums: Map<string, string>; uniqueOwners: Map<string, string> }
export function createPreflightRegistry(): PreflightRegistry { return { sourceChecksums: new Map(), uniqueOwners: new Map() } }
function registerKey(registry: PreflightRegistry, key: string, owner: string): void {
  const existing = registry.uniqueOwners.get(key)
  if (existing !== undefined && existing !== owner) throw new MigrationError('CROSS_STORE_UNIQUE_CONFLICT')
  registry.uniqueOwners.set(key, owner)
  if (registry.sourceChecksums.size + registry.uniqueOwners.size > 1_000_000) throw new MigrationError('PREFLIGHT_KEY_RESOURCE_LIMIT')
}
function uniqueGroups(config: SanitizedCollectionConfig, collection: string): string[][] {
  const groups: string[][] = config.fields.flatMap(field => 'name' in field && 'unique' in field && field.unique ? [[field.name]] : [])
  for (const index of config.indexes ?? []) if (index.unique) groups.push(index.fields)
  const natural: Record<string, string[][]> = { customers: [['tenant', 'phone']], categories: [['tenant', 'slug']], discounts: [['tenant', 'code']], products: [['tenant', 'sku']], 'email-template-settings': [['tenant', 'templateType', 'recipient']], discount_usage_history: [['order']], 'plan-subscription-usages': [['subscription', 'featureCode']] }
  groups.push(...(natural[collection] ?? []))
  return [...new Map(groups.map(paths => [JSON.stringify(paths), paths])).values()]
}
export function* sourceKeyRecords(runtime: Runtime, entities: Entity[]): Generator<{ key: string; value: string }> {
  for (const entity of entities) {
    const owner = checksum([entity.sourceEntity, entity.sourceId])
    yield { key: 's' + owner, value: checksum([entity.collection, entity.storeId, entity.sourceChecksum]) }
    const config = runtime.payload.collections[entity.collection as CollectionSlug].config
    for (const paths of uniqueGroups(config, entity.collection)) {
      const values = paths.map(path => path.split('.').reduce<unknown>((value, key) => object(value) ? value[key] : undefined, entity.data))
      if (values.some(value => value == null || value === '')) continue
      yield { key: 'u' + checksum([entity.collection, paths, values.map(value => typeof value === 'string' ? value.trim().toLowerCase() : value)]), value: owner }
    }
    if (entity.collection === 'products') {
      const skus: string[] = []
      if (typeof entity.data.sku === 'string' && entity.data.sku.trim()) skus.push(entity.data.sku)
      if (Array.isArray(entity.data.variants)) for (const variant of entity.data.variants) if (object(variant) && typeof variant.sku === 'string' && variant.sku.trim()) skus.push(variant.sku)
      const local = new Set<string>()
      for (const sku of skus) {
        const normalized = sku.trim().toLowerCase()
        if (local.has(normalized)) throw new MigrationError('DUPLICATE_SOURCE_SKU')
        local.add(normalized)
        yield { key: 'u' + checksum(['product-sku', entity.data.tenant, normalized]), value: owner }
      }
    }
  }
}
function registerSourceKeys(runtime: Runtime, entities: Entity[], registry: PreflightRegistry): void {
  for (const { key, value } of sourceKeyRecords(runtime, entities)) {
    if (key.startsWith('u')) registerKey(registry, key.slice(1), value)
    else {
      const previous = registry.sourceChecksums.get(key.slice(1))
      if (previous !== undefined && previous !== value) throw new MigrationError('CROSS_STORE_SOURCE_CONFLICT')
      registry.sourceChecksums.set(key.slice(1), value)
    }
    if (registry.sourceChecksums.size + registry.uniqueOwners.size > 1_000_000) throw new MigrationError('PREFLIGHT_KEY_RESOURCE_LIMIT')
  }
}

export interface StoreProposal { targets: Map<string, number>; claims: Map<string, EntityClaim>; creates: number; reuses: number }
export type PreflightEntityContext = Pick<Entity, 'storeId' | 'collection' | 'sourceEntity' | 'sourceId'>
type PreflightObserver = (entity: PreflightEntityContext | undefined) => void
function reportPreflightEntity(observer: PreflightObserver | undefined, entity: Entity): void {
  observer?.({ storeId: entity.storeId, collection: entity.collection, sourceEntity: entity.sourceEntity, sourceId: entity.sourceId })
}
export function configurations(runtime: Runtime): Record<string, SanitizedCollectionConfig> {
  return Object.fromEntries(Object.entries(runtime.payload.collections).map(([slug, value]) => [slug, value.config]))
}
function idNumber(id: string): number {
  const value = Number(id)
  if (!Number.isSafeInteger(value) || value < 1) throw new MigrationError('TARGET_ID_INVALID')
  return value
}
function identifier(value: string): string {
  if (!/^[a-z_][a-z0-9_]*$/.test(value)) throw new MigrationError('TARGET_TABLE_INVALID')
  return `"${value}"`
}
function table(runtime: Runtime, entity: Entity): string {
  const config = runtime.payload.collections[entity.collection as CollectionSlug].config
  const name = typeof config.dbName === 'string' ? config.dbName : entity.collection.replaceAll('-', '_')
  return identifier(name)
}
async function read(runtime: Runtime, entity: Entity, id: number, req?: Partial<PayloadRequest>): Promise<Doc> {
  const doc = await runtime.payload.findByID({ collection: entity.collection as CollectionSlug, id, depth: 0, overrideAccess: true, disableErrors: true, req, showHiddenFields: false })
  if (!doc) throw new MigrationError('CLAIM_TARGET_MISSING')
  return doc as unknown as Doc
}
function expected(entity: Entity, targets: Map<string, number>, clock?: string, partial = false): Doc {
  const { data } = resolveData(entity, targets, partial)
  for (const field of ['createdAt', 'updatedAt']) {
    if (data[field] == null && clock) {
      if (!['users', 'sites', 'media'].includes(entity.collection)) throw new MigrationError('SOURCE_TIMESTAMP_REQUIRED')
      data[field] = clock
    }
  }
  return data
}
function match(data: Doc, doc: Doc): void {
  if (!projectionMatches(data, doc)) throw new MigrationError('TARGET_PROJECTION_CONFLICT')
}
function evidence(data: Doc, deferred: boolean, entity: Entity): Doc {
  return { projection: data, pendingReferences: deferred, updatedAt: data.updatedAt ?? null,
    timestampDefaults: ['createdAt', 'updatedAt'].filter(key => entity.data[key] == null) }
}
async function passwordFor(entity: Entity, credentials: Map<string, SourceCredential>): Promise<string> {
  const record = credentials.get(entity.sourceId)
  if (!record?.key_string || !record.passwordHash) throw new MigrationError('VERIFIABLE_CREDENTIAL_REQUIRED')
  const appKey = process.env.PW1_APP_KEY
  if (!appKey) throw new MigrationError('PW1_APP_KEY_REQUIRED')
  if (!/^[a-fA-F0-9]{64}$/.test(process.env.SSO_ENCRYPTION_KEY ?? '')) throw new MigrationError('SSO_KEY_INVALID')
  // Laravel bcrypt uses 2y; bcryptjs implements equivalent 2b. Unsupported hashes fail closed.
  if (!/^\$2[aby]\$(0[4-9]|1[0-5])\$[./A-Za-z0-9]{53}$/.test(record.passwordHash)) throw new MigrationError('SOURCE_PASSWORD_HASH_UNSUPPORTED')
  const plaintext = recoverPw1Password(record, appKey)
  if (!plaintext || Buffer.byteLength(plaintext) > 72 || !(await compare(plaintext, record.passwordHash.replace(/^\$2y\$/, '$2b$')))) throw new MigrationError('SOURCE_PASSWORD_MISMATCH')
  return plaintext
}

/** Check known unique business keys before any business write; DB constraints remain the final arbiter. */
async function uniqueChecks(runtime: Runtime, entities: Entity[], targets: Map<string, number>, claims: Map<string, EntityClaim>, req?: Partial<PayloadRequest>, db: SqlClient = runtime.pool, observer?: PreflightObserver): Promise<void> {
  const keys = new Set<string>()
  for (const entity of entities) {
    reportPreflightEntity(observer, entity)
    const config = runtime.payload.collections[entity.collection as CollectionSlug].config
    const groups = uniqueGroups(config, entity.collection)
    if (entity.collection === 'products') {
      const tenant = typeof entity.data.tenant === 'string' ? targets.get(entity.data.tenant) : undefined
      const skus = [entity.data.sku, ...(Array.isArray(entity.data.variants) ? entity.data.variants.filter(object).map(row => row.sku) : [])].filter((value): value is string => typeof value === 'string' && Boolean(value.trim())).map(value => value.trim().toLowerCase())
      if (tenant !== undefined && skus.length) {
        const matches = await db.query(`SELECT p.id FROM products p WHERE p.tenant_id=$1 AND lower(btrim(p.sku))=ANY($2::text[])
          UNION SELECT p.id FROM products_variants v JOIN products p ON p.id=v._parent_id
          WHERE p.tenant_id=$1 AND lower(btrim(v.sku))=ANY($2::text[])`, [tenant, skus])
        const owner = claims.get(entity.ref)
        if (matches.rows.some(row => !owner || String(row.id) !== owner.targetId)) throw new MigrationError('TARGET_SKU_CONFLICT')
      }
    }
    for (const paths of groups) {
      const values = paths.map(path => path.split('.').reduce<unknown>((value, key) => object(value) ? value[key] : undefined, entity.data))
      if (values.some(value => value == null || value === '')) continue
      const key = checksum([entity.collection, paths, values.map(value => typeof value === 'string' ? value.toLowerCase() : value)])
      if (keys.has(key)) throw new MigrationError('DUPLICATE_SOURCE_UNIQUE_KEY')
      keys.add(key)
      const resolved = values.map(value => typeof value === 'string' && value.startsWith('@') ? targets.get(value) : value)
      if (resolved.some(value => value === undefined)) continue
      const where: Where = { and: paths.map((path, i) => ({ [path]: { equals: resolved[i] } })) }
      const found = await runtime.payload.find({ collection: entity.collection as CollectionSlug, where, limit: 2, depth: 0, overrideAccess: true, req })
      const owner = claims.get(entity.ref)
      if (found.docs.some(doc => !owner || String(doc.id) !== owner.targetId)) throw new MigrationError('UNCLAIMED_TARGET_COLLISION')
    }
  }
}
export async function preflightStore(runtime: Runtime, entities: Entity[], sourceInstance: string, credentials: Map<string, SourceCredential>, batch?: LedgerBatch, registry?: PreflightRegistry, creatorContext?: CreatorContext, observer?: PreflightObserver): Promise<StoreProposal> {
  observer?.(undefined)
  if (registry) registerSourceKeys(runtime, entities, registry)
  const targets = new Map<string, number>(), claims = new Map<string, EntityClaim>()
  for (const ref of externalCreatorRefs(entities)) {
    const target = creatorContext?.targets.get(ref)
    if (!target || creatorContext?.sourceInstance !== sourceInstance) throw new MigrationError('CREATOR_CONTEXT_MISSING')
    targets.set(ref, target)
  }
  for (const entity of entities) {
    reportPreflightEntity(observer, entity)
    const claim = await findClaim(runtime.pool, sourceInstance, entity.sourceEntity, entity.sourceId)
    if (claim) {
      if (claim.targetCollection !== entity.collection) throw new MigrationError('CLAIM_COLLECTION_CONFLICT')
      if (claim.storeId !== entity.storeId) throw new MigrationError('CLAIM_STORE_OWNERSHIP_CONFLICT')
      claims.set(entity.ref, claim); targets.set(entity.ref, idNumber(claim.targetId))
    }
  }
  for (const entity of entities) {
    reportPreflightEntity(observer, entity)
    const claim = claims.get(entity.ref)
    if (claim) {
      const doc = await read(runtime, entity, targets.get(entity.ref)!)
      const own = batch && claim.batchId === batch.id
      if (own && claim.sourceChecksum !== entity.sourceChecksum) throw new MigrationError('OPERATION_SOURCE_CHANGED')
      const prior = claim.evidence?.projection
      if (own && object(prior)) {
        match(prior, doc)
        if (checksum(prior) !== claim.targetChecksum) throw new MigrationError('OPERATION_EVIDENCE_INVALID')
      } else {
        // Reuse cannot introduce references to yet-uncreated targets, nor alter existing credentials.
        match(expected(entity, targets), doc)
      }
    } else {
      expected(entity, new Map(entity.refs.map(ref => [ref.ref, 1])), '2000-01-01T00:00:00.000Z')
      if (entity.collection === 'users') await passwordFor(entity, credentials)
      if (entity.collection === 'media') validateMedia(entity.data)
    }
  }
  await uniqueChecks(runtime, entities, targets, claims, undefined, runtime.pool, observer)
  observer?.(undefined)
  // Prove required dependency graph can be completed without nulling a mandatory relationship.
  const ready = new Set(targets.keys()), remaining = entities.filter(entity => !ready.has(entity.ref))
  while (remaining.length) {
    const index = remaining.findIndex(entity => entity.refs.every(ref => !ref.required || ready.has(ref.ref)))
    if (index < 0) throw new MigrationError('REQUIRED_REFERENCE_CYCLE')
    ready.add(remaining.splice(index, 1)[0].ref)
  }
  return { targets, claims, creates: entities.length - claims.size, reuses: claims.size }
}
function validateMedia(data: Doc): void {
  if (typeof data.alt !== 'string' || !data.alt.trim() || data.filename != null) throw new MigrationError('MEDIA_METADATA_INVALID')
  for (const key of ['url', 'sourceUrl']) {
    if (typeof data[key] !== 'string') throw new MigrationError('MEDIA_URL_REQUIRED')
    let url: URL
    try { url = new URL(data[key]) } catch { throw new MigrationError('MEDIA_URL_INVALID') }
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) throw new MigrationError('MEDIA_URL_INVALID')
  }
}
async function restoreTimestamps(runtime: Runtime, entity: Entity, id: number, data: Doc, db: SqlClient): Promise<void> {
  if (!data.createdAt || !data.updatedAt) return
  await db.query(`UPDATE ${table(runtime, entity)} SET created_at=$1::timestamptz,updated_at=$2::timestamptz WHERE id=$3`, [data.createdAt, data.updatedAt, id])
}
function assertSession(runtime: Runtime, req: Partial<PayloadRequest>): void {
  const sessions = (runtime.payload.db as unknown as { sessions: Record<string, unknown> }).sessions
  if (typeof req.transactionID !== 'string' || !sessions[req.transactionID]) throw new MigrationError('TRANSACTION_SESSION_REQUIRED')
}

function assertCreatorTargets(entity: Entity, targets: Map<string, number>, context?: CreatorContext): void {
  for (const ref of entity.refs.filter(ref => ref.externalActor)) {
    const entry = context?.entries.get(ref.ref)
    if (!entry || targets.get(ref.ref) !== entry.targetUserId) throw new MigrationError('CREATOR_TARGET_BINDING_MISMATCH')
  }
}

/** One record + all nested rows + its durable operation commit in the same transaction. */
export async function writeEntity(runtime: Runtime, entity: Entity, targets: Map<string, number>, credentials: Map<string, SourceCredential>, batch: LedgerBatch, lease: LedgerLease, creatorContext?: CreatorContext): Promise<number> {
  return retryTransaction(() => runtime.transaction(async (req, db) => {
    assertSession(runtime, req)
    await lockStore(db, lease, entity.storeId)
    assertCreatorTargets(entity, targets, creatorContext)
    await bindCreatorReferences(db, lease, batch, entity, creatorContext)
    const prior = await findOperation(db, batch.id, entity.storeId, entity.sourceEntity, entity.sourceId)
    if (prior) {
      if (prior.source_checksum !== entity.sourceChecksum || !object(prior.detail) || !object(prior.detail.projection)) throw new MigrationError('OPERATION_SOURCE_CHANGED')
      const id = idNumber(String(prior.target_id))
      await db.query(`SELECT id FROM ${table(runtime, entity)} WHERE id=$1 FOR UPDATE`, [id])
      match(prior.detail.projection, await read(runtime, entity, id, req))
      await assertFence(db, lease)
      return id
    }
    const claim = await findClaim(db, batch.binding.sourceInstance, entity.sourceEntity, entity.sourceId, { lock: true })
    if (claim) {
      if (claim.targetCollection !== entity.collection) throw new MigrationError('CLAIM_COLLECTION_CONFLICT')
      if (claim.storeId !== entity.storeId) throw new MigrationError('CLAIM_STORE_OWNERSHIP_CONFLICT')
      const id = idNumber(claim.targetId)
      await db.query(`SELECT id FROM ${table(runtime, entity)} WHERE id=$1 FOR UPDATE`, [id])
      const data = expected(entity, targets)
      match(data, await read(runtime, entity, id, req))
      await recordEntity(db, lease, { ...claim, batchId: batch.id, storeId: entity.storeId, action: 'REUSE', sourceChecksum: entity.sourceChecksum, targetChecksum: checksum(data), evidence: evidence(data, false, entity) })
      return id
    }
    const result = resolveData(entity, targets, true)
    const data = expected(entity, targets, batch.startedAt, true)
    // Repeat collision checks under the same transaction; unique DB indexes close concurrent races.
    await uniqueChecks(runtime, [entity], targets, new Map(), req, db)
    let doc: Doc
    if (entity.collection === 'media') {
      validateMedia(data)
      doc = await runtime.payload.db.create({ collection: 'media', data: { ...data, filename: null }, req: req as PayloadRequest })
    } else {
      const auth: Doc = entity.collection === 'users' ? await (async () => {
        const password = await passwordFor(entity, credentials)
        return { password, keyString: encryptPassword(password) }
      })() : {}
      // The schema validator has checked the dynamic document; collection-specific TS unions cannot express this runtime dispatch.
      doc = await runtime.payload.create({ collection: entity.collection as CollectionSlug, data: { ...data, ...auth } as never, depth: 0, overrideAccess: true, req, context: req.context, disableVerificationEmail: true }) as unknown as Doc
    }
    const id = idNumber(String(doc.id))
    await restoreTimestamps(runtime, entity, id, data, db)
    match(data, await read(runtime, entity, id, req))
    await recordEntity(db, lease, { batchId: batch.id, storeId: entity.storeId, sourceInstance: batch.binding.sourceInstance, sourceEntity: entity.sourceEntity, sourceId: entity.sourceId, targetCollection: entity.collection, targetId: String(id), sourceChecksum: entity.sourceChecksum, targetChecksum: checksum(data), evidence: evidence(data, result.deferred, entity), action: 'CREATE' })
    await assertFence(db, lease)
    return id
  }))
}

export async function finalizeEntity(runtime: Runtime, entity: Entity, targets: Map<string, number>, batch: LedgerBatch, lease: LedgerLease, creatorContext?: CreatorContext): Promise<void> {
  await retryTransaction(() => runtime.transaction(async (req, db) => {
    assertSession(runtime, req)
    await lockStore(db, lease, entity.storeId)
    assertCreatorTargets(entity, targets, creatorContext)
    await bindCreatorReferences(db, lease, batch, entity, creatorContext)
    const operation = await findOperation(db, batch.id, entity.storeId, entity.sourceEntity, entity.sourceId)
    if (!operation || operation.source_checksum !== entity.sourceChecksum || !object(operation.detail) || !object(operation.detail.projection)) throw new MigrationError('OPERATION_EVIDENCE_MISSING')
    const id = idNumber(String(operation.target_id))
    await db.query(`SELECT id FROM ${table(runtime, entity)} WHERE id=$1 FOR UPDATE`, [id])
    match(operation.detail.projection, await read(runtime, entity, id, req))
    const data = expected(entity, targets, operation.action === 'CREATE' ? batch.startedAt : undefined)
    if (operation.detail.pendingReferences) {
      if (operation.action !== 'CREATE' || operation.claim_active !== true) throw new MigrationError('DEFERRED_UPDATE_NOT_OWNED')
      // Only rows created by this batch may complete deferred relationships. Never update an existing owner.
      await runtime.payload.update({ collection: entity.collection as CollectionSlug, id, data: data as never, depth: 0, overrideAccess: true, req, context: req.context })
      await restoreTimestamps(runtime, entity, id, data, db)
      match(data, await read(runtime, entity, id, req))
      await db.query(`UPDATE migration_entity_map SET target_checksum=$1,transformed_checksum=$1,detail=$2::jsonb WHERE id=$3 AND action='CREATE' AND claim_active=true`, [checksum(data), JSON.stringify({ ...operation.detail, ...evidence(data, false, entity) }), operation.id])
    } else match(data, await read(runtime, entity, id, req))
    await assertFence(db, lease)
  }))
}
export async function verifyStore(runtime: Runtime, entities: Entity[], targets: Map<string, number>, batch: LedgerBatch, req?: Partial<PayloadRequest>, db: SqlClient = runtime.pool, creatorContext?: CreatorContext): Promise<void> {
  await verifyCreatorReferences(db, batch, entities, creatorContext, Boolean(req))
  for (const entity of entities) {
    const operation = await findOperation(db, batch.id, entity.storeId, entity.sourceEntity, entity.sourceId)
    if (!operation || operation.source_checksum !== entity.sourceChecksum || !object(operation.detail) || !object(operation.detail.projection) || operation.detail.pendingReferences || checksum(operation.detail.projection) !== operation.target_checksum) throw new MigrationError('STORE_VERIFICATION_INCOMPLETE')
    const id = idNumber(String(operation.target_id))
    const data = expected(entity, targets, operation.action === 'CREATE' ? batch.startedAt : undefined)
    if (req) await db.query(`SELECT id FROM ${table(runtime, entity)} WHERE id=$1 FOR SHARE`, [id])
    const doc = await read(runtime, entity, id, req)
    match(operation.detail.projection, doc); match(data, doc)
  }
}
export function databaseErrorCode(error: unknown): string | undefined {
  let current = error
  for (let depth = 0; depth < 5 && object(current); depth++) {
    if (typeof current.code === 'string' && /^[0-9A-Z]{5}$/.test(current.code)) return current.code
    current = current.cause
  }
  return undefined
}
export async function retryTransaction<T>(operation: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try { return await operation() } catch (error) {
      if (!['40001', '40P01'].includes(databaseErrorCode(error) ?? '') || attempt >= 2) throw error
      await new Promise(resolve => setTimeout(resolve, 100 * (attempt + 1) + Math.floor(Math.random() * 100)))
    }
  }
}
