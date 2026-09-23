import { actorTargetIdentityHash } from './creator-bindings'
import { MigrationError } from './errors'
import type { SqlClient } from './ledger'

export const SYSTEM_CREATOR_EMAIL = 'sso-service@primeweb.app'

/** Email locates the operator-approved system account; identity is then bound to the actual row. */
export async function lookupSystemCreator(db: SqlClient): Promise<{ targetUserId: number; targetUserIdentityHash: string }> {
  const result = await db.query('SELECT id,email FROM users WHERE lower(btrim(email))=$1 LIMIT 2', [SYSTEM_CREATOR_EMAIL])
  if (result.rows.length !== 1) throw new MigrationError(result.rows.length ? 'SYSTEM_USER_AMBIGUOUS' : 'SYSTEM_USER_REQUIRED')
  const row = result.rows[0]
  const id = Number(row.id)
  if (!Number.isSafeInteger(id) || id <= 0) throw new MigrationError('SYSTEM_USER_ID_INVALID')
  return { targetUserId: id, targetUserIdentityHash: actorTargetIdentityHash(row as { id: unknown; email: unknown }) }
}
