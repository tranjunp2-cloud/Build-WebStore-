import { createDecipheriv, createHmac, timingSafeEqual } from 'node:crypto'
import { MigrationError } from './errors'

interface LaravelEnvelope {
  iv: string
  value: string
  mac: string
}

export const MISSING_SOURCE_CREDENTIAL_WARNING =
  'MISSING_SOURCE_CREDENTIAL' as const

export function missingCredentialWarningSourceKey(
  sourceUserId: string,
): string {
  return `users:${sourceUserId}`
}

export function hasMissingCredentialWarning(
  warnings: ReadonlyArray<{ code: string; sourceKey: string }>,
  sourceUserId: string,
): boolean {
  const sourceKey = missingCredentialWarningSourceKey(sourceUserId)
  return warnings.some(
    (warning) =>
      warning.code === MISSING_SOURCE_CREDENTIAL_WARNING &&
      warning.sourceKey === sourceKey,
  )
}

export function parseLaravelAppKey(value: string): Buffer {
  const key = value.startsWith('base64:')
    ? Buffer.from(value.slice('base64:'.length), 'base64')
    : Buffer.from(value, 'utf8')
  if (key.length !== 32) {
    throw new MigrationError('BLOCKED_PW1_APP_KEY_INVALID', 'PW1_APP_KEY must decode to exactly 32 bytes')
  }
  return key
}

function parseEnvelope(ciphertext: string): LaravelEnvelope {
  try {
    const decoded = JSON.parse(Buffer.from(ciphertext, 'base64').toString('utf8')) as Partial<LaravelEnvelope>
    if (
      typeof decoded.iv !== 'string' ||
      typeof decoded.value !== 'string' ||
      typeof decoded.mac !== 'string' ||
      !/^[a-f\d]{64}$/i.test(decoded.mac)
    ) throw new Error('malformed')
    return decoded as LaravelEnvelope
  } catch (cause) {
    throw new MigrationError('BLOCKED_SOURCE_CREDENTIAL_DECRYPT', 'PW1 credential envelope is malformed', cause)
  }
}

function unserializePhpString(serialized: Buffer): string {
  const headerEnd = serialized.indexOf(Buffer.from(':"'))
  if (serialized[0] !== 0x73 || headerEnd < 2 || !serialized.subarray(headerEnd + 2).subarray(-2).equals(Buffer.from('";'))) {
    throw new MigrationError('BLOCKED_SOURCE_CREDENTIAL_DESERIALIZE', 'PW1 decrypted credential is not a serialized string')
  }
  const byteLength = Number(serialized.subarray(2, headerEnd).toString('ascii'))
  const content = serialized.subarray(headerEnd + 2, serialized.length - 2)
  if (!Number.isSafeInteger(byteLength) || byteLength !== content.length) {
    throw new MigrationError('BLOCKED_SOURCE_CREDENTIAL_DESERIALIZE', 'PW1 serialized credential length is invalid')
  }
  return content.toString('utf8')
}

export function decryptLaravel6String(ciphertext: string, appKey: string): string {
  const key = parseLaravelAppKey(appKey)
  const envelope = parseEnvelope(ciphertext)
  const suppliedMac = Buffer.from(envelope.mac.toLowerCase(), 'hex')
  const expectedMac = Buffer.from(createHmac('sha256', key).update(envelope.iv + envelope.value).digest('hex'), 'hex')
  if (suppliedMac.length !== expectedMac.length || !timingSafeEqual(suppliedMac, expectedMac)) {
    throw new MigrationError('BLOCKED_SOURCE_CREDENTIAL_MAC', 'PW1 credential MAC verification failed')
  }
  try {
    const iv = Buffer.from(envelope.iv, 'base64')
    if (iv.length !== 16) throw new Error('invalid iv')
    const decipher = createDecipheriv('aes-256-cbc', key, iv)
    const serialized = Buffer.concat([
      decipher.update(Buffer.from(envelope.value, 'base64')),
      decipher.final(),
    ])
    return unserializePhpString(serialized)
  } catch (cause) {
    if (cause instanceof MigrationError) throw cause
    throw new MigrationError('BLOCKED_SOURCE_CREDENTIAL_DECRYPT', 'PW1 credential decryption failed', cause)
  }
}

export function recoverPw1Password(
  credential: { key_string: string | null },
  appKey: string,
): string {
  if (!credential.key_string) {
    throw new MigrationError('BLOCKED_SOURCE_KEY_STRING_MISSING', 'PW1 key_string is missing')
  }
  return decryptLaravel6String(credential.key_string, appKey)
}
