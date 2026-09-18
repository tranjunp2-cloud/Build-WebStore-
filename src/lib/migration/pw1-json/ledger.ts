import { randomUUID } from 'node:crypto'
import { MigrationError } from './errors'

/** Caller must provide the SAME transaction used by business writes. */
export interface SqlClient {
  query(text: string, params?: unknown[]): Promise<{ rows: Record<string, unknown>[]; rowCount?: number | null }>
}
export interface BatchBinding {
  executionVersion?: 'grouped-v1'
  groupSize?: number
  profile?: 'pw1-json-v1' | 'pw1-json-v2' | 'pw1-json-v3'
  sourceInstanceToken?: string
  actorArtifactHash?: string | null
  creatorBindingsHash?: string | null
  customerReconciliationHash?: string | null
  productReconciliationHash?: string | null
  migrationPolicyHash?: string | null
  classifierVersion?: string
  sourceInstance: string
  snapshotId: string
  targetHash: string
  manifestHash: string
  masterHash: string
  mappingHash: string
  credentialHash: string | null
  writerHash: string
  schemaHash: string
  sourceDatabase?: string | null
  pw1AppKeyFingerprint?: string | null
  manifestPath: string
}
export interface LedgerBatch {
  id: string
  binding: BatchBinding
  storeIds: string[]
  state: string
  startedAt: string
}
export interface LedgerLease { batchId: string; owner: string; token: string }
export interface EntityClaim {
  ownerMapId?: string
  ownerProfile?: string
  action?: 'CREATE' | 'REUSE'
  batchId: string
  storeId: string
  sourceInstance: string
  sourceEntity: string
  sourceId: string
  targetCollection: string
  targetId: string
  sourceChecksum: string
  targetChecksum: string
  evidence: Record<string, unknown>
}

function uuid(id: string): string {
  const value = id.startsWith('json:') ? id.slice(5) : id
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new MigrationError('INVALID_BATCH_ID')
  }
  return value
}

/** Read-only readiness; schema setup is a separate command. */
export async function assertWritableProfile(db: SqlClient): Promise<void> {
  const result = await db.query(`SELECT to_regclass('public.migration_runs') AS runs,
    to_regclass('public.migration_entity_map') AS claims,
    to_regclass('public.migration_import_batches') AS batches`)
  if (!result.rows[0]?.runs || !result.rows[0]?.claims || !result.rows[0]?.batches) {
    throw new MigrationError('MIGRATION_SCHEMA_REQUIRED')
  }
}

export async function createBatch(db: SqlClient, binding: BatchBinding, storeIds: string[]): Promise<LedgerBatch> {
  if (!storeIds.length || storeIds.some(id => !/^\d+$/.test(id)) || new Set(storeIds).size !== storeIds.length) {
    throw new MigrationError('INVALID_STORE_SELECTION')
  }
  await assertWritableProfile(db)
  const id = randomUUID()
  const profile = binding.profile ?? 'pw1-json-v1'
  if (!['pw1-json-v1','pw1-json-v2','pw1-json-v3'].includes(profile)) throw new MigrationError('UNSUPPORTED_BATCH_PROFILE')
  await db.query(`INSERT INTO migration_import_batches(batch_id,binding,selected_store_ids,profile_version)
    VALUES ($1,$2::jsonb,$3::jsonb,$4)`, [id, JSON.stringify(binding), JSON.stringify(storeIds),profile])
  if (binding.executionVersion !== 'grouped-v1') for (const storeId of storeIds) {
    const childId = randomUUID()
    await db.query(`INSERT INTO migration_runs(run_id,source_instance_id,source_database,source_store_id,
      source_snapshot_id,source_snapshot_checksum,source_schema_fingerprint,mapping_version,
      target_environment,target_instance_id,pw1_app_key_fingerprint,state,importer_profile,batch_id)
      VALUES($1,$2,$3,$4,$10,$6,NULL,$7,'local',$8,$9,'PREFLIGHT_PASSED',$11,$5::uuid)`,
    [childId,binding.sourceInstance,binding.sourceDatabase ?? null,storeId,id,binding.masterHash,
      binding.mappingHash,binding.targetHash,binding.pw1AppKeyFingerprint ?? null,binding.snapshotId,profile])
    await db.query(`INSERT INTO migration_import_stores(batch_id,source_store_id,run_id) VALUES($1,$2,$3)`, [id,storeId,childId])
  }
  return getBatch(db, `json:${id}`)
}

export async function getBatch(db: SqlClient, id: string): Promise<LedgerBatch> {
  const result = await db.query('SELECT * FROM migration_import_batches WHERE batch_id=$1', [uuid(id)])
  const row = result.rows[0]
  if (!row) throw new MigrationError('BATCH_NOT_FOUND')
  if (!['pw1-json-v1','pw1-json-v2','pw1-json-v3'].includes(String(row.profile_version))) throw new MigrationError('UNSUPPORTED_BATCH_PROFILE')
  if (((row.binding as BatchBinding).profile ?? 'pw1-json-v1') !== row.profile_version) throw new MigrationError('BATCH_PROFILE_MISMATCH')
  return {
    id: `json:${String(row.batch_id)}`, binding: row.binding as BatchBinding,
    storeIds: row.selected_store_ids as string[], state: String(row.state),
    startedAt: new Date(row.created_at as string).toISOString(),
  }
}

export async function acquireLease(db: SqlClient, batchId: string, ttlSeconds = 300): Promise<LedgerLease> {
  const owner = randomUUID()
  if (!Number.isInteger(ttlSeconds) || ttlSeconds < 1 || ttlSeconds > 3600) throw new MigrationError('INVALID_LEASE_TTL')
  const result = await db.query(`UPDATE migration_import_batches SET lease_owner=$2,
    lease_expires_at=clock_timestamp()+($3 * interval '1 second'), fencing_token=fencing_token+1,
    state='APPLYING',updated_at=clock_timestamp()
    WHERE batch_id=$1 AND (lease_owner IS NULL OR lease_expires_at<=clock_timestamp())
    RETURNING fencing_token`, [uuid(batchId), owner, ttlSeconds])
  if (!result.rows[0]) throw new MigrationError('LEASE_UNAVAILABLE')
  return { batchId, owner, token: String(result.rows[0].fencing_token) }
}

export async function assertFence(db: SqlClient, lease: LedgerLease): Promise<void> {
  const result = await db.query(`SELECT batch_id FROM migration_import_batches
    WHERE batch_id=$1 AND lease_owner=$2 AND fencing_token=$3 AND lease_expires_at>clock_timestamp()
    FOR UPDATE`, [uuid(lease.batchId), lease.owner, lease.token])
  if (!result.rows.length) throw new MigrationError('STALE_FENCING_TOKEN')
}

export async function renewLease(db: SqlClient, lease: LedgerLease): Promise<void> {
  const result = await db.query(`UPDATE migration_import_batches SET lease_expires_at=clock_timestamp()+interval '300 seconds'
    WHERE batch_id=$1 AND lease_owner=$2 AND fencing_token=$3 AND lease_expires_at>clock_timestamp()
    RETURNING batch_id`, [uuid(lease.batchId), lease.owner, lease.token])
  if (!result.rows.length) throw new MigrationError('STALE_FENCING_TOKEN')
}

export async function releaseLease(db: SqlClient, lease: LedgerLease): Promise<void> {
  const result = await db.query(`UPDATE migration_import_batches SET lease_owner=NULL,lease_expires_at=NULL,
    state=CASE WHEN state='VERIFIED' THEN state ELSE 'PAUSED' END,updated_at=clock_timestamp()
    WHERE batch_id=$1 AND lease_owner=$2 AND fencing_token=$3 RETURNING batch_id`,
  [uuid(lease.batchId), lease.owner, lease.token])
  if (!result.rows.length) throw new MigrationError('STALE_FENCING_TOKEN')
}

/** Call inside the business transaction, before inspecting claims or target. */
export async function lockStore(db: SqlClient, lease: LedgerLease, storeId: string): Promise<void> {
  await assertFence(db, lease)
  await assertWritableProfile(db)
  const result = await db.query(`SELECT b.binding->>'sourceInstance' AS source_instance
    FROM migration_import_stores s JOIN migration_import_batches b USING(batch_id)
    WHERE s.batch_id=$1 AND s.source_store_id=$2`, [uuid(lease.batchId), storeId])
  if (!result.rows[0]) throw new MigrationError('STORE_OUTSIDE_BATCH')
  await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',
    [JSON.stringify(['pw1-json', result.rows[0].source_instance, storeId])])
  const active = await db.query(`SELECT run_id FROM migration_runs
    WHERE source_system='pw1' AND source_instance_id=$1 AND source_store_id=$2
      AND state IN ('APPLYING','PAUSED','VERIFYING','ROLLBACK_PENDING')
      AND batch_id IS DISTINCT FROM $3::uuid FOR UPDATE`, [result.rows[0].source_instance,storeId,uuid(lease.batchId)])
  if (active.rows.length) throw new MigrationError('SOURCE_STORE_ACTIVE_RUN')
  await db.query(`UPDATE migration_runs SET state='APPLYING'
    WHERE batch_id=$1 AND source_store_id=$2 AND state<>'VERIFIED'`, [uuid(lease.batchId),storeId])
  await assertFence(db, lease)
}

export async function findClaim(db: SqlClient, sourceInstance: string, sourceEntity: string, sourceId: string, options: { lock?: boolean } = {}): Promise<EntityClaim | null> {
  const result = await db.query(`SELECT m.*,r.batch_id,r.source_store_id,r.importer_profile
    FROM migration_entity_map m JOIN migration_runs r ON r.run_id=m.run_id
    WHERE m.source_system='pw1' AND m.source_instance_id=$1 AND m.source_entity=$2 AND m.source_id=$3
      AND m.claim_active=true ${options.lock ? 'FOR UPDATE OF m' : ''}`, [sourceInstance,sourceEntity,sourceId])
  const row = result.rows[0]
  if (!row) return null
  if (!row.target_id || !row.target_collection || !['CREATED','VERIFIED','SKIPPED'].includes(String(row.state))) {
    throw new MigrationError('SOURCE_CLAIM_UNRESOLVED')
  }
  return {
    ownerMapId:String(row.id),ownerProfile:String(row.importer_profile),
    batchId:row.batch_id ? `json:${String(row.batch_id)}` : `legacy:${String(row.run_id)}`,
    storeId:String(row.source_store_id),sourceInstance,sourceEntity,sourceId,
    targetCollection:String(row.target_collection),targetId:String(row.target_id),
    sourceChecksum:String(row.source_checksum),targetChecksum:String(row.target_checksum),
    evidence:row.detail as Record<string, unknown>,
  }
}

/** Insert conflicts MUST roll back the entire business transaction, never swallow. */
export async function recordEntity(db: SqlClient, lease: LedgerLease, claim: EntityClaim): Promise<void> {
  if (uuid(claim.batchId) !== uuid(lease.batchId)) throw new MigrationError('CLAIM_BATCH_MISMATCH')
  await assertFence(db, lease)
  const binding = await getBatch(db, lease.batchId)
  if (binding.binding.sourceInstance !== claim.sourceInstance) throw new MigrationError('CLAIM_SOURCE_MISMATCH')
  const reuse = claim.action === 'REUSE'
  if (reuse && !claim.ownerMapId) throw new MigrationError('REUSE_OWNER_REQUIRED')
  if (reuse) {
    const owner = await db.query(`SELECT id FROM migration_entity_map WHERE id=$1 AND claim_active=true
      AND source_instance_id=$2 AND source_entity=$3 AND source_id=$4
      AND target_collection=$5 AND target_id=$6 FOR UPDATE`, [claim.ownerMapId,claim.sourceInstance,
      claim.sourceEntity,claim.sourceId,claim.targetCollection,claim.targetId])
    if (!owner.rows.length) throw new MigrationError('REUSE_OWNER_CHANGED')
  }
  const inserted = await db.query(`INSERT INTO migration_entity_map(run_id,source_instance_id,source_entity,source_id,
    target_collection,target_id,action,state,claim_active,source_checksum,transformed_checksum,target_checksum,
    target_updated_at,detail,depends_on_entity_map_id)
    SELECT s.run_id,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$12,$13::timestamptz,$14::jsonb,$15::bigint
    FROM migration_import_stores s WHERE s.batch_id=$1 AND s.source_store_id=$2 RETURNING id`,
  [uuid(claim.batchId),claim.storeId,claim.sourceInstance,claim.sourceEntity,claim.sourceId,
    claim.targetCollection,claim.targetId,reuse?'SKIP':'CREATE',reuse?'SKIPPED':'CREATED',!reuse,
    claim.sourceChecksum,claim.targetChecksum,claim.evidence.updatedAt ?? null,
    JSON.stringify({...claim.evidence,disposition:reuse?'VERIFIED_REUSE':'CREATED'}),claim.ownerMapId ?? null])
  if (!inserted.rows.length) throw new MigrationError('STORE_OUTSIDE_BATCH')
  await assertFence(db, lease)
}

/** Caller must verify expected projection/counts BEFORE marking complete. */
export async function markStoreVerified(db: SqlClient, lease: LedgerLease, storeId: string): Promise<void> {
  await lockStore(db, lease, storeId)
  await db.query(`UPDATE migration_entity_map SET state='VERIFIED' WHERE run_id IN
    (SELECT run_id FROM migration_import_stores WHERE batch_id=$1 AND source_store_id=$2)
    AND action='CREATE' AND state='CREATED'`, [uuid(lease.batchId),storeId])
  await db.query(`UPDATE migration_runs SET state='VERIFIED' WHERE batch_id=$1 AND source_store_id=$2`, [uuid(lease.batchId),storeId])
  await db.query(`UPDATE migration_import_stores SET state='VERIFIED'  WHERE batch_id=$1 AND source_store_id=$2`, [uuid(lease.batchId), storeId])
  await completeBatch(db, lease)
  await assertFence(db, lease)
}

export async function listStoreStates(db: SqlClient, batchId: string): Promise<Record<string, string>> {
  const result = await db.query('SELECT source_store_id,state FROM migration_import_stores WHERE batch_id=$1', [uuid(batchId)])
  return Object.fromEntries(result.rows.map(row => [String(row.source_store_id), String(row.state)]))
}

/** Durable operation evidence for replay/unknown-commit reconciliation; no writes. */
export async function findOperation(db: SqlClient, batchId: string, storeId: string, sourceEntity: string, sourceId: string): Promise<Record<string, unknown> | null> {
  const result = await db.query(`SELECT m.* FROM migration_entity_map m
    JOIN migration_import_stores s ON s.run_id=m.run_id
    WHERE s.batch_id=$1 AND s.source_store_id=$2 AND m.source_entity=$3 AND m.source_id=$4`,
  [uuid(batchId),storeId,sourceEntity,sourceId])
  return result.rows[0] ?? null
}

/** Complete staged references only for this run's CREATE, inside the business transaction. */
export async function finalizeOperation(
  db: SqlClient,
  lease: LedgerLease,
  key: { storeId: string; sourceEntity: string; sourceId: string; sourceChecksum: string },
  evidence: Record<string, unknown>,
  targetChecksum: string,
): Promise<void> {
  await lockStore(db, lease, key.storeId)
  const result = await db.query(`UPDATE migration_entity_map m
    SET target_checksum=$6, transformed_checksum=$6, target_updated_at=$7::timestamptz,
        detail=$8::jsonb, updated_at=clock_timestamp()
    FROM migration_import_stores s
    WHERE s.run_id=m.run_id AND s.batch_id=$1 AND s.source_store_id=$2
      AND m.source_entity=$3 AND m.source_id=$4 AND m.source_checksum=$5
      AND m.action='CREATE' AND m.claim_active=true AND m.state='CREATED'
    RETURNING m.id`, [uuid(lease.batchId),key.storeId,key.sourceEntity,key.sourceId,key.sourceChecksum,
    targetChecksum,evidence.updatedAt ?? null,JSON.stringify({...evidence,disposition:'CREATED'})])
  if (result.rows.length !== 1) throw new MigrationError('FINALIZE_OPERATION_CONFLICT')
  await assertFence(db, lease)
}


export interface ExternalActorEvidence {
  sourceInstance: string; sourceId: string; targetUserId: number; sourceChecksum: string
  targetUserIdentityHash: string; bindingChecksum: string; evidenceHash: string
  provenanceKind: 'operator-approved' | 'legacy-claim'
}
/** Owns only a source→target binding, NEVER the existing User business row. */
export async function bindExternalActor(
  db: SqlClient, lease: LedgerLease, storeId: string, entry: ExternalActorEvidence,
  verifyTarget: () => Promise<void>,
): Promise<void> {
  await assertFence(db,lease)
  const batch=await getBatch(db,lease.batchId)
  if(batch.binding.sourceInstance!==entry.sourceInstance||!batch.storeIds.includes(storeId))throw new MigrationError('CREATOR_CONTEXT_MISMATCH')
  await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[JSON.stringify(['pw1-actor',entry.sourceInstance,entry.sourceId])])
  const owner=await findClaim(db,entry.sourceInstance,'users',entry.sourceId,{lock:true})
  if(owner&&(owner.targetCollection!=='users'||owner.targetId!==String(entry.targetUserId)))throw new MigrationError('CREATOR_CLAIM_CONFLICT')
  if(entry.provenanceKind==='legacy-claim'&&!owner)throw new MigrationError('CREATOR_LEGACY_CLAIM_REQUIRED')
  await verifyTarget()
  const prior=await findOperation(db,lease.batchId,storeId,'users',entry.sourceId)
  if(prior){
    const detail=prior.detail as Record<string,unknown>|undefined
    if(!owner||prior.action!=='SKIP'||String(prior.target_id)!==String(entry.targetUserId)||prior.source_checksum!==entry.sourceChecksum||detail?.scope!=='external_reference'||detail.ownsBusinessRow!==false||detail.bindingChecksum!==entry.bindingChecksum)throw new MigrationError('CREATOR_OPERATION_CONFLICT')
    if(String(prior.id)!==owner.ownerMapId&&String(prior.depends_on_entity_map_id)!==owner.ownerMapId)throw new MigrationError('CREATOR_OWNER_CHANGED')
    await assertFence(db,lease)
    return
  }
  const detail={scope:'external_reference',ownsBusinessRow:false,disposition:'VERIFIED_EXTERNAL_REFERENCE',
    targetUserIdentityHash:entry.targetUserIdentityHash,bindingChecksum:entry.bindingChecksum,evidenceHash:entry.evidenceHash,provenanceKind:entry.provenanceKind}
  const inserted=await db.query(`INSERT INTO migration_entity_map(run_id,source_instance_id,source_entity,source_id,
    target_collection,target_id,action,state,claim_active,source_checksum,transformed_checksum,target_checksum,detail,depends_on_entity_map_id)
    SELECT s.run_id,$3,'users',$4,'users',$5,'SKIP','SKIPPED',$6,$7,$8,$8,$9::jsonb,$10::bigint
    FROM migration_import_stores s WHERE s.batch_id=$1 AND s.source_store_id=$2 RETURNING id`,
    [uuid(lease.batchId),storeId,entry.sourceInstance,entry.sourceId,String(entry.targetUserId),!owner,entry.sourceChecksum,
      entry.targetUserIdentityHash,JSON.stringify(detail),owner?.ownerMapId??null])
  if(inserted.rows.length!==1)throw new MigrationError('STORE_OUTSIDE_BATCH')
  await assertFence(db,lease)
}

/** Called in the same transaction as fenced group registration. */
export async function registerPreflightedStores(db: SqlClient, lease: LedgerLease, ids: string[]): Promise<void> {
  await assertFence(db, lease)
  const batch = await getBatch(db, lease.batchId)
  const size = batch.binding.groupSize
  if (batch.binding.executionVersion !== 'grouped-v1' || !size || !ids.length) throw new MigrationError('GROUP_BINDING_INVALID')
  const start = batch.storeIds.indexOf(ids[0])
  if (start < 0 || start % size || JSON.stringify(batch.storeIds.slice(start, start + size)) !== JSON.stringify(ids)) throw new MigrationError('GROUP_MEMBERSHIP_INVALID')
  for (const id of ids) {
    const existing = await db.query(`SELECT s.run_id,r.source_store_id,r.batch_id FROM migration_import_stores s JOIN migration_runs r ON r.run_id=s.run_id WHERE s.batch_id=$1 AND s.source_store_id=$2`, [uuid(batch.id), id])
    if (existing.rows.length) {
      if (String(existing.rows[0].source_store_id) !== id || String(existing.rows[0].batch_id) !== uuid(batch.id)) throw new MigrationError('GROUP_CHILD_BINDING_INVALID')
      continue
    }
    const child = randomUUID(), b = batch.binding
    await db.query(`INSERT INTO migration_runs(run_id,source_instance_id,source_database,source_store_id,source_snapshot_id,source_snapshot_checksum,source_schema_fingerprint,mapping_version,target_environment,target_instance_id,pw1_app_key_fingerprint,state,importer_profile,batch_id)
      VALUES($1,$2,$3,$4,$5,$6,NULL,$7,'local',$8,$9,'PREFLIGHT_PASSED',$10,$11)`, [child,b.sourceInstance,b.sourceDatabase ?? null,id,b.snapshotId,b.masterHash,b.mappingHash,b.targetHash,b.pw1AppKeyFingerprint,b.profile ?? 'pw1-json-v1',uuid(batch.id)])
    await db.query('INSERT INTO migration_import_stores(batch_id,source_store_id,run_id) VALUES($1,$2,$3)', [uuid(batch.id),id,child])
  }
  await assertFence(db, lease)
}
export async function completeBatch(db: SqlClient, lease: LedgerLease): Promise<boolean> {
  await assertFence(db, lease)
  const result = await db.query(`UPDATE migration_import_batches b SET state='VERIFIED',updated_at=clock_timestamp() WHERE batch_id=$1
    AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements_text(b.selected_store_ids) selected(id)
      LEFT JOIN migration_import_stores s ON s.batch_id=b.batch_id AND s.source_store_id=selected.id
      WHERE s.run_id IS NULL OR s.state<>'VERIFIED')
    AND NOT EXISTS(SELECT 1 FROM migration_import_stores s WHERE s.batch_id=b.batch_id AND NOT (b.selected_store_ids ? s.source_store_id))
    RETURNING batch_id`, [uuid(lease.batchId)])
  return result.rows.length === 1
}
