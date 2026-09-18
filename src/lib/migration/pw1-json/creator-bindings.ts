import { createHash } from 'node:crypto'
import { constants } from 'node:fs'
import { access, open, realpath, stat } from 'node:fs/promises'
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path'
import { z } from 'zod'
import { checksum, type Entity } from './projection'
import { MigrationError } from './errors'
import { parseJsonChunks } from './stream-json'
import { bindExternalActor, findClaim, findOperation, type LedgerBatch, type LedgerLease, type SqlClient } from './ledger'

const digest = z.string().regex(/^[a-f0-9]{64}$/)
const id = z.string().regex(/^[1-9]\d*$/)
const actorRef = z.string().regex(/^@users:users:[1-9]\d*$/)
const safeText = z.string().min(1).max(512).refine(value => !/[\u0000-\u001f\u007f]/.test(value))
export const userActorsSchema = z.object({
  version: z.literal(1), purpose: z.literal('creator-target-binding-required'),
  sourceInstanceToken: z.string().regex(/^[A-Za-z0-9]+$/), snapshotId: z.string().min(1),
  actors: z.array(z.object({
    _ref: actorRef, sourceId: id, name: safeText, email: z.string().email().max(320), createdBy: actorRef.optional(),
    source: z.object({ table: z.literal('users'), storeId: z.null(), deletedAt: z.null(), isFrontend: z.literal('0'),
      status: z.enum(['0','1','2','3']), createdAt: z.string().datetime({offset:true}), updatedAt: z.string().datetime({offset:true}),
      roles: z.array(z.object({id,name:safeText,guardName:safeText}).strict()).max(1000),
    }).strict(),
  }).strict()).max(100000),
}).strict()
export type UserActors = z.infer<typeof userActorsSchema>
export const creatorBindingsSchema = z.object({
  version: z.literal(1), sourceInstance: z.string().min(1), sourceDatabase: z.string().min(1),
  sourceInstanceToken: z.string().regex(/^[A-Za-z0-9]+$/), snapshotId: z.string().min(1),
  actorArtifactHash: digest, targetIdentityHash: digest,
  entries: z.array(z.object({
    sourceRef: actorRef, targetUserId: z.number().int().positive().safe(), targetUserIdentityHash: digest,
    provenanceKind: z.enum(['operator-approved','legacy-claim']), evidenceRef: z.string().min(1), evidenceHash: digest,
  }).strict()).max(100000),
}).strict()
export type CreatorBindings = z.infer<typeof creatorBindingsSchema>
/** Records the operator's explicit decision; does not authenticate their authority. */
export const creatorDecisionEvidenceSchema = z.object({
  sourceInstance: z.string().min(1), sourceDatabase: z.string().min(1),
  sourceInstanceToken: z.string().regex(/^[A-Za-z0-9]+$/), snapshotId: z.string().min(1),
  actorArtifactHash: digest, targetIdentityHash: digest,
  sourceRef: actorRef, targetUserId: z.number().int().positive().safe(), targetUserIdentityHash: digest,
  decision: z.literal('approve-existing-creator-binding'), approvedBy: z.string().trim().min(1).max(512),
  approvedAt: z.string().datetime({offset:true}),
}).strict()

export function validateUserActors(value: unknown, provenance: {sourceInstanceToken:string;snapshotId:string}): UserActors {
  const parsed=userActorsSchema.safeParse(value)
  if(!parsed.success)throw new MigrationError('USER_ACTORS_SCHEMA_INVALID')
  const registry=parsed.data
  if(registry.sourceInstanceToken!==provenance.sourceInstanceToken||registry.snapshotId!==provenance.snapshotId)throw new MigrationError('USER_ACTORS_PROVENANCE_INVALID')
  const actors=new Map(registry.actors.map(actor=>[actor._ref,actor]))
  if(actors.size!==registry.actors.length||registry.actors.some(actor=>actor._ref!==`@users:users:${actor.sourceId}`))throw new MigrationError('USER_ACTORS_IDENTITY_INVALID')
  // Each node is visited once even when many actors share the same ancestry.
  const complete=new Set<string>()
  for(const actor of registry.actors){
    const path=new Set<string>();let current:typeof actor|undefined=actor
    while(current&&!complete.has(current._ref)){
      if(path.has(current._ref))throw new MigrationError('USER_ACTORS_CHAIN_INVALID')
      path.add(current._ref)
      if(!current.createdBy)break
      current=actors.get(current.createdBy)
      if(!current)throw new MigrationError('USER_ACTORS_CHAIN_INVALID')
    }
    for(const ref of path)complete.add(ref)
  }
  return registry
}

async function privateBytes(path:string,maxBytes:number):Promise<Buffer>{
  if(!isAbsolute(path)||await realpath(path)!==resolve(path))throw new MigrationError('CREATOR_BINDING_PATH_INVALID')
  const fromRepo=relative(await realpath(process.cwd()),path)
  if(fromRepo!=='..'&&!fromRepo.startsWith(`..${sep}`)&&!isAbsolute(fromRepo))throw new MigrationError('CREATOR_BINDINGS_OUTSIDE_REPOSITORY_REQUIRED')
  // Also reject another checkout/worktree, not just the current working directory.
  let ancestor=dirname(path)
  for(;;){
    try{
      await access(resolve(ancestor,'.git'))
      throw new MigrationError('CREATOR_BINDINGS_OUTSIDE_REPOSITORY_REQUIRED')
    }catch(error){
      if(error instanceof MigrationError)throw error
      if(!error||typeof error!=='object'||!('code' in error)||error.code!=='ENOENT')throw error
    }
    const parentPath=dirname(ancestor)
    if(parentPath===ancestor)break
    ancestor=parentPath
  }
  const parent=await stat(dirname(path))
  if((parent.mode&0o077)!==0)throw new MigrationError('CREATOR_BINDING_DIRECTORY_PRIVATE_REQUIRED')
  const handle=await open(path,constants.O_RDONLY|constants.O_NOFOLLOW)
  try{
    const before=await handle.stat()
    if(!before.isFile()||(before.mode&0o077)!==0||before.size>maxBytes)throw new MigrationError('CREATOR_BINDING_FILE_INVALID')
    const chunks:Buffer[]=[];let size=0
    for await(const raw of handle.createReadStream({autoClose:false})){const chunk=Buffer.from(raw);size+=chunk.length;if(size>maxBytes)throw new MigrationError('CREATOR_BINDING_FILE_INVALID');chunks.push(chunk)}
    const bytes=Buffer.concat(chunks);const after=await handle.stat()
    if(before.size!==after.size||before.mtimeMs!==after.mtimeMs||before.ctimeMs!==after.ctimeMs)throw new MigrationError('CREATOR_BINDING_INPUT_CHANGED')
    return bytes
  }finally{await handle.close()}
}
export async function loadCreatorBindings(path:string,expectedHash?:string):Promise<CreatorBindings>{
  const bytes=await privateBytes(path,64*1024*1024)
  if(expectedHash&&createHash('sha256').update(bytes).digest('hex')!==expectedHash)throw new MigrationError('CREATOR_BINDING_HASH_MISMATCH')
  let value:unknown
  try{value=await parseJsonChunks((async function*(){yield bytes})())}catch{throw new MigrationError('CREATOR_BINDING_JSON_INVALID')}
  const parsed=creatorBindingsSchema.safeParse(value)
  if(!parsed.success)throw new MigrationError('CREATOR_BINDING_SCHEMA_INVALID')
  const seen=new Set<string>(),targets=new Set<number>()
  for(const entry of parsed.data.entries){
    if(seen.has(entry.sourceRef))throw new MigrationError('CREATOR_BINDING_DUPLICATE')
    seen.add(entry.sourceRef)
    if(targets.has(entry.targetUserId))throw new MigrationError('CREATOR_TARGET_IDENTITY_ALIAS')
    targets.add(entry.targetUserId)
    const evidence=await privateBytes(entry.evidenceRef,16*1024*1024)
    if(createHash('sha256').update(evidence).digest('hex')!==entry.evidenceHash)throw new MigrationError('CREATOR_EVIDENCE_HASH_MISMATCH')
    let decisionValue:unknown
    try{decisionValue=await parseJsonChunks((async function*(){yield evidence})())}catch{throw new MigrationError('CREATOR_EVIDENCE_JSON_INVALID')}
    const decision=creatorDecisionEvidenceSchema.safeParse(decisionValue)
    if(!decision.success)throw new MigrationError('CREATOR_EVIDENCE_SCHEMA_INVALID')
    for(const field of ['sourceInstance','sourceDatabase','sourceInstanceToken','snapshotId','actorArtifactHash','targetIdentityHash'] as const){
      if(decision.data[field]!==parsed.data[field])throw new MigrationError('CREATOR_EVIDENCE_BINDING_MISMATCH')
    }
    for(const field of ['sourceRef','targetUserId','targetUserIdentityHash'] as const){
      if(decision.data[field]!==entry[field])throw new MigrationError('CREATOR_EVIDENCE_BINDING_MISMATCH')
    }
  }
  return parsed.data
}

/** No password/roles/membership/last-login values enter identity evidence. */
export function actorTargetIdentityHash(row:{id:unknown;email:unknown}):string{
  if(typeof row.email!=='string'||!/^\d+$/.test(String(row.id)))throw new MigrationError('CREATOR_TARGET_IDENTITY_INVALID')
  return checksum({id:String(row.id),emailLookupKey:row.email.trim().toLowerCase()})
}
export interface ResolvedCreator {
  sourceRef:string;sourceId:string;targetUserId:number;targetUserIdentityHash:string
  sourceChecksum:string;bindingChecksum:string;evidenceHash:string;provenanceKind:'operator-approved'|'legacy-claim'
}
export interface CreatorContext {
  sourceInstance:string;targetIdentityHash:string;actorArtifactHash:string
  targets:Map<string,number>;entries:Map<string,ResolvedCreator>
}
export interface CreatorInput {
  actors?:UserActors;bindings?:CreatorBindings;sourceInstance:string;sourceDatabase:string
  sourceInstanceToken:string;snapshotId:string;actorArtifactHash:string|null;targetIdentityHash:string
}
export function externalCreatorRefs(entities:Entity[]):string[]{
  const local=new Set(entities.map(entity=>entity.ref))
  return [...new Set(entities.flatMap(entity=>entity.refs.filter(ref=>!local.has(ref.ref)).map(ref=>{
    if(entity.collection!=='users'||ref.path!=='createdBy'||ref.collection!=='users')throw new MigrationError('EXTERNAL_ACTOR_PATH_FORBIDDEN')
    return ref.ref
  })))].sort()
}
async function assertTarget(db:SqlClient,entry:ResolvedCreator,sourceInstance:string,lock=false):Promise<void>{
  const result=await db.query(`SELECT id,email FROM users WHERE id=$1 ${lock?'FOR UPDATE':''}`,[entry.targetUserId])
  if(!result.rows[0]||actorTargetIdentityHash({id:result.rows[0].id,email:result.rows[0].email})!==entry.targetUserIdentityHash)throw new MigrationError('CREATOR_TARGET_IDENTITY_CHANGED')
  // With lock=true the target row serializes competing actor bindings, including distinct source IDs.
  const aliases=await db.query(`SELECT id FROM migration_entity_map WHERE source_system='pw1'
    AND source_instance_id=$1 AND source_entity='users' AND target_collection='users'
    AND target_id=$2 AND source_id<>$3 AND claim_active=true LIMIT 1`,[sourceInstance,String(entry.targetUserId),entry.sourceId])
  if(aliases.rows.length)throw new MigrationError('CREATOR_TARGET_IDENTITY_ALIAS')
}
export async function resolveCreatorContext(db:SqlClient,input:CreatorInput,entities:Entity[]):Promise<CreatorContext>{
  const refs=externalCreatorRefs(entities)
  const context:CreatorContext={sourceInstance:input.sourceInstance,targetIdentityHash:input.targetIdentityHash,actorArtifactHash:input.actorArtifactHash??'',targets:new Map(),entries:new Map()}
  if(!refs.length)return context
  if(!input.actors||!input.bindings||!input.actorArtifactHash)throw new MigrationError('CREATOR_BINDINGS_REQUIRED')
  const registry=validateUserActors(input.actors,input),binding=input.bindings
  for(const field of ['sourceInstance','sourceDatabase','sourceInstanceToken','snapshotId','actorArtifactHash','targetIdentityHash'] as const){
    if(binding[field]!==input[field])throw new MigrationError('CREATOR_BINDING_PROVENANCE_MISMATCH')
  }
  const actors=new Map(registry.actors.map(actor=>[actor._ref,actor]));const bindings=new Map(binding.entries.map(entry=>[entry.sourceRef,entry]))
  if(bindings.size!==binding.entries.length)throw new MigrationError('CREATOR_BINDING_DUPLICATE')
  if(new Set(binding.entries.map(entry=>entry.targetUserId)).size!==binding.entries.length)throw new MigrationError('CREATOR_TARGET_IDENTITY_ALIAS')
  for(const entity of entities)if(actors.has(entity.ref))throw new MigrationError('CREATOR_BUSINESS_IDENTITY_OVERLAP')
  for(const ref of refs){
    const actor=actors.get(ref),entry=bindings.get(ref)
    if(!actor||!entry)throw new MigrationError('CREATOR_BINDING_MISSING')
    const resolved:ResolvedCreator={sourceRef:ref,sourceId:actor.sourceId,targetUserId:entry.targetUserId,targetUserIdentityHash:entry.targetUserIdentityHash,
      sourceChecksum:checksum({sourceInstance:input.sourceInstance,actor,snapshotId:input.snapshotId,actorArtifactHash:input.actorArtifactHash}),
      bindingChecksum:checksum(entry),evidenceHash:entry.evidenceHash,provenanceKind:entry.provenanceKind}
    const claim=await findClaim(db,input.sourceInstance,'users',actor.sourceId)
    if(claim&&(claim.targetCollection!=='users'||claim.targetId!==String(entry.targetUserId)))throw new MigrationError('CREATOR_CLAIM_CONFLICT')
    if(entry.provenanceKind==='legacy-claim'&&!claim)throw new MigrationError('CREATOR_LEGACY_CLAIM_REQUIRED')
    await assertTarget(db,resolved,input.sourceInstance)
    context.targets.set(ref,entry.targetUserId);context.entries.set(ref,resolved)
  }
  return context
}

export async function bindCreatorReferences(db:SqlClient,lease:LedgerLease,batch:LedgerBatch,entity:Entity,context?:CreatorContext):Promise<void>{
  const refs=entity.refs.filter(ref=>ref.externalActor)
  if(refs.length&&(!context||context.sourceInstance!==batch.binding.sourceInstance||context.targetIdentityHash!==batch.binding.targetHash))throw new MigrationError('CREATOR_CONTEXT_MISMATCH')
  for(const ref of [...new Set(refs.map(ref=>ref.ref))].sort()){
    if(entity.collection!=='users'||!refs.every(item=>item.path==='createdBy'&&item.collection==='users'))throw new MigrationError('EXTERNAL_ACTOR_PATH_FORBIDDEN')
    const entry=context?.entries.get(ref)
    if(!entry)throw new MigrationError('CREATOR_CONTEXT_MISSING')
    await bindExternalActor(db,lease,entity.storeId,{...entry,sourceInstance:context!.sourceInstance},()=>assertTarget(db,entry,context!.sourceInstance,true))
  }
}
export async function verifyCreatorReferences(db:SqlClient,batch:LedgerBatch,entities:Entity[],context?:CreatorContext,lock=false):Promise<void>{
  for(const ref of externalCreatorRefs(entities)){
    const entry=context?.entries.get(ref)
    if(!entry||context?.sourceInstance!==batch.binding.sourceInstance||context.targetIdentityHash!==batch.binding.targetHash)throw new MigrationError('CREATOR_CONTEXT_MISSING')
    if(lock)await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[JSON.stringify(['pw1-actor',context.sourceInstance,entry.sourceId])])
    const owner=await findClaim(db,context.sourceInstance,'users',entry.sourceId,{lock})
    if(!owner||owner.targetCollection!=='users'||owner.targetId!==String(entry.targetUserId))throw new MigrationError('CREATOR_CLAIM_CONFLICT')
    await assertTarget(db,entry,context.sourceInstance,lock)
    const operation=await findOperation(db,batch.id,entities[0].storeId,'users',entry.sourceId)
    const detail=operation?.detail as Record<string,unknown>|undefined
    if(!operation||operation.action!=='SKIP'||operation.state!=='SKIPPED'||operation.target_collection!=='users'||String(operation.target_id)!==String(entry.targetUserId)||operation.target_checksum!==entry.targetUserIdentityHash||operation.source_checksum!==entry.sourceChecksum||detail?.scope!=='external_reference'||detail.ownsBusinessRow!==false||detail.bindingChecksum!==entry.bindingChecksum)throw new MigrationError('CREATOR_OPERATION_INCOMPLETE')
    if(String(operation.id)!==owner.ownerMapId&&String(operation.depends_on_entity_map_id)!==owner.ownerMapId)throw new MigrationError('CREATOR_OWNER_CHANGED')
  }
}
