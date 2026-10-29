/**
 * PW1 password changes since the imported snapshot. Passwords are secret fields: they are not part of the
 * entity checksum, so the normal diff never sees them. With `--old`, the users CSV of both snapshots is
 * compared directly and already-imported users whose PW1 credential changed get the new password.
 *
 * Safety: each synced credential is remembered in `pw1_delta_credentials` (fingerprint + salt written),
 * so a later run neither repeats it nor overwrites a password the user has since changed in PW2.
 */
import { createHash } from 'node:crypto'
import type { SourceCredential } from '../pw1-json/types'
import type { QueryClient } from '../pw1-json/runtime'
import { legacyEmailAuth, passwordFor } from '../pw1-json/user-auth'
import { priorProjection } from './delta-ledger'
import type { DeltaRuntime } from './delta-runtime'
import { ledgerKey, type LedgerClaim } from './ledger-lookup'

export interface PasswordChange { sourceId: string; targetId: number }
export interface PasswordOutcome extends PasswordChange {
  outcome: 'written' | 'skipped' | 'conflict' | 'failed'; code?: string
}

/** Stable fingerprint of a PW1 credential; never stored in clear. */
export const credentialFingerprint = (credential: SourceCredential) =>
  createHash('sha256').update(`${credential.key_string ?? ''}\u0000${credential.passwordHash ?? ''}`).digest('hex')

/** PW2 users (already migrated) whose PW1 key_string or bcrypt hash differs between the two snapshots. */
export function changedPasswords(before: ReadonlyMap<string, SourceCredential>, after: ReadonlyMap<string, SourceCredential>,
  claims: ReadonlyMap<string, LedgerClaim>): PasswordChange[] {
  const changes: PasswordChange[] = []
  for (const [sourceId, credential] of after) {
    const prior = before.get(sourceId)
    if (!prior || (prior.key_string === credential.key_string && prior.passwordHash === credential.passwordHash)) continue
    const claim = claims.get(ledgerKey('users', sourceId))
    if (claim?.targetCollection === 'users') changes.push({ sourceId, targetId: Number(claim.targetId) })
  }
  return changes
}

/**
 * Decides whether a credential may be written. Pure, so the rules are testable:
 * - same fingerprint already synced → skip;
 * - synced before and the live salt is no longer the one written → the user changed it in PW2;
 * - never synced and the user row changed since the import/delta projection → treat as edited in PW2;
 * - never synced and no projection → no baseline, not written.
 */
export function passwordDecision(input: {
  fingerprint: string; synced: { fingerprint: string; salt: string } | null
  live: { salt: string | null; updatedAt: string }; projectionUpdatedAt: string | null
}): { write: true } | { write: false; outcome: 'skipped' | 'conflict'; code: string } {
  if (input.synced?.fingerprint === input.fingerprint) return { write: false, outcome: 'skipped', code: 'ALREADY_SYNCED' }
  if (input.synced && input.synced.salt !== input.live.salt) return { write: false, outcome: 'conflict', code: 'PW2_PASSWORD_CHANGED' }
  // Never synced: without an import/delta baseline a PW2 change cannot be ruled out, so nothing is written.
  if (!input.synced && !input.projectionUpdatedAt) return { write: false, outcome: 'conflict', code: 'PROJECTION_MISSING' }
  if (!input.synced && Date.parse(input.projectionUpdatedAt!) !== Date.parse(input.live.updatedAt))
    return { write: false, outcome: 'conflict', code: 'PW2_EDITED_CONFLICT' }
  return { write: true }
}

async function syncOne(client: QueryClient, sourceInstance: string, runId: string, change: PasswordChange, credential: SourceCredential, password: string): Promise<PasswordOutcome> {
  const fingerprint = credentialFingerprint(credential)
  const live = (await client.query(`SELECT salt, updated_at FROM users WHERE id=$1 FOR UPDATE`, [change.targetId])).rows[0]
  if (!live) return { sourceId: change.sourceId, targetId: change.targetId, outcome: 'failed', code: 'TARGET_MISSING' }
  const synced = (await client.query(`SELECT fingerprint, salt FROM pw1_delta_credentials WHERE source_user_id=$1`, [change.sourceId])).rows[0]
  // The newest projection wins: a user updated by this or an earlier delta run is compared with what the delta wrote.
  const projection = synced ? null
    : await priorProjection(client, sourceInstance, 'delta', 'users', change.sourceId) ?? await priorProjection(client, sourceInstance, 'import', 'users', change.sourceId)
  const decision = passwordDecision({
    fingerprint, synced: synced ? { fingerprint: String(synced.fingerprint), salt: String(synced.salt) } : null,
    live: { salt: live.salt == null ? null : String(live.salt), updatedAt: new Date(live.updated_at as string).toISOString() },
    projectionUpdatedAt: typeof projection?.updatedAt === 'string' ? projection.updatedAt : null,
  })
  if (!decision.write) return { sourceId: change.sourceId, targetId: change.targetId, outcome: decision.outcome, code: decision.code }
  const auth = await legacyEmailAuth(password)
  // Raw update of the three auth columns only: updated_at stays as is, so the edit guard keeps matching.
  await client.query(`UPDATE users SET hash=$1, salt=$2, key_string=$3 WHERE id=$4`, [auth.hash, auth.salt, auth.keyString, change.targetId])
  await client.query(`INSERT INTO pw1_delta_credentials (source_user_id, target_id, fingerprint, salt, run_id) VALUES ($1,$2,$3,$4,$5)
    ON CONFLICT (source_user_id) DO UPDATE SET target_id=EXCLUDED.target_id, fingerprint=EXCLUDED.fingerprint, salt=EXCLUDED.salt, run_id=EXCLUDED.run_id, updated_at=now()`,
  [change.sourceId, String(change.targetId), fingerprint, auth.salt, runId])
  return { sourceId: change.sourceId, targetId: change.targetId, outcome: 'written' }
}

/** One transaction per user. A credential that cannot be verified is skipped, never replaced by a random one. */
export async function applyPasswordChanges(runtime: DeltaRuntime, input: { sourceInstance: string; runId: string },
  changes: PasswordChange[], credentials: ReadonlyMap<string, SourceCredential>): Promise<PasswordOutcome[]> {
  const outcomes: PasswordOutcome[] = []
  for (const change of changes) {
    try {
      const credential = credentials.get(change.sourceId)
      const password = credential ? await passwordFor({ sourceId: change.sourceId }, credentials as Map<string, SourceCredential>, true) : null
      if (!credential || password === null) { outcomes.push({ sourceId: change.sourceId, targetId: change.targetId, outcome: 'skipped', code: 'CREDENTIAL_MISSING' }); continue }
      outcomes.push(await runtime.transaction((_req, client) => syncOne(client, input.sourceInstance, input.runId, change, credential, password)))
    } catch (error) {
      const code = error instanceof Error ? error.message.split(/[:\s]/)[0] : 'WRITE_FAILED'
      outcomes.push({ sourceId: change.sourceId, targetId: change.targetId, outcome: 'failed', code })
    }
  }
  return outcomes
}
