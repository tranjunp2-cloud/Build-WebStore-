import { randomBytes, pbkdf2 } from 'node:crypto'
import { promisify } from 'node:util'
import { compare } from 'bcryptjs'
import { encryptPassword } from '../../sso/sso-api-client'
import { recoverPw1Password } from './laravel6-credential'
import { MigrationError } from './errors'
import type { SourceCredential } from './types'

export async function passwordFor(entity: { sourceId: string }, credentials: Map<string, SourceCredential>, allowMissing = false): Promise<string | null> {
  const record = credentials.get(entity.sourceId)
  if (allowMissing && !record?.key_string && !record?.passwordHash) return null
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

export function userAuth(password: string | null): { password: string; keyString: string | null } {
  return password === null ? { password: randomBytes(32).toString('base64url'), keyString: null } : { password, keyString: encryptPassword(password) }
}

/**
 * Match the installed Payload local auth format (payload >= 3.91: `pbkdf2-sha256-v1:` prefix, 600k iterations,
 * 32-byte key); used only for approved legacy email persistence. Older unprefixed hashes still verify, but Payload
 * rewrites them on the next login, so writing the current format avoids a rehash per migrated user.
 */
export async function legacyEmailAuth(password: string | null): Promise<{ hash: string; salt: string; keyString: string | null }> {
  const auth = userAuth(password)
  const salt = randomBytes(32).toString('hex')
  const hash = await promisify(pbkdf2)(auth.password, salt, 600000, 32, 'sha256')
  return { hash: `pbkdf2-sha256-v1:${hash.toString('hex')}`, salt, keyString: auth.keyString }
}
